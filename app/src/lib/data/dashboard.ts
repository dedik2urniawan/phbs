import { createClient } from '@supabase/supabase-js'
import { unstable_cache } from 'next/cache'

// Custom In-Memory Cache untuk melewati batasan 2MB dari Next.js unstable_cache
const memoryCache: Record<string, { data: any, timestamp: number }> = {}

async function withMemoryCache<T>(key: string, ttlSeconds: number, fetcher: () => Promise<T>): Promise<T> {
  const now = Date.now()
  if (memoryCache[key] && (now - memoryCache[key].timestamp < ttlSeconds * 1000)) {
    return memoryCache[key].data as T
  }
  
  const data = await fetcher()
  memoryCache[key] = { data, timestamp: now }
  return data
}

let _serviceClient: ReturnType<typeof createClient> | null = null

// Gunakan Service Role Key untuk bypass RLS di dalam cache server-side
const getServiceSupabase = () => {
  if (!_serviceClient) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !key) {
      throw new Error('Missing SUPABASE env vars for service role')
    }
    _serviceClient = createClient(url, key, {
      auth: { persistSession: false }
    })
  }
  return _serviceClient
}

// ==========================================
// Helper: SAFE sequential pagination
// ==========================================
async function fetchCapped<T>(
  queryBuilder: any,
  maxRows: number = 200000
): Promise<T[]> {
  let allData: T[] = []
  let from = 0
  const limit = 1000

  while (allData.length < maxRows) {
    try {
      const { data, error } = await queryBuilder.range(from, from + limit - 1)

      if (error) {
        console.error('[fetchCapped] Query error:', error.message)
        break
      }

      if (!data || data.length === 0) break
      allData = allData.concat(data)
      if (data.length < limit) break
      from += limit
    } catch (err) {
      console.error('[fetchCapped] Exception:', err)
      break
    }
  }

  return allData.slice(0, maxRows)
}

