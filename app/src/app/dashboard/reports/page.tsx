import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import ReportsClient from './ReportsClient'

export default async function ReportsPage() {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?mode=admin')

  const { data: appUser } = await supabase
    .from('app_users')
    .select('*, ref_puskesmas(id, nama, kecamatan)')
    .eq('id', user.id)
    .single()

  let rpcParams = {}
  if (appUser?.role !== 'superadmin' && appUser?.puskesmas_id) {
    rpcParams = { p_puskesmas_id: appUser.puskesmas_id }
  }

  const { data: analyticsData } = await supabase.rpc('get_phbs_analytics', rpcParams)

  return (
    <div className="p-8 pb-20">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-800">Laporan & Analisis PHBS</h2>
        <p className="text-gray-500 mt-1">
          {appUser?.role === 'superadmin' ? 'Tingkat Kabupaten Malang' : `Tingkat ${appUser?.ref_puskesmas?.nama || 'Puskesmas'}`}
        </p>
      </div>

      <ReportsClient appUser={appUser as any} dbAnalytics={analyticsData} />
    </div>
  )
}
