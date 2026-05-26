import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import ReportsClient from '../ReportsClient'

export default async function AnalisisLaporanPage({ searchParams }: { searchParams: Promise<{ tahun?: string }> }) {
  const params = await searchParams
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?mode=admin')

  const { data: appUser } = await supabase
    .from('app_users')
    .select('*, ref_puskesmas(id, nama, kecamatan)')
    .eq('id', user.id)
    .single()

  const currentYear = new Date().getFullYear()
  const selectedTahun = params?.tahun ? parseInt(params.tahun) : currentYear

  let surveyQuery = supabase.from('surveys').select('*, households!inner(nama_kk, puskesmas_id, desa_id, ref_desa(desa_kel), ref_puskesmas(nama))')
    .eq('tahun', selectedTahun)

  if (appUser?.role !== 'superadmin' && appUser?.puskesmas_id) {
    surveyQuery = surveyQuery.eq('households.puskesmas_id', appUser.puskesmas_id)
  }

  const { data: surveysData } = await surveyQuery
  
  // Fetch reference data for filters
  const { data: puskesmasList } = await supabase.from('ref_puskesmas').select('id, nama').order('nama')
  const { data: desaList } = await supabase.from('ref_desa').select('id, puskesmas_id, desa_kel').order('desa_kel')

  // Fetch sasaran_kk for target vs achievement analysis
  let sasaranQuery = supabase.from('sasaran_kk').select('*').eq('tahun', selectedTahun)
  if (appUser?.role !== 'superadmin' && appUser?.puskesmas_id) {
    sasaranQuery = sasaranQuery.eq('puskesmas_id', appUser.puskesmas_id)
  }
  const { data: sasaranData } = await sasaranQuery

  // Generate available years dynamically (from 2025 to currentYear + 1)
  const availableYears = Array.from({ length: Math.max(2, currentYear - 2025 + 2) }, (_, i) => 2025 + i)

  return (
    <div className="p-8 pb-20">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-800">Analisis Laporan PHBS</h2>
        <p className="text-gray-500 mt-1">
          {appUser?.role === 'superadmin' ? 'Tingkat Kabupaten Malang' : `Tingkat ${appUser?.ref_puskesmas?.nama || 'Puskesmas'}`}
        </p>
      </div>

      <ReportsClient 
        appUser={appUser as any} 
        surveysData={surveysData || []}
        puskesmasList={puskesmasList || []}
        desaList={desaList || []}
        sasaranData={sasaranData || []}
        selectedTahun={selectedTahun}
        availableYears={availableYears}
      />
    </div>
  )
}
