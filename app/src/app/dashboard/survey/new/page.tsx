import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import SurveyWizard from './SurveyWizard'

interface Props {
  searchParams: Promise<{ household_id?: string }>
}

export default async function NewSurveyPage({ searchParams }: Props) {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  const user = session?.user
  if (!user) redirect('/login')

  const params = await searchParams
  const householdId = params.household_id

  const { data: appUser } = await supabase
    .from('app_users')
    .select('*, ref_puskesmas(id, nama, kecamatan)')
    .eq('id', user.id)
    .single()

  const isSuperAdmin = appUser?.role === 'superadmin'

  // Superadmin: ambil semua puskesmas untuk dropdown
  let allPuskesmas: { id: string; nama: string; kecamatan: string }[] = []
  if (isSuperAdmin) {
    const { data } = await supabase
      .from('ref_puskesmas')
      .select('id, nama, kecamatan')
      .neq('nama', 'DINKES')
      .order('nama')
    allPuskesmas = data || []
  }

  // Admin puskesmas: ambil desa hanya dari PKM sendiri
  let desaList: { id: string; desa_kel: string; puskesmas_id: string }[] = []
  if (!isSuperAdmin && appUser?.puskesmas_id) {
    const { data } = await supabase
      .from('ref_desa')
      .select('id, desa_kel, puskesmas_id')
      .eq('puskesmas_id', appUser.puskesmas_id)
      .order('desa_kel')
    desaList = data || []
  }

  // Ambil household jika ada
  let household = null
  if (householdId) {
    const { data } = await supabase
      .from('households')
      .select('*, ref_desa(desa_kel)')
      .eq('id', householdId)
      .single()
    household = data
  }

  // Ambil daftar households untuk dipilih (jika tidak ada household_id)
  let householdsQuery = supabase
    .from('households')
    .select('id, no_kk, nama_kk, puskesmas_id, desa_id, alamat, rt, rw, ref_desa(desa_kel), ref_puskesmas(nama)')
    .order('created_at', { ascending: false })
    .limit(1000)

  if (!isSuperAdmin) {
    householdsQuery = householdsQuery.eq('puskesmas_id', appUser?.puskesmas_id)
  }

  const { data: householdListRaw } = await householdsQuery

  // Normalize ref_desa dari array ke object
  const householdList = (householdListRaw || []).map(h => ({
    ...h,
    ref_desa: Array.isArray(h.ref_desa) ? (h.ref_desa[0] ?? null) : h.ref_desa,
    ref_puskesmas: Array.isArray(h.ref_puskesmas) ? (h.ref_puskesmas[0] ?? null) : h.ref_puskesmas,
  }))

  return (
    <SurveyWizard
      appUser={appUser}
      initialHousehold={household}
      householdList={householdList || []}
      isSuperAdmin={isSuperAdmin}
      allPuskesmas={allPuskesmas}
      initialDesaList={desaList}
    />
  )
}
