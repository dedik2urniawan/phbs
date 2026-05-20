import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import SasaranClient from './SasaranClient'

export default async function SasaranPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?mode=admin')

  const { data: appUser } = await supabase
    .from('app_users')
    .select('*, ref_puskesmas(id, nama, kecamatan)')
    .eq('id', user.id)
    .single()

  if (!appUser || (appUser.role !== 'superadmin' && appUser.role !== 'admin_puskesmas')) {
    redirect('/dashboard')
  }

  const isSuperAdmin = appUser.role === 'superadmin'

  // Fetch reference data
  const { data: refPuskesmas } = await supabase.from('ref_puskesmas').select('*').order('nama')
  const { data: refDesa } = await supabase.from('ref_desa').select('*').order('desa_kel')

  // Fetch existing sasaran
  let sasaranQuery = supabase
    .from('sasaran_kk')
    .select('*, ref_puskesmas(nama), ref_desa(desa_kel)')
    .order('tahun', { ascending: false })

  if (!isSuperAdmin) {
    sasaranQuery = sasaranQuery.eq('puskesmas_id', appUser.puskesmas_id)
  }

  const { data: sasaranData } = await sasaranQuery

  return (
    <div className="p-8 pb-20">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-800">Input Sasaran KK</h2>
        <p className="text-gray-500 mt-1">
          Kelola data jumlah Rumah Tangga sasaran survei PHBS per desa dan tahun
        </p>
      </div>
      <SasaranClient
        appUser={appUser as any}
        refPuskesmas={refPuskesmas || []}
        refDesa={refDesa || []}
        initialSasaran={sasaranData || []}
      />
    </div>
  )
}
