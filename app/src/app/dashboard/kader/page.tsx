import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import KaderClient from './KaderClient'

export default async function KaderPage() {
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
  let refPuskesmasQuery = supabase.from('ref_puskesmas').select('*').order('nama')
  if (!isSuperAdmin) {
    refPuskesmasQuery = refPuskesmasQuery.eq('id', appUser.puskesmas_id)
  }
  const { data: refPuskesmas } = await refPuskesmasQuery

  let refDesaQuery = supabase.from('ref_desa').select('*').order('desa_kel')
  if (!isSuperAdmin) {
    refDesaQuery = refDesaQuery.eq('puskesmas_id', appUser.puskesmas_id)
  }
  const { data: refDesa } = await refDesaQuery

  // Fetch existing kader
  let kaderQuery = supabase
    .from('kader_phbs')
    .select('*, ref_puskesmas(nama), ref_desa(desa_kel)')
    .order('created_at', { ascending: false })

  if (!isSuperAdmin) {
    kaderQuery = kaderQuery.eq('puskesmas_id', appUser.puskesmas_id)
  }

  const { data: kaderData } = await kaderQuery

  return (
    <div className="p-8 pb-20">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-800">Input Kader PHBS</h2>
        <p className="text-gray-500 mt-1">
          Kelola data nama Kader atau Surveyor PHBS per desa untuk mempermudah identifikasi survei
        </p>
      </div>
      <KaderClient
        appUser={appUser as any}
        refPuskesmas={refPuskesmas || []}
        refDesa={refDesa || []}
        initialKader={kaderData || []}
      />
    </div>
  )
}
