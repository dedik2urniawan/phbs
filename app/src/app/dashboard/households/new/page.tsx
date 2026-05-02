import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import AddHouseholdForm from './AddHouseholdForm'

export default async function NewHouseholdPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?mode=admin')

  const { data: appUser } = await supabase
    .from('app_users')
    .select('*, ref_puskesmas(id, nama, kecamatan)')
    .eq('id', user.id)
    .single()

  const isSuperAdmin = appUser?.role === 'superadmin'

  let allPuskesmas: { id: string; nama: string }[] = []
  let allDesa: { id: string; desa_kel: string; puskesmas_id: string | null }[] = []

  if (isSuperAdmin) {
    const { data: pkm } = await supabase.from('ref_puskesmas').select('id, nama').neq('nama', 'DINKES').order('nama')
    allPuskesmas = pkm || []
    const { data: desa } = await supabase.from('ref_desa').select('id, desa_kel, puskesmas_id').order('desa_kel')
    allDesa = desa || []
  } else {
    const { data: desa } = await supabase.from('ref_desa').select('id, desa_kel, puskesmas_id').eq('puskesmas_id', appUser?.puskesmas_id).order('desa_kel')
    allDesa = desa || []
  }

  return (
    <AddHouseholdForm
      appUser={appUser}
      desaList={allDesa}
      allPuskesmas={allPuskesmas}
    />
  )
}
