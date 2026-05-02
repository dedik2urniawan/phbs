import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import EditHouseholdClient from '@/app/dashboard/households/[id]/edit/EditHouseholdClient'

export default async function EditEntryHouseholdPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?mode=pwa')

  const { data: appUser } = await supabase
    .from('app_users')
    .select('*, ref_puskesmas(id, nama, kecamatan)')
    .eq('id', user.id)
    .single()

  let desaList: { id: string; desa_kel: string; puskesmas_id: string }[] = []
  if (appUser?.puskesmas_id) {
    const { data } = await supabase.from('ref_desa').select('*').eq('puskesmas_id', appUser.puskesmas_id).order('desa_kel')
    desaList = data || []
  }

  const { data: household } = await supabase
    .from('households')
    .select('*')
    .eq('id', id)
    .single()

  if (!household) return <div className="p-6">Data tidak ditemukan</div>

  return (
    <EditHouseholdClient 
      household={household}
      appUser={appUser}
      desaList={desaList}
      allPuskesmas={[]}
      basePath="/entry"
    />
  )
}
