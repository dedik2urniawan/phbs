import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import AddHouseholdForm from '@/app/dashboard/households/new/AddHouseholdForm'

export default async function EntryNewHouseholdPage() {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  const user = session?.user
  if (!user) redirect('/login?mode=pwa')

  const { data: appUser } = await supabase
    .from('app_users')
    .select('*, ref_puskesmas(id, nama, kecamatan)')
    .eq('id', user.id)
    .single()

  const isSuperAdmin = appUser?.role === 'superadmin'

  let allPuskesmas: { id: string; nama: string }[] = []
  let allDesa: { id: string; desa_kel: string; puskesmas_id?: string }[] = []

  if (isSuperAdmin) {
    const { data: pkm } = await supabase.from('ref_puskesmas').select('id, nama').neq('nama', 'DINKES').order('nama')
    allPuskesmas = pkm || []
    const { data: desa } = await supabase.from('ref_desa').select('id, desa_kel, puskesmas_id').order('desa_kel')
    allDesa = desa || []
  } else {
    const { data: desa } = await supabase.from('ref_desa').select('id, desa_kel, puskesmas_id').eq('puskesmas_id', appUser?.puskesmas_id).order('desa_kel')
    allDesa = desa || []
  }

  // Profiling for header
  const profilingUser = {
    ...appUser,
    ref_puskesmas: isSuperAdmin 
      ? { id: 'dinkes', nama: 'Dinkes Kab. Malang', kecamatan: '-' }
      : appUser.ref_puskesmas
  }

  return (
    <AddHouseholdForm 
      appUser={profilingUser as any} 
      desaList={allDesa} 
      allPuskesmas={allPuskesmas} 
      backHref="/entry/households" 
    />
  )
}
