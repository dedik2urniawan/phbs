import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import DashboardClient from './DashboardClient'
import { getCachedHouseholdCounts, getCachedRefData, getCachedSasaran, getCachedSurveys } from '@/lib/data/dashboard'

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

  // Fetch data SEQUENTIALLY to avoid concurrent memory spikes
  // Step 1: Light data first (ref data + sasaran — always small)
  let refPuskesmas: any[] = []
  let refDesa: any[] = []
  let sasaranData: any[] = []
  let householdCounts = { total: 0, byPuskesmas: {} as Record<string, number>, byDesa: {} as Record<string, number> }
  let surveysData: any[] = []

  try {
    // Step 1: Reference data (tiny, cached 1 hour)
    const refData = await getCachedRefData().catch(() => ({ refPuskesmas: [], refDesa: [] }))
    refPuskesmas = refData.refPuskesmas || []
    refDesa = refData.refDesa || []

    // Step 2: Sasaran data (small)
    sasaranData = await getCachedSasaran(puskesmasIdFilter).catch(() => []) || []

    // Step 3: Household counts (lightweight — just counts, not raw data)
    householdCounts = await getCachedHouseholdCounts(puskesmasIdFilter).catch(() => ({
      total: 0, byPuskesmas: {}, byDesa: {}
    })) || { total: 0, byPuskesmas: {}, byDesa: {} }

    // Step 4: Surveys (heaviest query — runs last, alone)
    surveysData = await getCachedSurveys(puskesmasIdFilter).catch(() => []) || []
  } catch (err) {
    console.error('[DashboardPage] Failed to fetch data:', err)
  }

  // NOTE: familyMembersData is NOT fetched server-side anymore
  // It will be loaded client-side when user clicks "Respondents" tab

  return (
    <DashboardClient 
      user={appUser} 
      householdCounts={householdCounts}
      surveysData={surveysData}
      refPuskesmas={refPuskesmas}
      refDesa={refDesa}
      sasaranData={sasaranData}
      familyMembersData={[]}
    />
  )
}
