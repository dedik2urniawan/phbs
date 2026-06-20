import { createClient } from '@/lib/supabase/server'
import { fetchAll } from '@/lib/supabase/fetchUtils'
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
  const allHouseholds = await fetchAll(statsQuery)

  let surveyQuery = supabase.from('surveys').select('*, households!inner(puskesmas_id, desa_id, ref_desa(desa_kel, id), ref_puskesmas(nama))')

  if (appUser?.role === 'admin_puskesmas') {
    surveyQuery = surveyQuery.eq('households.puskesmas_id', appUser.puskesmas_id)
  }

  const surveysData = await fetchAll(surveyQuery)

  const { data: refPuskesmas } = await supabase.from('ref_puskesmas').select('*').order('nama')
  const { data: refDesa } = await supabase.from('ref_desa').select('*').order('desa_kel')

  // Sasaran KK
  let sasaranQuery = supabase.from('sasaran_kk').select('*')
  if (appUser?.role === 'admin_puskesmas') {
    sasaranQuery = sasaranQuery.eq('puskesmas_id', appUser.puskesmas_id)
  }
  const sasaranData = await fetchAll(sasaranQuery)

  // Fetch family members for Statistics Responden
  let membersQuery = supabase.from('family_members').select('id, jenis_kelamin, pendidikan, pekerjaan, household_id, households!inner(puskesmas_id, desa_id)')
  if (appUser?.role === 'admin_puskesmas') {
    membersQuery = membersQuery.eq('households.puskesmas_id', appUser.puskesmas_id)
  }
  const familyMembersData = await fetchAll(membersQuery)

  return (
    <DashboardClient 
      user={appUser} 
      allHouseholds={allHouseholds || []}
      surveysData={surveysData || []}
      refPuskesmas={refPuskesmas || []}
      refDesa={refDesa || []}
      sasaranData={sasaranData || []}
      familyMembersData={familyMembersData || []}
    />
  )
}