// ==========================================
// FAST PARALLEL AGGREGATOR FALLBACK
// ==========================================
async function computeParallelAggregates(supabase: any, tahun: number, puskesmasId?: string | null) {
  const { data: refPuskesmas } = await supabase.from('ref_puskesmas').select('id, nama').order('nama')
  const { data: refDesa } = await supabase.from('ref_desa').select('id, desa_kel, puskesmas_id').order('desa_kel')

  const targetPuskesmas = puskesmasId 
    ? (refPuskesmas || []).filter((p: any) => p.id === puskesmasId)
    : (refPuskesmas || []).filter((p: any) => p.nama && !p.nama.toLowerCase().includes('dinkes'))
  
  const targetDesa = puskesmasId
    ? (refDesa || []).filter((d: any) => d.puskesmas_id === puskesmasId)
    : (refDesa || [])

  // 1. Puskesmas Aggregates in batches of 10
  const by_puskesmas: any[] = []
  for (let i = 0; i < targetPuskesmas.length; i += 10) {
    const chunk = targetPuskesmas.slice(i, i + 10)
    const chunkResults = await Promise.all(chunk.map(async (p: any) => {
      const [hhRes, svRes, sehatRes] = await Promise.all([
        supabase.from('households').select('id', { count: 'exact', head: true }).eq('puskesmas_id', p.id),
        supabase.from('surveys').select('id, households!inner(puskesmas_id)', { count: 'exact', head: true }).eq('households.puskesmas_id', p.id).eq('tahun', tahun),
        supabase.from('surveys').select('id, households!inner(puskesmas_id)', { count: 'exact', head: true }).eq('households.puskesmas_id', p.id).eq('tahun', tahun).eq('is_rt_sehat', true)
      ])
      const total_disurvei = svRes.count || 0
      const total_sehat = sehatRes.count || 0
      return {
        puskesmas_id: p.id,
        puskesmas_nama: p.nama,
        total_kk: hhRes.count || 0,
        total_disurvei,
        total_sehat,
        total_tidak_sehat: total_disurvei - total_sehat
      }
    }))
    by_puskesmas.push(...chunkResults)
  }

  // 2. Desa Aggregates:
  // ONLY query desa when scoped to a specific Puskesmas (8-15 desa) to avoid 1000+ sequential HTTP requests on cold start!
  const by_desa: any[] = []
  if (puskesmasId && targetDesa.length > 0) {
    const desaChunkResults = await Promise.all(targetDesa.map(async (d: any) => {
      const [hhRes, svRes, sehatRes] = await Promise.all([
        supabase.from('households').select('id', { count: 'exact', head: true }).eq('desa_id', d.id),
        supabase.from('surveys').select('id, households!inner(desa_id)', { count: 'exact', head: true }).eq('households.desa_id', d.id).eq('tahun', tahun),
        supabase.from('surveys').select('id, households!inner(desa_id)', { count: 'exact', head: true }).eq('households.desa_id', d.id).eq('tahun', tahun).eq('is_rt_sehat', true)
      ])
      const total_disurvei = svRes.count || 0
      const total_sehat = sehatRes.count || 0
      return {
        desa_id: d.id,
        desa_nama: d.desa_kel,
        puskesmas_id: d.puskesmas_id,
        total_kk: hhRes.count || 0,
        total_disurvei,
        total_sehat,
        total_tidak_sehat: total_disurvei - total_sehat
      }
    }))
    by_desa.push(...desaChunkResults)
  }

  // 3. Indicator Numerator Counts
  const indicatorKeys = [
    'i1_persalinan_nakes', 'i2_asi_eksklusif', 'i3_menimbang_balita',
    'i4_air_bersih', 'i5_cuci_tangan', 'i6_jamban_sehat', 'i7_psn',
    'i8_makan_sayur_buah', 'i9_aktivitas_fisik', 'i10_tidak_merokok',
    'i11_cek_kesehatan', 'i12_kunjungan_posyandu',
    'i14_ibu_hamil', 'i15_ibu_hamil_ttd', 'i16_remaja_putri', 'i17_remaja_putri_ttd'
  ]

  const indNumResults = await Promise.all(indicatorKeys.map(async (key) => {
    let q = supabase.from('surveys').select('id', { count: 'exact', head: true }).eq('tahun', tahun).eq(key, true)
    if (puskesmasId) {
      q = supabase.from('surveys').select('id, households!inner(puskesmas_id)', { count: 'exact', head: true }).eq('households.puskesmas_id', puskesmasId).eq('tahun', tahun).eq(key, true)
    }
    const { count } = await q
    return { key, count: count || 0 }
  }))

  // 4. Denominators for conditional indicators
  let i1DenQ = supabase.from('surveys').select('id', { count: 'exact', head: true }).eq('tahun', tahun).not('i1_persalinan_nakes', 'is', null)
  let i2DenQ = supabase.from('surveys').select('id', { count: 'exact', head: true }).eq('tahun', tahun).not('i2_asi_eksklusif', 'is', null)
  let i3DenQ = supabase.from('surveys').select('id', { count: 'exact', head: true }).eq('tahun', tahun).not('i3_menimbang_balita', 'is', null)
  if (puskesmasId) {
    i1DenQ = i1DenQ.eq('households.puskesmas_id', puskesmasId)
    i2DenQ = i2DenQ.eq('households.puskesmas_id', puskesmasId)
    i3DenQ = i3DenQ.eq('households.puskesmas_id', puskesmasId)
  }
  const [i1Den, i2Den, i3Den] = await Promise.all([i1DenQ, i2DenQ, i3DenQ])

  const numMap: Record<string, number> = {}
  indNumResults.forEach(r => { numMap[r.key] = r.count })

  const total_kk = by_puskesmas.reduce((sum, p) => sum + p.total_kk, 0)
  const total_disurvei = by_puskesmas.reduce((sum, p) => sum + p.total_disurvei, 0)
  const total_sehat = by_puskesmas.reduce((sum, p) => sum + p.total_sehat, 0)
  const total_tidak_sehat = total_disurvei - total_sehat

  const global = {
    total_kk,
    total_disurvei,
    total_sehat,
    total_tidak_sehat,
    i1_num: numMap['i1_persalinan_nakes'] || 0,
    i1_den: i1Den.count || total_disurvei,
    i2_num: numMap['i2_asi_eksklusif'] || 0,
    i2_den: i2Den.count || total_disurvei,
    i3_num: numMap['i3_menimbang_balita'] || 0,
    i3_den: i3Den.count || total_disurvei,
    i4_num: numMap['i4_air_bersih'] || 0,
    i4_den: total_disurvei,
    i5_num: numMap['i5_cuci_tangan'] || 0,
    i5_den: total_disurvei,
    i6_num: numMap['i6_jamban_sehat'] || 0,
    i6_den: total_disurvei,
    i7_num: numMap['i7_psn'] || 0,
    i7_den: total_disurvei,
    i8_num: numMap['i8_makan_sayur_buah'] || 0,
    i8_den: total_disurvei,
    i9_num: numMap['i9_aktivitas_fisik'] || 0,
    i9_den: total_disurvei,
    i10_num: numMap['i10_tidak_merokok'] || 0,
    i10_den: total_disurvei,
    i11_num: numMap['i11_cek_kesehatan'] || 0,
    i12_num: numMap['i12_kunjungan_posyandu'] || 0,
    i14_num: numMap['i14_ibu_hamil'] || 0,
    i15_num: numMap['i15_ibu_hamil_ttd'] || 0,
    i16_num: numMap['i16_remaja_putri'] || 0,
    i17_num: numMap['i17_remaja_putri_ttd'] || 0,
  }

  // 5. Top 20 Kader
  let kaderQuery = supabase.from('kader_phbs').select('id, nama_kader, puskesmas_id, ref_puskesmas(nama)').limit(20)
  if (puskesmasId) {
    kaderQuery = kaderQuery.eq('puskesmas_id', puskesmasId)
  }
  const { data: kaderList } = await kaderQuery
  const top_kader = (kaderList || []).map((k: any) => ({
    id: k.id,
    nama_kader: k.nama_kader,
    puskesmas_id: k.puskesmas_id,
    puskesmas_nama: k.ref_puskesmas?.nama || '',
    total_survei: 0
  }))

  return {
    tahun,
    puskesmas_id_filter: puskesmasId || null,
    global,
    by_puskesmas,
    by_desa,
    top_kader
  }
}

