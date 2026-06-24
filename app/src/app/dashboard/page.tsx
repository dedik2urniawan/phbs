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

  // Fetch data with graceful error handling — never crash the page
  let allHouseholds: any[] = []
  let surveysData: any[] = []
  let sasaranData: any[] = []
  let familyMembersData: any[] = []
  let refPuskesmas: any[] = []
  let refDesa: any[] = []

  try {
    const [households, surveys, sasaran, members, refData] = await Promise.all([
      getCachedHouseholds(puskesmasIdFilter).catch(() => []),
      getCachedSurveys(puskesmasIdFilter).catch(() => []),
      getCachedSasaran(puskesmasIdFilter).catch(() => []),
      getCachedFamilyMembers(puskesmasIdFilter).catch(() => []),
      getCachedRefData().catch(() => ({ refPuskesmas: [], refDesa: [] }))
    ])
    allHouseholds = households || []
    surveysData = surveys || []
    sasaranData = sasaran || []
    familyMembersData = members || []
    refPuskesmas = refData.refPuskesmas || []
    refDesa = refData.refDesa || []
  } catch (err) {
    console.error('[DashboardPage] Failed to fetch data:', err)
  }

  return (
    <DashboardClient 
      user={appUser} 
      allHouseholds={allHouseholds}
      surveysData={surveysData}
      refPuskesmas={refPuskesmas}
      refDesa={refDesa}
      sasaranData={sasaranData}
      familyMembersData={familyMembersData}
    />
  )
}

