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

// Helper: fetch with parallel pagination for ultra-fast loading speed
async function fetchCapped<T>(query: any, maxRows: number = 200000): Promise<T[]> {
  let allData: T[] = []
  let from = 0
  const limit = 1000
  const concurrency = 5

  while (allData.length < maxRows) {
    try {
      const promises = []
      for (let i = 0; i < concurrency; i++) {
        const batchFrom = from + (i * limit)
        if (batchFrom >= maxRows) break
        promises.push(query.range(batchFrom, batchFrom + limit - 1))
      }

      const results = await Promise.all(promises)
      let shouldStop = false

      for (const res of results) {
        if (res.error) {
          console.error("[fetchCapped] Query error:", res.error.message)
          shouldStop = true
          break
        }
        if (res.data && res.data.length > 0) {
          allData = allData.concat(res.data)
          if (res.data.length < limit) {
            shouldStop = true
          }
        } else {
          shouldStop = true
        }
      }

      from += concurrency * limit
      if (shouldStop) break
    } catch (err) {
      console.error("[fetchCapped] Exception:", err)
      break
    }
  }

  return allData.slice(0, maxRows)
}

// ==========================================
// DASHBOARD - Household COUNTS only (lightweight!)
// Returns { total: number, byPuskesmas: Record<string, number>, byDesa: Record<string, number> }
// ==========================================
export const getCachedHouseholdCounts = async (puskesmasId?: string | null) => {
  const cacheKey = `dashboard-hh-counts-v6-${puskesmasId || 'ALL'}`
  return withMemoryCache(cacheKey, 28800, async () => {
    const supabase = getServiceSupabase()
    
    // Get total count — head:true means no data, just count
    let countQuery = supabase.from('households').select('id', { count: 'exact', head: true })
    if (puskesmasId) {
      countQuery = countQuery.eq('puskesmas_id', puskesmasId)
    }
    const { count: totalCount } = await countQuery
    
    // Get per-puskesmas/desa breakdown — fetch only IDs (very light ~3 bytes per row)
    let idsQuery = supabase.from('households').select('puskesmas_id, desa_id')
    if (puskesmasId) {
      idsQuery = idsQuery.eq('puskesmas_id', puskesmasId)
    }
    const idsData = await fetchCapped(idsQuery as any, 200000) as { puskesmas_id: string; desa_id: string }[]
    
    // Aggregate in-memory (tiny objects)
    const byPuskesmas: Record<string, number> = {}
    const byDesa: Record<string, number> = {}
    for (const row of idsData) {
      byPuskesmas[row.puskesmas_id] = (byPuskesmas[row.puskesmas_id] || 0) + 1
      byDesa[row.desa_id] = (byDesa[row.desa_id] || 0) + 1
    }
    
    return {
      total: totalCount || idsData.length,
      byPuskesmas,
      byDesa
    }
  })
}

// ==========================================
// DASHBOARD - Surveys (only necessary columns, capped)
// ==========================================
export const getCachedSurveys = async (puskesmasId?: string | null) => {
  const cacheKey = `dashboard-surveys-v6-${puskesmasId || 'ALL'}`
  return withMemoryCache(cacheKey, 28800, async () => {
    const supabase = getServiceSupabase()
    let query = supabase
      .from('surveys')
      .select('id, household_id, tahun, skor_phbs, denominator_phbs, kader_id, i1_persalinan_nakes, i2_asi_eksklusif, i3_menimbang_balita, i4_air_bersih, i5_cuci_tangan, i6_jamban_sehat, i7_psn, i8_makan_sayur_buah, i9_aktivitas_fisik, i10_tidak_merokok, i11_cek_kesehatan, i12_kunjungan_posyandu, i14_ibu_hamil, i15_ibu_hamil_ttd, i16_remaja_putri, i17_remaja_putri_ttd, households!inner(puskesmas_id, desa_id, ref_desa(desa_kel, id), ref_puskesmas(nama)), kader_phbs(nama_kader)')
    
    if (puskesmasId) {
      query = query.eq('households.puskesmas_id', puskesmasId)
    }
    
    return await fetchCapped(query, 200000)
  })
}