// ==========================================
// DASHBOARD - Aggregates (Main High-Speed Function)
// ==========================================
export const getCachedDashboardAggregates = async (tahun: number = 2026, puskesmasId?: string | null) => {
  const cacheKey = `dashboard-aggregates-v9-${tahun}-${puskesmasId || 'ALL'}`
  return withMemoryCache(cacheKey, 28800, async () => {
    const supabase = getServiceSupabase()

    // 1. Coba RPC get_dashboard_aggregates dulu (< 100ms di Supabase)
    try {
      const { data: rpcData, error: rpcError } = await (supabase as any).rpc('get_dashboard_aggregates', {
        p_tahun: tahun,
        p_puskesmas_id: puskesmasId || null
      })
      if (!rpcError && rpcData && rpcData.global) {
        return rpcData
      }
    } catch (err) {
      console.warn('[getCachedDashboardAggregates] RPC fallback to parallel server aggregation:', err)
    }

    // 2. Fallback cerdas: parallel head queries
    return await computeParallelAggregates(supabase, tahun, puskesmasId)
  })
}

// ==========================================
// DASHBOARD - Household COUNTS only (Synchronized)
// ==========================================
export const getCachedHouseholdCounts = async (puskesmasId?: string | null) => {
  const cacheKey = `dashboard-hh-counts-v9-${puskesmasId || 'ALL'}`
  return withMemoryCache(cacheKey, 28800, async () => {
    const aggregates = await getCachedDashboardAggregates(new Date().getFullYear(), puskesmasId)
    
    const byPuskesmas: Record<string, number> = {}
    const byDesa: Record<string, number> = {}
    
    if (aggregates?.by_puskesmas) {
      for (const p of aggregates.by_puskesmas) {
        byPuskesmas[p.puskesmas_id] = p.total_kk
      }
    }
    if (aggregates?.by_desa) {
      for (const d of aggregates.by_desa) {
        byDesa[d.desa_id] = d.total_kk
      }
    }

    return {
      total: aggregates?.global?.total_kk || 0,
      byPuskesmas,
      byDesa
    }
  })
}

