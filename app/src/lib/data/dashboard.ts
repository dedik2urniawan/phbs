import { createClient } from '@supabase/supabase-js'
import { unstable_cache } from 'next/cache'
import { fetchAll } from '../supabase/fetchUtils'

// Gunakan Service Role Key untuk bypass RLS di dalam cache server-side
// Karena unstable_cache tidak bisa mengakses cookies() dari user yang sedang login
const getServiceSupabase = () => {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        persistSession: false
      }
    }
  )
}

export const getCachedHouseholds = unstable_cache(
  async (puskesmasId?: string | null) => {
    const supabase = getServiceSupabase()
    let query = supabase.from('households').select('id, puskesmas_id, desa_id')
    
    if (puskesmasId) {
      query = query.eq('puskesmas_id', puskesmasId)
    }
    
    return await fetchAll(query)
  },
  ['dashboard-households'],
  { revalidate: 300 } // Cache 5 menit
)

export const getCachedSurveys = unstable_cache(
  async (puskesmasId?: string | null) => {
    const supabase = getServiceSupabase()
    let query = supabase.from('surveys').select('*, households!inner(puskesmas_id, desa_id, ref_desa(desa_kel, id), ref_puskesmas(nama)), kader_phbs(nama_kader)')
    
    if (puskesmasId) {
      query = query.eq('households.puskesmas_id', puskesmasId)
    }
    
    return await fetchAll(query)
  },
  ['dashboard-surveys'],
  { revalidate: 300 }
)

export const getCachedSasaran = unstable_cache(
  async (puskesmasId?: string | null) => {
    const supabase = getServiceSupabase()
    let query = supabase.from('sasaran_kk').select('*')
    
    if (puskesmasId) {
      query = query.eq('puskesmas_id', puskesmasId)
    }
    
    return await fetchAll(query)
  },
  ['dashboard-sasaran'],
  { revalidate: 300 }
)

export const getCachedFamilyMembers = unstable_cache(
  async (puskesmasId?: string | null) => {
    const supabase = getServiceSupabase()
    let query = supabase.from('family_members').select('id, jenis_kelamin, pendidikan, pekerjaan, household_id, households!inner(puskesmas_id, desa_id)')
    
    if (puskesmasId) {
      query = query.eq('households.puskesmas_id', puskesmasId)
    }
    
    return await fetchAll(query)
  },
  ['dashboard-family-members'],
  { revalidate: 300 }
)

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
  ['dashboard-ref-data'],
  { revalidate: 3600 } // Cache 1 jam untuk data referensi
)

export const getCachedRekapSurveys = unstable_cache(
  async (tahun: number, puskesmasId?: string | null) => {
    const supabase = getServiceSupabase()
    let query = supabase.from('surveys').select('*, households!inner(no_kk, nama_kk, puskesmas_id, desa_id, ref_desa(id, desa_kel)), survey_art_responses(*, family_members(nama, nik, hubungan_kk))')
      .eq('tahun', tahun)
      
    if (puskesmasId) {
      query = query.eq('households.puskesmas_id', puskesmasId)
    }
    
    return await fetchAll(query)
  },
  ['dashboard-rekap-surveys'],
  { revalidate: 300 }
)

export const getCachedAnalysisSurveys = unstable_cache(
  async (tahun: number, puskesmasId?: string | null) => {
    const supabase = getServiceSupabase()
    let query = supabase.from('surveys').select('*, households!inner(nama_kk, puskesmas_id, desa_id, ref_desa(desa_kel), ref_puskesmas(nama))')
      .eq('tahun', tahun)
      
    if (puskesmasId) {
      query = query.eq('households.puskesmas_id', puskesmasId)
    }
    
    return await fetchAll(query)
  },
  ['dashboard-analysis-surveys'],
  { revalidate: 300 }
)

export const getCachedSasaranByTahun = unstable_cache(
  async (tahun: number, puskesmasId?: string | null) => {
    const supabase = getServiceSupabase()
    let query = supabase.from('sasaran_kk').select('*').eq('tahun', tahun)
    
    if (puskesmasId) {
      query = query.eq('puskesmas_id', puskesmasId)
    }
    
    return await fetchAll(query)
  },
  ['dashboard-sasaran-by-tahun'],
  { revalidate: 300 }
)
