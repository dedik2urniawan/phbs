import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import DashboardClient from './DashboardClient'

export default async function DashboardPage() {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?mode=admin')

  const { data: appUser } = await supabase
    .from('app_users')
    .select('*, ref_puskesmas(id, nama, kecamatan)')
    .eq('id', user.id)
    .single()

  // Statistik dasar
  let statsQuery = supabase.from('households').select('id', { count: 'exact', head: true })
  if (appUser?.role === 'admin_puskesmas') {
    statsQuery = statsQuery.eq('puskesmas_id', appUser.puskesmas_id)
  }
  const { count: totalKK } = await statsQuery

  let surveyQuery = supabase.from('surveys').select('*, households!inner(puskesmas_id)')
    .eq('tahun', new Date().getFullYear())

  if (appUser?.role === 'admin_puskesmas') {
    surveyQuery = surveyQuery.eq('households.puskesmas_id', appUser.puskesmas_id)
  }

  const { data: surveysData } = await surveyQuery

  const kkDisurvei = surveysData?.length || 0;

  const calculateSkor = (s: any) => {
    const boolKeys = ['i4_air_bersih','i5_cuci_tangan','i6_jamban_sehat','i7_psn',
      'i8_makan_sayur_buah','i9_aktivitas_fisik','i10_tidak_merokok','i11_cek_kesehatan',
      'i12_kunjungan_posyandu','i14_ibu_hamil','i16_remaja_putri']
    const nullableKeys = ['i1_persalinan_nakes','i2_asi_eksklusif','i3_menimbang_balita',
      'i15_ibu_hamil_ttd','i17_remaja_putri_ttd']
    let total = 0; let max = 0;
    boolKeys.forEach(k => { max++; if (s[k]) total++ })
    nullableKeys.forEach(k => { 
      if (s[k] !== undefined && s[k] !== null) { max++; if (s[k]) total++ }
    })
    return max > 0 ? Math.round((total/max)*100) : 0
  }

  const capaianPhbs = surveysData?.filter(s => calculateSkor(s) >= 75).length || 0;
  const persentaseCapaian = kkDisurvei > 0 ? Math.round((capaianPhbs / kkDisurvei) * 100) : 0;
  const persentaseDisurvei = (totalKK || 0) > 0 ? Math.round((kkDisurvei / (totalKK || 1)) * 100) : 0;

  return (
    <DashboardClient 
      user={appUser} 
      totalKK={totalKK || 0}
      kkDisurvei={kkDisurvei}
      persentaseDisurvei={persentaseDisurvei}
      capaianPhbs={persentaseCapaian}
    />
  )
}
