import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import EntryHomeClient from './EntryHomeClient'

export default async function EntryPage() {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  const user = session?.user
  if (!user) redirect('/login?mode=pwa')

  const { data: appUser } = await supabase
    .from('app_users')
    .select('*, ref_puskesmas(id, nama, kecamatan)')
    .eq('id', user.id)
    .single()

  const { data: households, count } = await supabase
    .from('households')
    .select('*, ref_desa(desa_kel)', { count: 'exact' })
    .eq('puskesmas_id', appUser?.puskesmas_id)
    .order('created_at', { ascending: false })
    .limit(10)

  const { count: surveyCount } = await supabase
    .from('surveys')
    .select('id', { count: 'exact', head: true })
    .eq('tahun', new Date().getFullYear())

  return (
    <EntryHomeClient
      appUser={appUser}
      recentHouseholds={households || []}
      totalKK={count || 0}
      surveyCount={surveyCount || 0}
    />
  )
}
