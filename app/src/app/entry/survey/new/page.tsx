import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import SurveyWizard from '@/app/dashboard/survey/new/SurveyWizard'

interface Props {
  searchParams: Promise<{ household_id?: string }>
}

export default async function EntrySurveyPage({ searchParams }: Props) {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  const user = session?.user
  if (!user) redirect('/login?mode=pwa')

  const params = await searchParams

  const { data: appUser } = await supabase
    .from('app_users')
    .select('*, ref_puskesmas(id, nama, kecamatan)')
    .eq('id', user.id)
    .single()

  const isSuperAdmin = appUser?.role === 'superadmin'

  let household = null
  if (params.household_id) {
    const query = supabase
      .from('households')
      .select('*, ref_desa(desa_kel)')
      .eq('id', params.household_id)
    
    if (!isSuperAdmin) {
      query.eq('puskesmas_id', appUser?.puskesmas_id)
    }

    const { data } = await query.single()
    household = data
  }

  const listQuery = supabase
    .from('households')
    .select('id, no_kk, nama_kk, puskesmas_id, desa_id, ref_desa(desa_kel)')
    .order('created_at', { ascending: false })
    .limit(50)

  if (!isSuperAdmin) {
    listQuery.eq('puskesmas_id', appUser?.puskesmas_id)
  }

  const { data: householdList } = await listQuery

  const normalizedList = (householdList || []).map(h => ({
    ...h,
    ref_desa: Array.isArray(h.ref_desa) ? (h.ref_desa[0] ?? null) : h.ref_desa,
  }))

  const profilingUser = {
    ...appUser,
    ref_puskesmas: isSuperAdmin 
      ? { id: 'dinkes', nama: 'Dinkes Kab. Malang', kecamatan: '-' }
      : appUser.ref_puskesmas
  }

  return (
    <SurveyWizard
      appUser={profilingUser as any}
      initialHousehold={household}
      householdList={normalizedList}
      basePath="/entry"
    />
  )
}