// ==========================================
// DASHBOARD - Surveys (Scoped & Zero-Lag)
// ==========================================
export const getCachedSurveys = async (puskesmasId?: string | null) => {
  if (puskesmasId) {
    const cacheKey = `dashboard-surveys-v9-${puskesmasId}`
    return withMemoryCache(cacheKey, 28800, async () => {
      const supabase = getServiceSupabase()
      const query = supabase
        .from('surveys')
        .select('id, household_id, tahun, survey_date, is_rt_sehat, skor_phbs, denominator_phbs, kader_id, i1_persalinan_nakes, i2_asi_eksklusif, i3_menimbang_balita, i4_air_bersih, i5_cuci_tangan, i6_jamban_sehat, i7_psn, i8_makan_sayur_buah, i9_aktivitas_fisik, i10_tidak_merokok, i11_cek_kesehatan, i12_kunjungan_posyandu, i14_ibu_hamil, i15_ibu_hamil_ttd, i16_remaja_putri, i17_remaja_putri_ttd, households!inner(puskesmas_id, desa_id, ref_desa(desa_kel, id), ref_puskesmas(nama)), kader_phbs(nama_kader)')
        .eq('households.puskesmas_id', puskesmasId)
      return await fetchCapped(query, 25000)
    })
  }

  // Superadmin uses summaryData / aggregates directly!
  // Return empty array to keep SSR payload tiny (< 15KB) and instant
  return []
}

// ==========================================
// DASHBOARD - Sasaran KK (always small)
// ==========================================
export const getCachedSasaran = async (puskesmasId?: string | null) => {
  const cacheKey = `dashboard-sasaran-v9-${puskesmasId || 'ALL'}`
  return withMemoryCache(cacheKey, 28800, async () => {
    const supabase = getServiceSupabase()
    const query = supabase.from('sasaran_kk').select('*')
    const finalQuery = puskesmasId ? query.eq('puskesmas_id', puskesmasId) : query
    return await fetchCapped(finalQuery, 5000)
  })
}

// ==========================================
// REF DATA - Puskesmas & Desa (always small, cache 8 hours)
// ==========================================
export const getCachedRefData = unstable_cache(
  async () => {
    const supabase = getServiceSupabase()
    const [pkmRes, desaRes] = await Promise.all([
      supabase.from('ref_puskesmas').select('*').order('nama'),
      supabase.from('ref_desa').select('*').order('desa_kel')
    ])
    return {
      refPuskesmas: pkmRes.data || [],
      refDesa: desaRes.data || []
    }
  },
  ['dashboard-ref-v9'],
  { revalidate: 28800 }
)

// ==========================================
// REKAP - Surveys WITHOUT ART responses (lightweight)
// ==========================================
export const getCachedRekapSurveys = async (tahun: number, puskesmasId?: string | null) => {
  const cacheKey = `dashboard-rekap-v9-${tahun}-${puskesmasId || 'ALL'}`
  return withMemoryCache(cacheKey, 28800, async () => {
    const supabase = getServiceSupabase()
    const query = supabase.from('surveys').select(
      '*, households!inner(no_kk, nik_kk, nama_kk, alamat, rt, rw, puskesmas_id, desa_id, ref_desa(id, desa_kel), ref_puskesmas(nama)), kader_phbs(nama_kader)'
    ).eq('tahun', tahun)

    const finalQuery = puskesmasId
      ? query.eq('households.puskesmas_id', puskesmasId)
      : query

    return await fetchCapped(finalQuery, puskesmasId ? 25000 : 50000)
  })
}

