// Entry households list — reuse dashboard logic, tapi locked ke PKM sendiri
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import HouseholdsClient from '@/app/dashboard/households/HouseholdsClient'

export default async function EntryHouseholdsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?mode=pwa')

  const { data: appUser } = await supabase
    .from('app_users')
    .select('*, ref_puskesmas(id, nama, kecamatan)')
    .eq('id', user.id)
    .single()

  const isSuperAdmin = appUser?.role === 'superadmin'

  let allPuskesmas: { id: string; nama: string; kecamatan: string }[] = []
  if (isSuperAdmin) {
    const { data: pkm } = await supabase.from('ref_puskesmas').select('id, nama, kecamatan').neq('nama', 'DINKES').order('nama')
    allPuskesmas = pkm || []
  }

  const { data: desaList } = await supabase
    .from('ref_desa')
    .select('id, desa_kel, puskesmas_id')
    .eq('puskesmas_id', appUser?.puskesmas_id || '')
    .order('desa_kel')

  const query = supabase
    .from('households')
    .select('*, ref_desa(desa_kel), ref_puskesmas(nama), surveys(id, kader_phbs(nama_kader))', { count: 'exact' })

  if (!isSuperAdmin) {
    query.eq('puskesmas_id', appUser?.puskesmas_id)
  }

  const { data: households, count } = await query
    .order('created_at', { ascending: false })
    .limit(50)

  return (
    <HouseholdsClient
      appUser={appUser}
      isSuperAdmin={isSuperAdmin}
      allPuskesmas={allPuskesmas}
      initialDesaList={desaList || []}
      initialHouseholds={households || []}
      totalCount={count || 0}
      basePath="/entry"
    />
  )
}
