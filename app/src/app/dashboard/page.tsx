import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import DashboardClient from './DashboardClient'
import { getCachedFamilyMembers, getCachedHouseholds, getCachedRefData, getCachedSasaran, getCachedSurveys } from '@/lib/data/dashboard'

export default async function DashboardPage() {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?mode=admin')

  const { data: appUser } = await supabase
    .from('app_users')
    .select('*, ref_puskesmas(id, nama, kecamatan)')
    .eq('id', user.id)
    .single()

  const isSuperAdmin = appUser?.role === 'superadmin'
  const puskesmasIdFilter = isSuperAdmin ? null : appUser?.puskesmas_id

  // Fetch all data using cached functions concurrently
  const [
    allHouseholds,
    surveysData,
    sasaranData,
    familyMembersData,
    { refPuskesmas, refDesa }
  ] = await Promise.all([
    getCachedHouseholds(puskesmasIdFilter),
    getCachedSurveys(puskesmasIdFilter),
    getCachedSasaran(puskesmasIdFilter),
    getCachedFamilyMembers(puskesmasIdFilter),
    getCachedRefData()
  ])

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