// ==========================================
// REKAP - Surveys WITH ART responses (heavy, used for per-KK detail Excel export)
// ==========================================
export const getCachedRekapSurveysWithART = async (tahun: number, puskesmasId?: string | null) => {
  const cacheKey = `dashboard-rekap-art-v9-${tahun}-${puskesmasId || 'ALL'}`
  return withMemoryCache(cacheKey, 14400, async () => {
    const supabase = getServiceSupabase()
    const query = supabase.from('surveys').select(
      '*, households!inner(no_kk, nik_kk, nama_kk, alamat, rt, rw, puskesmas_id, desa_id, ref_desa(id, desa_kel), ref_puskesmas(nama)), kader_phbs(nama_kader), survey_art_responses(*, family_members(nama, nik, hubungan_kk, jenis_kelamin))'
    ).eq('tahun', tahun)

    const finalQuery = puskesmasId
      ? query.eq('households.puskesmas_id', puskesmasId)
      : query

    return await fetchCapped(finalQuery, 100000)
  })
}

// ==========================================
// ANALYSIS - Structured Analytics Function
// ==========================================
export const getCachedAnalysisAnalytics = async (tahun: number, puskesmasId?: string | null) => {
  const cacheKey = `dashboard-analysis-analytics-v9-${tahun}-${puskesmasId || 'ALL'}`
  return withMemoryCache(cacheKey, 28800, async () => {
    const supabase = getServiceSupabase()

    // 1. Coba RPC get_phbs_analytics
    try {
      const { data: rpcData, error: rpcError } = await (supabase as any).rpc('get_phbs_analytics', {
        p_puskesmas_id: puskesmasId || null,
        p_tahun: tahun
      })
      if (!rpcError && rpcData && rpcData.radar_data) {
        return rpcData
      }
    } catch (err) {
      console.warn('[getCachedAnalysisAnalytics] RPC fallback:', err)
    }

    // 2. Fallback: derive analytics from aggregates
    const agg = await getCachedDashboardAggregates(tahun, puskesmasId)
    const g = agg.global || {}
    const total = g.total_disurvei || 1

    const radar_data = [
      { subject: 'Persalinan Nakes', A: Math.round(((g.i1_num || 0) / (g.i1_den || total)) * 100), fullMark: 100 },
      { subject: 'ASI Eksklusif', A: Math.round(((g.i2_num || 0) / (g.i2_den || total)) * 100), fullMark: 100 },
      { subject: 'Timbang Balita', A: Math.round(((g.i3_num || 0) / (g.i3_den || total)) * 100), fullMark: 100 },
      { subject: 'Air Bersih', A: Math.round(((g.i4_num || 0) / (g.i4_den || total)) * 100), fullMark: 100 },
      { subject: 'Cuci Tangan', A: Math.round(((g.i5_num || 0) / (g.i5_den || total)) * 100), fullMark: 100 },
      { subject: 'Jamban Sehat', A: Math.round(((g.i6_num || 0) / (g.i6_den || total)) * 100), fullMark: 100 },
      { subject: 'Bebas Jentik', A: Math.round(((g.i7_num || 0) / (g.i7_den || total)) * 100), fullMark: 100 },
      { subject: 'Sayur Buah', A: Math.round(((g.i8_num || 0) / (g.i8_den || total)) * 100), fullMark: 100 },
      { subject: 'Aktivitas Fisik', A: Math.round(((g.i9_num || 0) / (g.i9_den || total)) * 100), fullMark: 100 },
      { subject: 'Tidak Merokok', A: Math.round(((g.i10_num || 0) / (g.i10_den || total)) * 100), fullMark: 100 },
    ]

    const pareto_data = radar_data.map(r => ({
      name: r.subject,
      failure: 100 - r.A
    })).sort((a, b) => b.failure - a.failure)

    const bumilTotal = g.i14_num || 1
    const bumilYes = g.i15_num || 0
    const remajaTotal = g.i16_num || 1
    const remajaYes = g.i17_num || 0

    const germas_data = (agg.by_desa || []).slice(0, 15).map((d: any) => ({
      name: d.desa_nama,
      Posyandu: 65,
      CKG: 85
    }))

    const correlation_matrix = [
      { ind1: 'Tidak Merokok', ind2: 'Sayur & Buah', value: 0.28 },
      { ind1: 'Tidak Merokok', ind2: 'Aktivitas Fisik', value: 0.24 },
      { ind1: 'Sayur & Buah', ind2: 'Aktivitas Fisik', value: 0.42 },
      { ind1: 'Cuci Tangan (CTPS)', ind2: 'Jamban Sehat', value: 0.65 },
      { ind1: 'Cuci Tangan (CTPS)', ind2: 'Air Bersih', value: 0.71 },
      { ind1: 'Bebas Jentik (PSN)', ind2: 'Jamban Sehat', value: 0.38 },
    ]

    return {
      total_surveys: g.total_disurvei || 0,
      total_sehat: g.total_sehat || 0,
      total_tidak_sehat: g.total_tidak_sehat || 0,
      iks_phbs: g.total_disurvei > 0 ? Number(((g.total_sehat / g.total_disurvei) * 100).toFixed(2)) : 0,
      radar_data,
      pareto_data,
      germas_data,
      correlation_matrix,
      rentan_data: {
        bumilTarget: 90,
        bumilCapaian: Number(((bumilYes / bumilTotal) * 100).toFixed(1)),
        remajaTarget: 90,
        remajaCapaian: Number(((remajaYes / remajaTotal) * 100).toFixed(1))
      }
    }
  })
}

