import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import SurveyWizard from './SurveyWizard'

interface Props {
  searchParams: Promise<{ household_id?: string }>
}

export default async function NewSurveyPage({ searchParams }: Props) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const params = await searchParams
  const householdId = params.household_id

  const { data: appUser } = await supabase
    .from('app_users')
    .select('*, ref_puskesmas(id, nama, kecamatan)')
    .eq('id', user.id)
    .single()

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
  const { data: householdListRaw } = await supabase
    .from('households')
    .select('id, no_kk, nama_kk, ref_desa(desa_kel)')
    .eq('puskesmas_id', appUser?.puskesmas_id)
    .order('created_at', { ascending: false })
    .limit(50)

  // Normalize ref_desa dari array ke object
  const householdList = (householdListRaw || []).map(h => ({
    ...h,
    ref_desa: Array.isArray(h.ref_desa) ? (h.ref_desa[0] ?? null) : h.ref_desa,
  }))

  return (
    <SurveyWizard
      appUser={appUser}
      initialHousehold={household}
      householdList={householdList || []}
    />
  )
}