// ==========================================
// DASHBOARD - Sasaran KK (always small)
// ==========================================
export const getCachedSasaran = async (puskesmasId?: string | null) => {
  const cacheKey = `dashboard-sasaran-v6-${puskesmasId || 'ALL'}`
  return withMemoryCache(cacheKey, 28800, async () => {
    const supabase = getServiceSupabase()
    let query = supabase.from('sasaran_kk').select('*')
    if (puskesmasId) {
      query = query.eq('puskesmas_id', puskesmasId)
    }
    return await fetchCapped(query, 5000)
  })
}

// ==========================================
// REF DATA - Puskesmas & Desa (always small, cache 1 hour)
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
  ['dashboard-ref-v4'],
  { revalidate: 28800 } // Referensi data tidak sering berubah, cache 24 jam
)

// ==========================================
// REKAP - Surveys with ART responses
// ==========================================
export const getCachedRekapSurveys = async (tahun: number, puskesmasId?: string | null) => {
  const cacheKey = `dashboard-rekap-v6-${tahun}-${puskesmasId || 'ALL'}`
  return withMemoryCache(cacheKey, 28800, async () => {
    const supabase = getServiceSupabase()
    let query = supabase.from('surveys').select('*, households!inner(no_kk, nama_kk, puskesmas_id, desa_id, ref_desa(id, desa_kel), ref_puskesmas(nama)), survey_art_responses(*, family_members(nama, nik, hubungan_kk))')
      .eq('tahun', tahun)
      
    if (puskesmasId) {
      query = query.eq('households.puskesmas_id', puskesmasId)
    }
    
    return await fetchCapped(query, 200000)
  })
}

// ==========================================
// ANALYSIS - Surveys for analysis page
// ==========================================
export const getCachedAnalysisSurveys = async (tahun: number, puskesmasId?: string | null) => {
  const cacheKey = `dashboard-analysis-v5-${tahun}-${puskesmasId || 'ALL'}`
  return withMemoryCache(cacheKey, 28800, async () => {
    const supabase = getServiceSupabase()
    let query = supabase.from('surveys').select('*, households!inner(nama_kk, puskesmas_id, desa_id, ref_desa(desa_kel), ref_puskesmas(nama))')
      .eq('tahun', tahun)
      
    if (puskesmasId) {
      query = query.eq('households.puskesmas_id', puskesmasId)
    }
    
    return await fetchCapped(query, 50000)
  })
}

// ==========================================
// SASARAN by Tahun (for rekap/analysis pages)
// ==========================================
export const getCachedSasaranByTahun = unstable_cache(
  async (tahun: number, puskesmasId?: string | null) => {
    const supabase = getServiceSupabase()
    let query = supabase.from('sasaran_kk').select('*').eq('tahun', tahun)
    if (puskesmasId) {
      query = query.eq('puskesmas_id', puskesmasId)
    }
    return await fetchCapped(query, 500)
  },
  ['dashboard-sasaran-by-tahun-v4'],
  { revalidate: 28800 } // Diubah ke 8 jam
)

// ==========================================
// DATA RESPONDEN (Server-side Cached)
// ==========================================
export const getCachedRespondentStats = async (tahun: number, puskesmasId?: string | null) => {
  const cacheKey = `dashboard-respondent-data-v1-${tahun}-${puskesmasId || 'ALL'}`
  return withMemoryCache(cacheKey, 28800, async () => {
    const supabase = getServiceSupabase()
    
    // We join family_members -> households -> surveys to filter by tahun, puskesmas
    let query = supabase.from('family_members').select('jenis_kelamin, pendidikan, pekerjaan, households!inner(puskesmas_id, desa_id, surveys!inner(tahun))')
      .eq('households.surveys.tahun', tahun)
      
    if (puskesmasId && puskesmasId !== 'ALL') {
      query = query.eq('households.puskesmas_id', puskesmasId)
    }

    const data = await fetchCapped(query as any, 100000) as any[]
    
    // Format data to match what the client expects (flattening households)
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
