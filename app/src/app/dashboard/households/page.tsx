import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import HouseholdsClient from './HouseholdsClient'

export default async function HouseholdsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?mode=admin')

  const { data: appUser } = await supabase
    .from('app_users')
    .select('*, ref_puskesmas(id, nama, kecamatan)')
    .eq('id', user.id)
    .single()

  const isSuperAdmin = appUser?.role === 'superadmin'

  // Superadmin: ambil semua puskesmas untuk dropdown
  let allPuskesmas: { id: string; nama: string; kecamatan: string }[] = []
  if (isSuperAdmin) {
    const { data } = await supabase
      .from('ref_puskesmas')
      .select('id, nama, kecamatan')
      .neq('nama', 'DINKES')      // Exclude DINKES dari picker
      .order('nama')
    allPuskesmas = data || []
  }

  // Admin puskesmas: ambil desa hanya dari PKM sendiri
  let desaList: { id: string; desa_kel: string; puskesmas_id: string }[] = []
  if (!isSuperAdmin && appUser?.puskesmas_id) {
    const { data } = await supabase
      .from('ref_desa')
      .select('id, desa_kel, puskesmas_id')
      .eq('puskesmas_id', appUser.puskesmas_id)
      .order('desa_kel')
    desaList = data || []
  }

  // Ambil households sesuai role
  let householdsQuery = supabase
    .from('households')
    .select('*, ref_desa(desa_kel), ref_puskesmas(nama), surveys(id, kader_phbs(nama_kader))', { count: 'exact' })
    .order('created_at', { ascending: false })
    .limit(1000)

  if (!isSuperAdmin) {
    householdsQuery = householdsQuery.eq('puskesmas_id', appUser?.puskesmas_id)
  }

  const { data: households, count } = await householdsQuery

  return (
    <HouseholdsClient
      appUser={appUser}
      isSuperAdmin={isSuperAdmin}
      allPuskesmas={allPuskesmas}
      initialDesaList={desaList}
      initialHouseholds={households || []}
      totalCount={count || 0}
    />
  )
}
