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

// Helper: fetch with pagination but capped at maxRows to prevent OOM
async function fetchCapped<T>(query: any, maxRows: number = 5000): Promise<T[]> {
  let allData: T[] = []
  let from = 0
  const limit = 1000

  while (allData.length < maxRows) {
    const { data, error } = await query.range(from, from + limit - 1)
    if (error) {
      console.error("Error in fetchCapped:", error.message)
      return allData // Return what we have instead of crashing
    }
    if (data && data.length > 0) {
      allData = allData.concat(data)
      from += limit
    }
    if (!data || data.length < limit) break
  }

  return allData.slice(0, maxRows)
}

// ==========================================
// DASHBOARD - Households (hanya id, puskesmas_id, desa_id)
// ==========================================
export const getCachedHouseholds = unstable_cache(
  async (puskesmasId?: string | null) => {
    const supabase = getServiceSupabase()
    let query = supabase.from('households').select('id, puskesmas_id, desa_id')
    
    if (puskesmasId) {
      query = query.eq('puskesmas_id', puskesmasId)
    }
    
    // Households hanya 3 kolom ringan, aman sampai 10k
    return await fetchCapped(query, 10000)
  },
  ['dashboard-households-v2'],
  { revalidate: 300 }
)

// ==========================================
// DASHBOARD - Surveys (+ join households & kader)
// ==========================================
export const getCachedSurveys = unstable_cache(
  async (puskesmasId?: string | null) => {
    const supabase = getServiceSupabase()
    let query = supabase.from('surveys').select('*, households!inner(puskesmas_id, desa_id, ref_desa(desa_kel, id), ref_puskesmas(nama)), kader_phbs(nama_kader)')
    
    if (puskesmasId) {
      query = query.eq('households.puskesmas_id', puskesmasId)
    }
    
    // Surveys bisa banyak kolom, cap at 5000
    return await fetchCapped(query, 5000)
  },
  ['dashboard-surveys-v2'],
  { revalidate: 300 }
)

// ==========================================
// DASHBOARD - Sasaran KK
// ==========================================
export const getCachedSasaran = unstable_cache(
  async (puskesmasId?: string | null) => {
    const supabase = getServiceSupabase()
    let query = supabase.from('sasaran_kk').select('*')
    
    if (puskesmasId) {
      query = query.eq('puskesmas_id', puskesmasId)
    }
    
    // Sasaran KK biasanya kecil (<500 baris)
    return await fetchCapped(query, 2000)
  },
  ['dashboard-sasaran-v2'],
  { revalidate: 300 }
)

// ==========================================
// DASHBOARD - Family Members (hanya kolom yang dibutuhkan)
// ==========================================
export const getCachedFamilyMembers = unstable_cache(
  async (puskesmasId?: string | null) => {
    const supabase = getServiceSupabase()
    let query = supabase.from('family_members').select('id, jenis_kelamin, pendidikan, pekerjaan, household_id, households!inner(puskesmas_id, desa_id)')
    
    if (puskesmasId) {
      query = query.eq('households.puskesmas_id', puskesmasId)
    }
    
    // Family members paling berat — cap ketat 5000 baris
    return await fetchCapped(query, 5000)
  },
  ['dashboard-family-members-v2'],
  { revalidate: 300 }
)

// ==========================================
// REF DATA - Puskesmas & Desa (sangat ringan)
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
  ['dashboard-ref-data-v2'],
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
    
    return await fetchCapped(query, 5000)
  },
  ['dashboard-rekap-surveys-v2'],
  { revalidate: 300 }
)

// ==========================================
// ANALYSIS - Surveys for analysis
// ==========================================
export const getCachedAnalysisSurveys = unstable_cache(
  async (tahun: number, puskesmasId?: string | null) => {
    const supabase = getServiceSupabase()
    let query = supabase.from('surveys').select('*, households!inner(nama_kk, puskesmas_id, desa_id, ref_desa(desa_kel), ref_puskesmas(nama))')
      .eq('tahun', tahun)
      
    if (puskesmasId) {
      query = query.eq('households.puskesmas_id', puskesmasId)
    }
    
    return await fetchCapped(query, 5000)
  },
  ['dashboard-analysis-surveys-v2'],
  { revalidate: 300 }
)

// ==========================================
// SASARAN by Tahun
// ==========================================
export const getCachedSasaranByTahun = unstable_cache(
  async (tahun: number, puskesmasId?: string | null) => {
    const supabase = getServiceSupabase()
    let query = supabase.from('sasaran_kk').select('*').eq('tahun', tahun)
    
    if (puskesmasId) {
      query = query.eq('puskesmas_id', puskesmasId)
    }
    
    return await fetchCapped(query, 2000)
  },
  ['dashboard-sasaran-by-tahun-v2'],
  { revalidate: 300 }
)
