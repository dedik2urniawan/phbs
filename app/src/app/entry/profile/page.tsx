import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import ProfileClient from './ProfileClient'

export default async function EntryProfilePage() {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  const user = session?.user
  if (!user) redirect('/login?mode=pwa')

  const { data: appUser } = await supabase
    .from('app_users')
    .select('*, ref_puskesmas(id, nama, kecamatan)')
    .eq('id', user.id)
    .single()

  const { count: totalKK } = await supabase
    .from('households')
    .select('id', { count: 'exact', head: true })
    .eq('puskesmas_id', appUser?.puskesmas_id)

  const { count: totalSurvey } = await supabase
    .from('surveys')
    .select('id', { count: 'exact', head: true })
    .eq('tahun', new Date().getFullYear())

  return <ProfileClient appUser={appUser} totalKK={totalKK || 0} totalSurvey={totalSurvey || 0} />
}
