import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import DashboardClient from './DashboardClient'

export default async function DashboardPage() {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?mode=admin')

  const { data: appUser } = await supabase
    .from('app_users')
    .select('*, ref_puskesmas(id, nama, kecamatan)')
    .eq('id', user.id)
    .single()

  // Statistik dasar
  let statsQuery = supabase.from('households').select('id, puskesmas_id, desa_id')
  if (appUser?.role === 'admin_puskesmas') {
    statsQuery = statsQuery.eq('puskesmas_id', appUser.puskesmas_id)
  }
  const { data: allHouseholds } = await statsQuery

  let surveyQuery = supabase.from('surveys').select('*, households!inner(puskesmas_id, desa_id, ref_desa(desa_kel), ref_puskesmas(nama))')
    .eq('tahun', new Date().getFullYear())

  if (appUser?.role === 'admin_puskesmas') {
    surveyQuery = surveyQuery.eq('households.puskesmas_id', appUser.puskesmas_id)
  }

  const { data: surveysData } = await surveyQuery

  const { data: refPuskesmas } = await supabase.from('ref_puskesmas').select('*').order('nama')
  const { data: refDesa } = await supabase.from('ref_desa').select('*').order('desa_kel')

  const kkDisurvei = surveysData?.length || 0;

  return (
    <DashboardClient 
      user={appUser} 
      allHouseholds={allHouseholds || []}
      surveysData={surveysData || []}
      refPuskesmas={refPuskesmas || []}
      refDesa={refDesa || []}
    />
  )
}
