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

  let surveyQuery = supabase.from('surveys').select('*, households!inner(puskesmas_id, ref_desa(desa_kel))')
    .eq('tahun', new Date().getFullYear())

  if (appUser?.role !== 'superadmin' && appUser?.puskesmas_id) {
    surveyQuery = surveyQuery.eq('households.puskesmas_id', appUser.puskesmas_id)
  }

  const { data: surveysData } = await surveyQuery
  let analyticsData: any = null

  if (surveysData && surveysData.length > 0) {
    const total_surveys = surveysData.length;
    
    const boolKeys = ['i4_air_bersih','i5_cuci_tangan','i6_jamban_sehat','i7_psn',
      'i8_makan_sayur_buah','i9_aktivitas_fisik','i10_tidak_merokok','i11_cek_kesehatan',
      'i12_kunjungan_posyandu','i14_ibu_hamil','i16_remaja_putri']
    const nullableKeys = ['i1_persalinan_nakes','i2_asi_eksklusif','i3_menimbang_balita',
      'i15_ibu_hamil_ttd','i17_remaja_putri_ttd']
      
    let total_sehat = 0;
    
    const indicators: Record<string, {yes: number, no: number}> = {
      'i1_persalinan_nakes': {yes: 0, no: 0},
      'i2_asi_eksklusif': {yes: 0, no: 0},
      'i3_menimbang_balita': {yes: 0, no: 0},
      'i4_air_bersih': {yes: 0, no: 0},
      'i5_cuci_tangan': {yes: 0, no: 0},
      'i6_jamban_sehat': {yes: 0, no: 0},
      'i7_psn': {yes: 0, no: 0},
      'i8_makan_sayur_buah': {yes: 0, no: 0},
      'i9_aktivitas_fisik': {yes: 0, no: 0},
      'i10_tidak_merokok': {yes: 0, no: 0},
    }
    
    let bumilTotal = 0, bumilYes = 0;
    let remajaTotal = 0, remajaYes = 0;
    
    const germasByDesa: Record<string, {posyandu: number, ckg: number, total: number}> = {}

    surveysData.forEach((s: any) => {
      let skorTotal = 0; let skorMax = 0;
      boolKeys.forEach(k => { skorMax++; if (s[k]) skorTotal++ })
      nullableKeys.forEach(k => { 
        if (s[k] !== undefined && s[k] !== null) { skorMax++; if (s[k]) skorTotal++ }
      })
      const skor = skorMax > 0 ? Math.round((skorTotal/skorMax)*100) : 0;
      if (skor >= 75) total_sehat++;
      
      Object.keys(indicators).forEach(k => {
        if (s[k] !== undefined && s[k] !== null) {
          if (s[k]) indicators[k].yes++;
          else indicators[k].no++;
        }
      })
      
      if (s.i14_ibu_hamil) {
        bumilTotal++;
        if (s.i15_ibu_hamil_ttd) bumilYes++;
      }
      
      if (s.i16_remaja_putri) {
        remajaTotal++;
        if (s.i17_remaja_putri_ttd) remajaYes++;
      }
      
      const desaName = s.households?.ref_desa?.desa_kel || 'Unknown'
      if (!germasByDesa[desaName]) germasByDesa[desaName] = {posyandu: 0, ckg: 0, total: 0}
      germasByDesa[desaName].total++;
      if (s.i12_kunjungan_posyandu) germasByDesa[desaName].posyandu++;
      if (s.i11_cek_kesehatan) germasByDesa[desaName].ckg++;
    });
    
    const radar_data = [
      { subject: 'Persalinan Nakes', A: indicators['i1_persalinan_nakes'].yes / (indicators['i1_persalinan_nakes'].yes + indicators['i1_persalinan_nakes'].no || 1) * 100, fullMark: 100 },
      { subject: 'ASI Eksklusif', A: indicators['i2_asi_eksklusif'].yes / (indicators['i2_asi_eksklusif'].yes + indicators['i2_asi_eksklusif'].no || 1) * 100, fullMark: 100 },
      { subject: 'Timbang Balita', A: indicators['i3_menimbang_balita'].yes / (indicators['i3_menimbang_balita'].yes + indicators['i3_menimbang_balita'].no || 1) * 100, fullMark: 100 },
      { subject: 'Air Bersih', A: indicators['i4_air_bersih'].yes / (indicators['i4_air_bersih'].yes + indicators['i4_air_bersih'].no || 1) * 100, fullMark: 100 },
      { subject: 'Cuci Tangan', A: indicators['i5_cuci_tangan'].yes / (indicators['i5_cuci_tangan'].yes + indicators['i5_cuci_tangan'].no || 1) * 100, fullMark: 100 },
      { subject: 'Jamban Sehat', A: indicators['i6_jamban_sehat'].yes / (indicators['i6_jamban_sehat'].yes + indicators['i6_jamban_sehat'].no || 1) * 100, fullMark: 100 },
      { subject: 'Bebas Jentik', A: indicators['i7_psn'].yes / (indicators['i7_psn'].yes + indicators['i7_psn'].no || 1) * 100, fullMark: 100 },
      { subject: 'Makan Sayur Buah', A: indicators['i8_makan_sayur_buah'].yes / (indicators['i8_makan_sayur_buah'].yes + indicators['i8_makan_sayur_buah'].no || 1) * 100, fullMark: 100 },
      { subject: 'Aktivitas Fisik', A: indicators['i9_aktivitas_fisik'].yes / (indicators['i9_aktivitas_fisik'].yes + indicators['i9_aktivitas_fisik'].no || 1) * 100, fullMark: 100 },
      { subject: 'Tidak Merokok', A: indicators['i10_tidak_merokok'].yes / (indicators['i10_tidak_merokok'].yes + indicators['i10_tidak_merokok'].no || 1) * 100, fullMark: 100 },
    ].map(r => ({ ...r, A: Math.round(r.A) }))
    
    const pareto_data = radar_data.map(r => ({
      name: r.subject,
      failure: 100 - r.A
    }))
    
    const germas_data = Object.keys(germasByDesa).map(d => ({
      name: d,
      Posyandu: Math.round((germasByDesa[d].posyandu / germasByDesa[d].total) * 100),
      CKG: Math.round((germasByDesa[d].ckg / germasByDesa[d].total) * 100),
    }))
    
    analyticsData = {
      radar_data,
      pareto_data,
      germas_data,
      rentan_data: {
        bumilTarget: 90, bumilCapaian: bumilTotal ? Math.round((bumilYes/bumilTotal)*100) : 0,
        remajaTarget: 90, remajaCapaian: remajaTotal ? Math.round((remajaYes/remajaTotal)*100) : 0,
      },
      total_surveys,
      iks_phbs: Math.round((total_sehat/total_surveys)*100),
      total_sehat,
      total_tidak_sehat: total_surveys - total_sehat,
    }
  }

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
