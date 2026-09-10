import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import DashboardClient from './DashboardClient'
import { getCachedRefData, getCachedSasaran, getCachedSurveys, getCachedDashboardAggregates } from '@/lib/data/dashboard'

export default async function DashboardPage() {
  const supabase = await createClient()
  
  const { data: { session } } = await supabase.auth.getSession()
  const user = session?.user
  if (!user) redirect('/login?mode=admin')

  const { data: appUser } = await supabase
    .from('app_users')
    .select('*, ref_puskesmas(id, nama, kecamatan)')
    .eq('id', user.id)
    .single()

  const isSuperAdmin = appUser?.role === 'superadmin'
  const puskesmasIdFilter = isSuperAdmin ? null : appUser?.puskesmas_id
  const currentYear = new Date().getFullYear()

  let refPuskesmas: any[] = []
  let refDesa: any[] = []
  let sasaranData: any[] = []
  let summaryData: any = null
  let surveysData: any[] = []

  try {
    const [refData, sasaran, aggregates, surveys] = await Promise.all([
      getCachedRefData().catch(() => ({ refPuskesmas: [], refDesa: [] })),
      getCachedSasaran(puskesmasIdFilter).catch(() => []) || [],
      getCachedDashboardAggregates(currentYear, puskesmasIdFilter).catch(() => null),
      getCachedSurveys(puskesmasIdFilter).catch(() => []) || []
    ])

    refPuskesmas = refData.refPuskesmas || []
    refDesa = refData.refDesa || []
    sasaranData = sasaran || []
    summaryData = aggregates
    surveysData = surveys || []
  } catch (err) {
    console.error('[DashboardPage] Failed to fetch data:', err)
  }

  const byPuskesmas: Record<string, number> = {}
  const byDesa: Record<string, number> = {}
  if (summaryData?.by_puskesmas) {
    for (const p of summaryData.by_puskesmas) {
      byPuskesmas[p.puskesmas_id] = p.total_kk
    }
  }
  if (summaryData?.by_desa) {
    for (const d of summaryData.by_desa) {
      byDesa[d.desa_id] = d.total_kk
    }
  }
  const householdCounts = {
    total: summaryData?.global?.total_kk || 0,
    byPuskesmas,
    byDesa
  }

  return (
    <DashboardClient 
      user={appUser} 
      householdCounts={householdCounts}
      surveysData={surveysData}
      summaryData={summaryData}
      refPuskesmas={refPuskesmas}
      refDesa={refDesa}
      sasaranData={sasaranData}
      familyMembersData={[]}
    />
  )
}
