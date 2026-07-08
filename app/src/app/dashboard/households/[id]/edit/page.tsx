import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import EditHouseholdClient from './EditHouseholdClient'

export default async function EditHouseholdPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  const user = session?.user
  if (!user) redirect('/login')

  const { data: appUser } = await supabase
    .from('app_users')
    .select('*, ref_puskesmas(id, nama, kecamatan)')
    .eq('id', user.id)
    .single()

  const isSuperAdmin = appUser?.role === 'superadmin'

  let allPuskesmas: { id: string; nama: string; kecamatan: string }[] = []
  if (isSuperAdmin) {
    const { data } = await supabase.from('ref_puskesmas').select('*').neq('nama', 'DINKES').order('nama')
    allPuskesmas = data || []
  }

  let desaList: { id: string; desa_kel: string; puskesmas_id: string }[] = []
  const filterPuskesmasId = isSuperAdmin ? null : appUser?.puskesmas_id
  if (filterPuskesmasId) {
    const { data } = await supabase.from('ref_desa').select('*').eq('puskesmas_id', filterPuskesmasId).order('desa_kel')
    desaList = data || []
  } else if (isSuperAdmin) {
    const { data } = await supabase.from('ref_desa').select('*').order('desa_kel')
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
      allPuskesmas={allPuskesmas}
      basePath="/dashboard"
    />
  )
}
