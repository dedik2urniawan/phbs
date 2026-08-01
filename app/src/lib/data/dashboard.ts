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
//
// PENTING: Supabase PostgREST query builder adalah MUTABLE.
// Memanggil .range() berkali-kali pada objek yang SAMA akan
// menyebabkan semua request mengeksekusi range terakhir saja,
// sehingga data menjadi kosong atau duplikat.
// Solusi: tetap sequential, tapi efisien dengan page-size 1000.
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
      // KRITIS: Setiap panggilan .range() pada Supabase builder mengembalikan
      // INSTANCE BARU (karena itu aman untuk sequential, tapi TIDAK untuk parallel
      // karena semua batch akan menggunakan .range() pada builder yang sama).
      const { data, error } = await queryBuilder.range(from, from + limit - 1)

      if (error) {
        console.error('[fetchCapped] Query error:', error.message)
        break
      }

      if (!data || data.length === 0) break

      allData = allData.concat(data)

      // Jika data yang dikembalikan < limit, artinya sudah halaman terakhir
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
// DASHBOARD - Household COUNTS only (lightweight!)
// Returns { total: number, byPuskesmas: Record<string, number>, byDesa: Record<string, number> }
// ==========================================
export const getCachedHouseholdCounts = async (puskesmasId?: string | null) => {
  const cacheKey = `dashboard-hh-counts-v7-${puskesmasId || 'ALL'}`
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
// DASHBOARD - Surveys (only necessary columns)
// ==========================================
export const getCachedSurveys = async (puskesmasId?: string | null) => {
  const cacheKey = `dashboard-surveys-v7-${puskesmasId || 'ALL'}`
  return withMemoryCache(cacheKey, 28800, async () => {
    const supabase = getServiceSupabase()
    const query = supabase
      .from('surveys')
      .select('id, household_id, tahun, skor_phbs, denominator_phbs, kader_id, i1_persalinan_nakes, i2_asi_eksklusif, i3_menimbang_balita, i4_air_bersih, i5_cuci_tangan, i6_jamban_sehat, i7_psn, i8_makan_sayur_buah, i9_aktivitas_fisik, i10_tidak_merokok, i11_cek_kesehatan, i12_kunjungan_posyandu, i14_ibu_hamil, i15_ibu_hamil_ttd, i16_remaja_putri, i17_remaja_putri_ttd, households!inner(puskesmas_id, desa_id, ref_desa(desa_kel, id), ref_puskesmas(nama)), kader_phbs(nama_kader)')

    // Filter pushed to DB level (not post-fetch) to reduce payload size
    const finalQuery = puskesmasId
      ? query.eq('households.puskesmas_id', puskesmasId)
      : query
    
    return await fetchCapped(finalQuery, 200000)
  })
}

// ==========================================
// DASHBOARD - Sasaran KK (always small)
// ==========================================
export const getCachedSasaran = async (puskesmasId?: string | null) => {
  const cacheKey = `dashboard-sasaran-v7-${puskesmasId || 'ALL'}`
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
  ['dashboard-ref-v5'],
  { revalidate: 28800 }
)

// ==========================================
// REKAP - Surveys with ART responses
// ==========================================
export const getCachedRekapSurveys = async (tahun: number, puskesmasId?: string | null) => {
  const cacheKey = `dashboard-rekap-v7-${tahun}-${puskesmasId || 'ALL'}`
  return withMemoryCache(cacheKey, 28800, async () => {
    const supabase = getServiceSupabase()
    const query = supabase.from('surveys').select('*, households!inner(no_kk, nama_kk, puskesmas_id, desa_id, ref_desa(id, desa_kel), ref_puskesmas(nama)), survey_art_responses(*, family_members(nama, nik, hubungan_kk))')
      .eq('tahun', tahun)

    const finalQuery = puskesmasId
      ? query.eq('households.puskesmas_id', puskesmasId)
      : query
    
    return await fetchCapped(finalQuery, 200000)
  })
}

// ==========================================
// ANALYSIS - Surveys for analysis page
// ==========================================
export const getCachedAnalysisSurveys = async (tahun: number, puskesmasId?: string | null) => {
  const cacheKey = `dashboard-analysis-v7-${tahun}-${puskesmasId || 'ALL'}`
  return withMemoryCache(cacheKey, 28800, async () => {
    const supabase = getServiceSupabase()
    const query = supabase.from('surveys').select('*, households!inner(nama_kk, puskesmas_id, desa_id, ref_desa(desa_kel), ref_puskesmas(nama))')
      .eq('tahun', tahun)

    const finalQuery = puskesmasId
      ? query.eq('households.puskesmas_id', puskesmasId)
      : query
    
    return await fetchCapped(finalQuery, 200000)
  })
}

// ==========================================
// SASARAN by Tahun (for rekap/analysis pages)
// ==========================================
export const getCachedSasaranByTahun = async (tahun: number, puskesmasId?: string | null) => {
  const cacheKey = `dashboard-sasaran-tahun-v7-${tahun}-${puskesmasId || 'ALL'}`
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
  const cacheKey = `dashboard-respondent-data-v7-${tahun}-${puskesmasId || 'ALL'}`
  return withMemoryCache(cacheKey, 28800, async () => {
    const supabase = getServiceSupabase()
    
    const query = supabase.from('family_members').select('jenis_kelamin, pendidikan, pekerjaan, households!inner(puskesmas_id, desa_id, surveys!inner(tahun))')
      .eq('households.surveys.tahun', tahun)

    const finalQuery = (puskesmasId && puskesmasId !== 'ALL')
      ? query.eq('households.puskesmas_id', puskesmasId)
      : query

    const data = await fetchCapped(finalQuery as any, 200000) as any[]
    
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
