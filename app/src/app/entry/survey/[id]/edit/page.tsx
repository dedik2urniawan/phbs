import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import EditSurveyClient from '@/components/EditSurveyClient'

export default async function EntryEditSurveyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  const user = session?.user
  if (!user) redirect('/login?mode=pwa')

  const { data: appUser } = await supabase
    .from('app_users')
    .select('*, ref_puskesmas(id, nama, kecamatan)')
    .eq('id', user.id)
    .single()

  const { data: survey } = await supabase
    .from('surveys')
    .select('*')
    .eq('id', id)
    .single()

  if (!survey) return <div className="p-6">Survei tidak ditemukan.</div>

  const { data: household } = await supabase
    .from('households')
    .select('*, ref_desa(desa_kel)')
    .eq('id', survey.household_id)
    .single()

  return (
    <EditSurveyClient 
      appUser={appUser} 
      survey={survey} 
      household={household} 
      basePath="/entry" 
    />
  )
}
