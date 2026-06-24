import { createClient } from '@supabase/supabase-js'
import { unstable_cache } from 'next/cache'

// Gunakan Service Role Key untuk bypass RLS di dalam cache server-side
const getServiceSupabase = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error('Missing SUPABASE env vars for service role')
  }
  return createClient(url, key, {
    auth: { persistSession: false }
  })
}

// Helper: fetch with pagination, capped at maxRows, with error resilience
async function fetchCapped<T>(query: any, maxRows: number = 2000): Promise<T[]> {
  let allData: T[] = []
  let from = 0
  const limit = 1000

  while (allData.length < maxRows) {
    try {
      const { data, error } = await query.range(from, from + limit - 1)
      if (error) {
        console.error("[fetchCapped] Query error:", error.message)
        return allData // Return partial data instead of crashing
      }
      if (data && data.length > 0) {
        allData = allData.concat(data)
        from += limit
      }
      if (!data || data.length < limit) break
    } catch (err) {
      console.error("[fetchCapped] Exception:", err)
      return allData
    }
  }

  return allData.slice(0, maxRows)
}

// ==========================================
// DASHBOARD - Household COUNTS only (lightweight!)
// Returns { total: number, byPuskesmas: Record<string, number>, byDesa: Record<string, number> }
// ==========================================
export const getCachedHouseholdCounts = unstable_cache(
  async (puskesmasId?: string | null) => {
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
    const idsData = await fetchCapped(idsQuery as any, 50000) as { puskesmas_id: string; desa_id: string }[]
    
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
  },
  ['dashboard-hh-counts-v3'],
  { revalidate: 300 }
)

// ==========================================
// DASHBOARD - Surveys (only necessary columns, capped)
// ==========================================
export const getCachedSurveys = unstable_cache(
  async (puskesmasId?: string | null) => {
    const supabase = getServiceSupabase()
    // Select ONLY the columns DashboardClient actually needs
    // Scorecards: household_id, tahun, skor_phbs, denominator_phbs, i1..i10, i11..i17
    // Charts: households.puskesmas_id, households.desa_id, households.ref_desa, households.ref_puskesmas
    // Kader: kader_id, kader_phbs.nama_kader
    let query = supabase
      .from('surveys')
      .select('id, household_id, tahun, skor_phbs, denominator_phbs, kader_id, i1_persalinan_nakes, i2_asi_eksklusif, i3_menimbang_balita, i4_air_bersih, i5_cuci_tangan, i6_jamban_sehat, i7_psn, i8_makan_sayur_buah, i9_aktivitas_fisik, i10_tidak_merokok, i11_cek_kesehatan, i12_kunjungan_posyandu, i14_ibu_hamil, i15_ibu_hamil_ttd, i16_remaja_putri, i17_remaja_putri_ttd, households!inner(puskesmas_id, desa_id, ref_desa(desa_kel, id), ref_puskesmas(nama)), kader_phbs(nama_kader)')
    
    if (puskesmasId) {
      query = query.eq('households.puskesmas_id', puskesmasId)
    }
    
    return await fetchCapped(query, 5000)
  },
  ['dashboard-surveys-v3'],
  { revalidate: 300 }
)

// ==========================================
// DASHBOARD - Sasaran KK (always small)
// ==========================================
export const getCachedSasaran = unstable_cache(
  async (puskesmasId?: string | null) => {
    const supabase = getServiceSupabase()
    let query = supabase.from('sasaran_kk').select('*')
    if (puskesmasId) {
      query = query.eq('puskesmas_id', puskesmasId)
    }
    return await fetchCapped(query, 500)
  },
  ['dashboard-sasaran-v3'],
  { revalidate: 300 }
)

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
  ['dashboard-ref-data-v3'],
  { revalidate: 3600 }
)

// ==========================================
// REKAP - Surveys with ART responses
// ==========================================
export const getCachedRekapSurveys = unstable_cache(
  async (tahun: number, puskesmasId?: string | null) => {
    const supabase = getServiceSupabase()
    let query = supabase.from('surveys').select('*, households!inner(no_kk, nama_kk, puskesmas_id, desa_id, ref_desa(id, desa_kel)), survey_art_responses(*, family_members(nama, nik, hubungan_kk))')
      .eq('tahun', tahun)
      
    if (puskesmasId) {
      query = query.eq('households.puskesmas_id', puskesmasId)
    }
    
    return await fetchCapped(query, 3000)
  },
  ['dashboard-rekap-surveys-v3'],
  { revalidate: 300 }
)

// ==========================================
// ANALYSIS - Surveys for analysis page
// ==========================================
export const getCachedAnalysisSurveys = unstable_cache(
  async (tahun: number, puskesmasId?: string | null) => {
    const supabase = getServiceSupabase()
    let query = supabase.from('surveys').select('*, households!inner(nama_kk, puskesmas_id, desa_id, ref_desa(desa_kel), ref_puskesmas(nama))')
      .eq('tahun', tahun)
      
    if (puskesmasId) {
      query = query.eq('households.puskesmas_id', puskesmasId)
    }
    
    return await fetchCapped(query, 3000)
  },
  ['dashboard-analysis-surveys-v3'],
  { revalidate: 300 }
)

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
  ['dashboard-sasaran-by-tahun-v3'],
  { revalidate: 300 }
)