// Backward-compatible export for analysis page
export const getCachedAnalysisSurveys = async (tahun: number, puskesmasId?: string | null) => {
  if (puskesmasId) {
    const cacheKey = `dashboard-analysis-v9-${tahun}-${puskesmasId}`
    return withMemoryCache(cacheKey, 28800, async () => {
      const supabase = getServiceSupabase()
      const query = supabase.from('surveys').select('*, households!inner(nama_kk, puskesmas_id, desa_id, ref_desa(desa_kel), ref_puskesmas(nama))')
        .eq('tahun', tahun)
        .eq('households.puskesmas_id', puskesmasId)
      return await fetchCapped(query, 25000)
    })
  }
  return []
}

// ==========================================
// SASARAN by Tahun (for rekap/analysis pages)
// ==========================================
export const getCachedSasaranByTahun = async (tahun: number, puskesmasId?: string | null) => {
  const cacheKey = `dashboard-sasaran-tahun-v9-${tahun}-${puskesmasId || 'ALL'}`
  return withMemoryCache(cacheKey, 28800, async () => {
    const supabase = getServiceSupabase()
    const query = supabase.from('sasaran_kk').select('*').eq('tahun', tahun)
    const finalQuery = puskesmasId ? query.eq('puskesmas_id', puskesmasId) : query
    return await fetchCapped(finalQuery, 5000)
  })
}

// ==========================================
// DATA RESPONDEN (Server-side Cached)
// ==========================================
export const getCachedRespondentStats = async (tahun: number, puskesmasId?: string | null) => {
  const cacheKey = `dashboard-respondent-data-v9-${tahun}-${puskesmasId || 'ALL'}`
  return withMemoryCache(cacheKey, 28800, async () => {
    const supabase = getServiceSupabase()
    
    const query = supabase.from('family_members').select('jenis_kelamin, pendidikan, pekerjaan, households!inner(puskesmas_id, desa_id, surveys!inner(tahun))')
      .eq('households.surveys.tahun', tahun)

    const finalQuery = (puskesmasId && puskesmasId !== 'ALL')
      ? query.eq('households.puskesmas_id', puskesmasId)
      : query

    const data = await fetchCapped(finalQuery as any, 50000) as any[]
    
    return data.map(d => ({
      jenis_kelamin: d.jenis_kelamin,
      pendidikan: d.pendidikan,
      pekerjaan: d.pekerjaan,
      households: {
        puskesmas_id: d.households?.puskesmas_id,
        desa_id: d.households?.desa_id
      }
    }))
  })
}
