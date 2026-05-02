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
  let statsQuery = supabase.from('households').select('id', { count: 'exact', head: true })
  if (appUser?.role === 'admin_puskesmas') {
    statsQuery = statsQuery.eq('puskesmas_id', appUser.puskesmas_id)
  }
  const { count: totalKK } = await statsQuery

  let surveyQuery = supabase.from('surveys').select('id', { count: 'exact', head: true })
    .eq('tahun', new Date().getFullYear())
  if (appUser?.role === 'admin_puskesmas') {
    surveyQuery = surveyQuery.eq('households.puskesmas_id', appUser.puskesmas_id)
  }

  return (
    <DashboardClient 
      user={appUser} 
      totalKK={totalKK || 0}
    />
  )
}
