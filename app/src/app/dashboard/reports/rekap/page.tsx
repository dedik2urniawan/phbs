import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import RekapClient from './RekapClient'
import { getCachedRekapSurveys, getCachedSasaranByTahun, getCachedRefData } from '@/lib/data/dashboard'

export default async function RekapLaporanPage({ searchParams }: { searchParams: Promise<{ tahun?: string }> }) {
  const params = await searchParams
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?mode=admin')

  const { data: appUser } = await supabase
    .from('app_users')
    .select('*, ref_puskesmas(id, nama, kecamatan)')
    .eq('id', user.id)
    .single()

  const isSuperAdmin = appUser?.role === 'superadmin'
  const puskesmasIdFilter = isSuperAdmin ? null : appUser?.puskesmas_id
  const currentYear = new Date().getFullYear()
  const selectedTahun = params?.tahun ? parseInt(params.tahun) : currentYear

  // Fetch all data using cached functions concurrently
  const [
    surveysData,
    sasaranData,
    { refPuskesmas: puskesmasList, refDesa: desaList }
  ] = await Promise.all([
    getCachedRekapSurveys(selectedTahun, puskesmasIdFilter),
    getCachedSasaranByTahun(selectedTahun, puskesmasIdFilter),
    getCachedRefData()
  ])

  // Generate available years (e.g., from 2025 to currentYear + 1)
  const availableYears = Array.from({ length: Math.max(2, currentYear - 2025 + 2) }, (_, i) => 2025 + i)

  return (
    <div className="p-8 pb-20">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-800">Rekap Laporan PHBS</h2>
        <p className="text-gray-500 mt-1">
          {appUser?.role === 'superadmin' ? 'Tingkat Kabupaten Malang' : `Tingkat ${appUser?.ref_puskesmas?.nama || 'Puskesmas'}`}
        </p>
      </div>

      <RekapClient 
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
