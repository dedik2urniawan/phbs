'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { AppUser } from '@/lib/types'
import dynamic from 'next/dynamic'
import { 
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  PieChart, Pie, Cell
} from 'recharts'

const DynamicMap = dynamic(() => import('@/components/MapChart'), {
  ssr: false,
  loading: () => <div className="w-full h-[450px] bg-gray-100 rounded-xl animate-pulse flex items-center justify-center">Memuat Peta Spasial...</div>
})

interface Props {
  appUser: AppUser
  surveysData?: any[]
  puskesmasList?: any[]
  desaList?: any[]
  sasaranData?: any[]
  selectedTahun: number
  availableYears: number[]
}

const INDICATORS_LIST = [
  { id: 'iks', label: 'Indeks Keluarga Sehat (IKS)' },
  { id: 'i1_persalinan_nakes', label: '1. Persalinan Nakes' },
  { id: 'i2_asi_eksklusif', label: '2. ASI Eksklusif' },
  { id: 'i3_menimbang_balita', label: '3. Timbang Balita' },
  { id: 'i4_air_bersih', label: '4. Air Bersih' },
  { id: 'i5_cuci_tangan', label: '5. Cuci Tangan' },
  { id: 'i6_jamban_sehat', label: '6. Jamban Sehat' },
  { id: 'i7_psn', label: '7. Bebas Jentik' },
  { id: 'i8_makan_sayur_buah', label: '8. Makan Sayur Buah' },
  { id: 'i9_aktivitas_fisik', label: '9. Aktivitas Fisik' },
  { id: 'i10_tidak_merokok', label: '10. Tidak Merokok' },
]

const COLORS = ['#10b981', '#ef4444']

// Pearson Correlation Coefficient Calculator
function calculateCorrelation(surveys: any[], key1: string, key2: string): number {
  const dataPoints = surveys.filter(s => 
    s[key1] !== undefined && s[key1] !== null &&
    s[key2] !== undefined && s[key2] !== null
  )

  if (dataPoints.length < 2) return 0

  const x: number[] = dataPoints.map(s => s[key1] ? 1 : 0)
  const y: number[] = dataPoints.map(s => s[key2] ? 1 : 0)

  const n = x.length
  const sumX = x.reduce((a, b) => a + b, 0)
  const sumY = y.reduce((a, b) => a + b, 0)
  const sumXSq = x.reduce((a, b) => a + b * b, 0)
  const sumYSq = y.reduce((a, b) => a + b * b, 0)
  const sumXY = x.reduce((sum, val, idx) => sum + val * y[idx], 0)

  const numerator = n * sumXY - sumX * sumY
  const denominator = Math.sqrt((n * sumXSq - sumX * sumX) * (n * sumYSq - sumY * sumY))

  if (denominator === 0) return 0
  return parseFloat((numerator / denominator).toFixed(2))
}

const getCorrelationColor = (val: number) => {
  const abs = Math.abs(val)
  if (abs >= 0.7) return 'bg-rose-600 text-white'
  if (abs >= 0.4) return 'bg-amber-500 text-white'
  if (abs >= 0.1) return 'bg-emerald-500 text-white'
  return 'bg-gray-200 text-gray-700'
}

export default function ReportsClient({ appUser, surveysData = [], puskesmasList = [], desaList = [], sasaranData = [], selectedTahun, availableYears }: Props) {
  const router = useRouter()
  const isSuperAdmin = appUser.role === 'superadmin'
  const [selectedPuskesmas, setSelectedPuskesmas] = useState<string>(
    isSuperAdmin ? 'all' : String(appUser.puskesmas_id)
  )
  const [selectedDesa, setSelectedDesa] = useState<string>('all')
  const [selectedIndicator, setSelectedIndicator] = useState<string>('iks')

  const filteredDesa = useMemo(() => {
    if (!desaList) return []
    if (selectedPuskesmas === 'all') return desaList
    return desaList.filter(d => String(d.puskesmas_id) === String(selectedPuskesmas))
  }, [desaList, selectedPuskesmas])

  const filteredSurveys = useMemo(() => {
    if (!surveysData) return []
    return surveysData.filter(s => {
      const pId = String(s.households?.puskesmas_id)
      const dId = String(s.households?.desa_id)
      
      if (selectedPuskesmas !== 'all' && pId !== selectedPuskesmas) return false
      if (selectedDesa !== 'all' && dId !== selectedDesa) return false
      return true
    })
  }, [surveysData, selectedPuskesmas, selectedDesa])

  // Sasaran Target KK filtered
  const sasaranFiltered = useMemo(() => {
    return sasaranData.filter(s => {
      if (s.tahun !== selectedTahun) return false
      if (isSuperAdmin && selectedPuskesmas !== 'all') {
        if (String(s.puskesmas_id) !== selectedPuskesmas) return false
      } else if (!isSuperAdmin) {
        if (String(s.puskesmas_id) !== String(appUser.puskesmas_id)) return false
      }
      if (selectedDesa !== 'all') {
        if (String(s.desa_id) !== selectedDesa) return false
      }
      return true
    })
  }, [sasaranData, selectedTahun, selectedPuskesmas, selectedDesa, isSuperAdmin, appUser.puskesmas_id])

  const totalSasaranKK = useMemo(() => sasaranFiltered.reduce((sum, s) => sum + (s.jumlah_kk || 0), 0), [sasaranFiltered])

  // Aggregate stats
  const computedAnalytics = useMemo(() => {
    const total_surveys = filteredSurveys.length
    if (total_surveys === 0) return null

    let total_sehat = 0
    
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
    
    let bumilTotal = 0, bumilYes = 0
    let remajaTotal = 0, remajaYes = 0
    
    const germasByGroup: Record<string, {posyandu: number, ckg: number, total: number}> = {}

    filteredSurveys.forEach((s: any) => {
      if (s.is_rt_sehat) total_sehat++
      
      Object.keys(indicators).forEach(k => {
        if (s[k] !== undefined && s[k] !== null) {
          if (s[k]) indicators[k].yes++
          else indicators[k].no++
        }
      })
      
      if (s.i14_ibu_hamil) {
        bumilTotal++
        if (s.i15_ibu_hamil_ttd) bumilYes++
      }
      
      if (s.i16_remaja_putri) {
        remajaTotal++
        if (s.i17_remaja_putri_ttd) remajaYes++
      }
      
      // Grouping based on context: Puskesmas level if Superadmin & ALL, else Desa level
      let groupName = ''
      if (isSuperAdmin && selectedPuskesmas === 'all') {
        const pId = s.households?.puskesmas_id
        const pObj = puskesmasList?.find(p => String(p.id) === String(pId))
        groupName = pObj?.nama || 'Unknown'
      } else {
        groupName = s.households?.ref_desa?.desa_kel || 'Unknown'
      }

      if (!germasByGroup[groupName]) {
        germasByGroup[groupName] = {posyandu: 0, ckg: 0, total: 0}
      }
      germasByGroup[groupName].total++
      if (s.i12_kunjungan_posyandu) germasByGroup[groupName].posyandu++
      if (s.i11_cek_kesehatan) germasByGroup[groupName].ckg++
    })
    
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
    })).sort((a, b) => b.failure - a.failure)
    
    const germas_data = Object.keys(germasByGroup).map(g => ({
      name: g,
      Posyandu: Math.round((germasByGroup[g].posyandu / germasByGroup[g].total) * 100),
      CKG: Math.round((germasByGroup[g].ckg / germasByGroup[g].total) * 100),
    })).slice(0, 15) // Limit to top 15 groups for visual clarity
    
    const correlation_matrix = [
      { ind1: 'Tidak Merokok', ind2: 'Sayur & Buah', value: calculateCorrelation(filteredSurveys, 'i10_tidak_merokok', 'i8_makan_sayur_buah') },
      { ind1: 'Tidak Merokok', ind2: 'Aktivitas Fisik', value: calculateCorrelation(filteredSurveys, 'i10_tidak_merokok', 'i9_aktivitas_fisik') },
      { ind1: 'Sayur & Buah', ind2: 'Aktivitas Fisik', value: calculateCorrelation(filteredSurveys, 'i8_makan_sayur_buah', 'i9_aktivitas_fisik') },
      { ind1: 'Cuci Tangan (CTPS)', ind2: 'Jamban Sehat', value: calculateCorrelation(filteredSurveys, 'i5_cuci_tangan', 'i6_jamban_sehat') },
      { ind1: 'Cuci Tangan (CTPS)', ind2: 'Air Bersih', value: calculateCorrelation(filteredSurveys, 'i5_cuci_tangan', 'i4_air_bersih') },
      { ind1: 'Bebas Jentik (PSN)', ind2: 'Jamban Sehat', value: calculateCorrelation(filteredSurveys, 'i7_psn', 'i6_jamban_sehat') },
    ]

    return {
      radar_data,
      pareto_data,
      germas_data,
      correlation_matrix,
      rentan_data: {
        bumilTarget: 90, bumilCapaian: bumilTotal ? Math.round((bumilYes/bumilTotal)*100) : 0,
        remajaTarget: 90, remajaCapaian: remajaTotal ? Math.round((remajaYes/remajaTotal)*100) : 0,
      },
      total_surveys,
      iks_phbs: Math.round((total_sehat/total_surveys)*100),
      total_sehat,
      total_tidak_sehat: total_surveys - total_sehat,
    }
  }, [filteredSurveys, isSuperAdmin, selectedPuskesmas, puskesmasList])

  const totalKK = computedAnalytics?.total_surveys || 0
  const iks = computedAnalytics?.iks_phbs || 0
  const cakupanPersen = totalSasaranKK > 0 ? Math.round((totalKK / totalSasaranKK) * 100) : 100

  // Fallbacks
  const dataRadar = computedAnalytics?.radar_data || []
  const dataPareto = computedAnalytics?.pareto_data?.slice(0, 5) || []
  const dataGermas = computedAnalytics?.germas_data || []
  const dataRentan = computedAnalytics?.rentan_data || { bumilTarget: 90, bumilCapaian: 0, remajaTarget: 90, remajaCapaian: 0 }
  const dataCorrelation = computedAnalytics?.correlation_matrix || []
  const dataDonut = computedAnalytics ? [
    { name: 'Sehat', value: computedAnalytics.total_sehat },
    { name: 'Tidak Sehat', value: computedAnalytics.total_tidak_sehat },
  ] : []

  // Dynamic IKS Classification Badge (hanya 2 klasifikasi)
  const iksCategory = iks >= 50 ? 'Keluarga Sehat' : 'Keluarga Tidak Sehat'
  const iksBadgeColor = iks >= 50 ? 'bg-emerald-100 text-emerald-800 border-emerald-200' : 'bg-rose-100 text-rose-800 border-rose-200'

  // Dynamic Cakupan Badge
  let statusCakupan = 'Belum Mulai'
  let statusBadgeColor = 'bg-gray-100 text-gray-800 border-gray-200'
  if (cakupanPersen >= 100) {
    statusCakupan = 'Selesai'
    statusBadgeColor = 'bg-emerald-100 text-emerald-800 border-emerald-200'
  } else if (cakupanPersen > 0) {
    statusCakupan = 'Sedang Berjalan'
    statusBadgeColor = 'bg-amber-100 text-amber-800 border-amber-200'
  } else if (totalSasaranKK === 0) {
    statusCakupan = 'Selesai'
    statusBadgeColor = 'bg-emerald-100 text-emerald-800 border-emerald-200'
  }

  // Calculate dynamic regional scores for map choropleth
  const regionalScores = useMemo(() => {
    const scores: Record<string, { total: number, yes: number, score: number }> = {}

    filteredSurveys.forEach((s: any) => {
      let regionName = ''
      if (isSuperAdmin && selectedPuskesmas === 'all') {
        // Use directly joined ref_puskesmas.nama — most accurate, avoids lookup mismatch
        regionName = s.households?.ref_puskesmas?.nama || ''
        // Fallback: lookup from puskesmasList if join is not available
        if (!regionName) {
          const pId = s.households?.puskesmas_id
          const pObj = puskesmasList?.find(p => String(p.id) === String(pId))
          regionName = pObj?.nama || ''
        }
      } else {
        // Desa level: use desa_kel from joined ref_desa
        regionName = s.households?.ref_desa?.desa_kel || ''
      }

      if (!regionName) return

      if (!scores[regionName]) {
        scores[regionName] = { total: 0, yes: 0, score: 0 }
      }

      if (selectedIndicator === 'iks') {
        scores[regionName].total++
        if (s.is_rt_sehat) {
          scores[regionName].yes++
        }
      } else {
        const val = s[selectedIndicator]
        if (val !== undefined && val !== null) {
          scores[regionName].total++
          if (val) {
            scores[regionName].yes++
          }
        }
      }
    })

    Object.keys(scores).forEach(name => {
      const item = scores[name]
      item.score = item.total > 0 ? Math.round((item.yes / item.total) * 100) : 0
    })

    return scores
  }, [filteredSurveys, selectedPuskesmas, selectedIndicator, isSuperAdmin, puskesmasList])

  return (
    <div className="space-y-6">
      
      {/* Filters */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col md:flex-row gap-4 items-end">
        {/* Year Filter */}
        <div className="w-full md:w-48">
          <label className="block text-xs font-semibold text-gray-500 mb-1">Tahun Analisis</label>
          <select
            value={selectedTahun}
            onChange={(e) => router.push(`?tahun=${e.target.value}`)}
            className="w-full bg-gray-50 border border-gray-200 text-gray-800 text-sm rounded-lg focus:ring-emerald-500 focus:border-emerald-500 block p-2.5 transition-colors font-medium"
          >
            {availableYears.map(year => (
              <option key={year} value={year}>{year}</option>
            ))}
          </select>
        </div>

        {isSuperAdmin && puskesmasList && (
          <div className="flex-1 w-full">
            <label className="block text-xs font-semibold text-gray-500 mb-1">Puskesmas</label>
            <select
              value={selectedPuskesmas}
              onChange={(e) => {
                setSelectedPuskesmas(e.target.value)
                setSelectedDesa('all')
              }}
              className="w-full bg-gray-50 border border-gray-200 text-gray-800 text-sm rounded-lg focus:ring-emerald-500 focus:border-emerald-500 block p-2.5 transition-colors font-medium"
            >
              <option value="all">Semua Puskesmas</option>
              {puskesmasList.map(p => (
                <option key={p.id} value={p.id}>{p.nama}</option>
              ))}
            </select>
          </div>
        )}
        
        {desaList && (
          <div className="flex-1 w-full">
            <label className="block text-xs font-semibold text-gray-500 mb-1">Desa / Kelurahan</label>
            <select
              value={selectedDesa}
              onChange={(e) => setSelectedDesa(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 text-gray-800 text-sm rounded-lg focus:ring-emerald-500 focus:border-emerald-500 block p-2.5 transition-colors font-medium"
            >
              <option value="all">Semua Desa</option>
              {filteredDesa.map(d => (
                <option key={d.id} value={d.id}>{d.desa_kel}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* 1. Top Row: Executive Summary KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* KPI 1: Target Sasaran KK */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between hover:shadow-md transition-shadow">
          <div>
            <p className="text-xs text-gray-400 font-semibold uppercase tracking-wider">Total Sasaran KK</p>
            <p className="text-3xl font-extrabold text-gray-800 mt-2">{totalSasaranKK.toLocaleString('id-ID')} <span className="text-xs font-normal text-gray-400">KK</span></p>
            <p className="text-xs text-gray-500 mt-2 font-medium">🎯 Target KK survei tahun {selectedTahun}</p>
          </div>
          <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center text-xl font-bold">🎯</div>
        </div>

        {/* KPI 2: Total KK Disurvei */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between hover:shadow-md transition-shadow">
          <div>
            <p className="text-xs text-gray-400 font-semibold uppercase tracking-wider">Total KK Disurvei</p>
            <p className="text-3xl font-extrabold text-gray-800 mt-2">{totalKK.toLocaleString('id-ID')} <span className="text-xs font-normal text-gray-400">KK</span></p>
            <p className="text-xs text-gray-500 mt-2 font-medium">📋 Realisasi survei aktif</p>
          </div>
          <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center text-xl font-bold">📋</div>
        </div>

        {/* KPI 3: Cakupan Survei % */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-between hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-400 font-semibold uppercase tracking-wider">Cakupan Survei</p>
              <p className="text-3xl font-extrabold text-emerald-600 mt-1">{cakupanPersen}%</p>
            </div>
            <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border ${statusBadgeColor}`}>
              {statusCakupan}
            </span>
          </div>
          <div className="mt-4">
            <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
              <div 
                className="bg-gradient-to-r from-emerald-400 to-emerald-500 h-full rounded-full transition-all duration-1000" 
                style={{ width: `${Math.min(100, cakupanPersen)}%` }}
              ></div>
            </div>
            <p className="text-[10px] text-gray-400 mt-1">Kemajuan realisasi terhadap target wilayah</p>
          </div>
        </div>

        {/* KPI 4: Indeks Keluarga Sehat (IKS) */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-between hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-400 font-semibold uppercase tracking-wider">IKS Wilayah</p>
              <p className="text-3xl font-extrabold text-emerald-600 mt-1">{iks}%</p>
            </div>
            <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border ${iksBadgeColor}`}>
              {iksCategory}
            </span>
          </div>
          <div className="mt-4 flex items-center gap-3">
            {dataDonut.length > 0 ? (
              <>
                <div className="w-8 h-8">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={dataDonut}
                        cx="50%"
                        cy="50%"
                        innerRadius={8}
                        outerRadius={14}
                        paddingAngle={2}
                        dataKey="value"
                        stroke="none"
                      >
                        {dataDonut.map((entry: any, index: number) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex-1 flex gap-2 text-[10px] font-bold text-gray-500">
                  <span className="text-emerald-600">{dataDonut[0]?.value || 0} Sehat</span>
                  <span className="text-rose-500">{dataDonut[1]?.value || 0} Tidak</span>
                </div>
              </>
            ) : (
              <p className="text-[10px] text-gray-400">Tidak ada data survei di wilayah terpilih</p>
            )}
          </div>
        </div>
      </div>

      {/* 2. Middle Row: Pemetaan PHBS Rumah Tangga (Whole Page) */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
          <div>
            <h3 className="text-lg font-bold text-gray-800">Pemetaan PHBS Rumah Tangga</h3>
            <p className="text-xs text-gray-500 mt-1">
              Visualisasi chloropleth capaian indikator kesehatan per wilayah ({isSuperAdmin && selectedPuskesmas === 'all' ? 'Tingkat Puskesmas' : 'Tingkat Desa'})
            </p>
          </div>
          <div className="w-full md:w-64">
            <label className="block text-xs font-semibold text-gray-500 mb-1">Indikator Pemetaan</label>
            <select
              value={selectedIndicator}
              onChange={(e) => setSelectedIndicator(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 text-gray-800 text-sm font-semibold rounded-lg focus:ring-emerald-500 focus:border-emerald-500 block p-2 transition-colors"
            >
              {INDICATORS_LIST.map(ind => (
                <option key={ind.id} value={ind.id}>{ind.label}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="w-full min-h-[450px]">
          <DynamicMap 
            appUser={appUser} 
            selectedIndicator={selectedIndicator} 
            selectedIndicatorLabel={INDICATORS_LIST.find(ind => ind.id === selectedIndicator)?.label || ''}
            selectedPuskesmas={selectedPuskesmas}
            puskesmasList={puskesmasList}
            regionalScores={regionalScores}
          />
        </div>
      </div>

      {/* Radar Chart: Capaian 10 Indikator PHBS (Whole Page below Map) */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col">
        <h3 className="text-lg font-bold text-gray-800">Capaian 10 Indikator PHBS</h3>
        <p className="text-xs text-gray-500 mt-1 mb-6">Identifikasi kesenjangan dan performa setiap indikator utama kesehatan rumah tangga</p>
        <div className="w-full h-[400px]">
          {dataRadar.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart cx="50%" cy="50%" outerRadius="80%" data={dataRadar}>
                <PolarGrid stroke="#e5e7eb" />
                <PolarAngleAxis dataKey="subject" tick={{ fill: '#4b5563', fontSize: 12, fontWeight: 500 }} />
                <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fill: '#9ca3af', fontSize: 10 }} />
                <Radar name="Capaian Wilayah (%)" dataKey="A" stroke="#10b981" fill="#10b981" fillOpacity={0.35} />
                <Tooltip formatter={(value) => [`${value}%`, 'Capaian']} />
                <Legend verticalAlign="bottom" align="center" wrapperStyle={{ paddingTop: '20px' }} />
              </RadarChart>
            </ResponsiveContainer>
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-400 text-sm">Tidak ada data survei</div>
          )}
        </div>
      </div>

      {/* 3. Bottom Row: Bottlenecks & GERMAS Integration */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Bottlenecks / Pareto */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-between">
          <div>
            <h3 className="text-lg font-bold text-gray-800">Penyebab Gagal Terbanyak (Bottlenecks)</h3>
            <p className="text-xs text-gray-500 mt-1 mb-6">5 indikator dengan tingkat kegagalan tertinggi pada rumah tangga tidak sehat</p>
            <div className="h-[300px]">
              {dataPareto.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dataPareto} layout="vertical" margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f3f4f6" />
                    <XAxis type="number" hide />
                    <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fill: '#4b5563', fontSize: 12 }} />
                    <Tooltip formatter={(value) => [`${value}%`, 'Tingkat Kegagalan']} cursor={{fill: 'transparent'}} />
                    <Bar dataKey="failure" fill="#ef4444" radius={[0, 4, 4, 0]} barSize={16} name="Tingkat Kegagalan (%)" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-400 text-sm">Tidak ada data survei</div>
              )}
            </div>
          </div>
          <div className="pt-4 border-t border-gray-100 text-xs text-gray-500 italic mt-4 bg-gray-50 -mx-6 -mb-6 p-4 rounded-b-2xl">
            <span className="font-semibold text-gray-700">Catatan Analitik:</span> Grafik di atas menggunakan pendekatan analisis kegagalan untuk mengidentifikasi bottleneck utama pada wilayah terpilih. Prioritas intervensi strategis pada 3 indikator teratas terbukti secara ilmiah memberikan daya ungkit peningkatan IKS wilayah paling signifikan.
          </div>
        </div>

        {/* GERMAS Stacked Bar */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-between">
          <div>
            <h3 className="text-lg font-bold text-gray-800">Integrasi GERMAS & Posyandu</h3>
            <p className="text-xs text-gray-500 mt-1 mb-6">Tingkat partisipasi Kunjungan Posyandu dan pemeriksaan Cek Kesehatan Gratis (CKG)</p>
            <div className="h-[300px]">
              {dataGermas.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dataGermas} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#6b7280', fontSize: 11 }} dy={10} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: '#9ca3af', fontSize: 10 }} />
                    <Tooltip formatter={(value) => [`${value}%`]} cursor={{fill: '#f9fafb'}} />
                    <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px' }} />
                    <Bar dataKey="Posyandu" stackId="a" fill="#3b82f6" name="Hadir Posyandu (%)" radius={[0, 0, 4, 4]} maxBarSize={30} />
                    <Bar dataKey="CKG" stackId="a" fill="#8b5cf6" name="Melakukan CKG (%)" radius={[4, 4, 0, 0]} maxBarSize={30} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-400 text-sm">Tidak ada data survei</div>
              )}
            </div>
          </div>
          <div className="pt-4 border-t border-gray-100 text-xs text-gray-500 italic mt-4 bg-gray-50 -mx-6 -mb-6 p-4 rounded-b-2xl">
            <span className="font-semibold text-gray-700">Catatan Analitik:</span> Grafik di atas menunjukkan perbandingan persentase kehadiran Posyandu dan pemeriksaan Cek Kesehatan Gratis (CKG). Integrasi yang kuat antara Posyandu dan layanan GERMAS berkontribusi langsung pada deteksi dini faktor risiko penyakit tidak menular.
          </div>
        </div>
      </div>

      {/* 4. Bottom Row 2: Kelompok Rentan & Advanced Analytics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Kelompok Rentan TTD */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-between">
          <div>
            <h3 className="text-lg font-bold text-gray-800">Analisis Kelompok Rentan (TTD)</h3>
            <p className="text-xs text-gray-500 mt-1 mb-8">Kepatuhan konsumsi Tablet Tambah Darah vs Target Nasional</p>
            
            <div className="space-y-8">
              {/* Bumil */}
              <div>
                <div className="flex justify-between items-end mb-2">
                  <div>
                    <p className="font-bold text-gray-700">Ibu Hamil</p>
                    <p className="text-xs text-gray-400">Mengkonsumsi TTD</p>
                  </div>
                  <div className="text-right">
                    <span className="text-2xl font-black text-pink-600">{dataRentan.bumilCapaian}%</span>
                    <span className="text-xs text-gray-400 ml-1">/ {dataRentan.bumilTarget}% Target</span>
                  </div>
                </div>
                <div className="w-full bg-gray-100 h-4 rounded-full overflow-hidden relative">
                  {/* Target Line */}
                  <div className="absolute top-0 bottom-0 w-0.5 bg-gray-400 z-10" style={{ left: `${dataRentan.bumilTarget}%` }}></div>
                  {/* Progress */}
                  <div className="bg-gradient-to-r from-pink-400 to-pink-500 h-full rounded-full transition-all duration-1000" style={{ width: `${dataRentan.bumilCapaian}%` }}></div>
                </div>
              </div>

              {/* Remaja Putri */}
              <div>
                <div className="flex justify-between items-end mb-2">
                  <div>
                    <p className="font-bold text-gray-700">Remaja Putri</p>
                    <p className="text-xs text-gray-400">Mengkonsumsi TTD</p>
                  </div>
                  <div className="text-right">
                    <span className="text-2xl font-black text-purple-600">{dataRentan.remajaCapaian}%</span>
                    <span className="text-xs text-gray-400 ml-1">/ {dataRentan.remajaTarget}% Target</span>
                  </div>
                </div>
                <div className="w-full bg-gray-100 h-4 rounded-full overflow-hidden relative">
                  {/* Target Line */}
                  <div className="absolute top-0 bottom-0 w-0.5 bg-gray-400 z-10" style={{ left: `${dataRentan.remajaTarget}%` }}></div>
                  {/* Progress */}
                  <div className="bg-gradient-to-r from-purple-400 to-purple-500 h-full rounded-full transition-all duration-1000" style={{ width: `${dataRentan.remajaCapaian}%` }}></div>
                </div>
              </div>
              
              <div className="pt-2 flex items-center gap-4 text-xs text-gray-400 font-medium">
                <div className="flex items-center gap-1.5"><span className="w-3 h-3 bg-gray-400 rounded-sm"></span> Target Nasional (90%)</div>
                <div className="flex items-center gap-1.5"><span className="w-3 h-3 bg-pink-400 rounded-sm"></span> Capaian Bumil</div>
                <div className="flex items-center gap-1.5"><span className="w-3 h-3 bg-purple-400 rounded-sm"></span> Capaian Remaja</div>
              </div>
            </div>
          </div>
          <div className="pt-4 border-t border-gray-100 text-xs text-gray-500 italic mt-6 bg-gray-50 -mx-6 -mb-6 p-4 rounded-b-2xl">
            <span className="font-semibold text-gray-700">Catatan Analitik:</span> Kepatuhan konsumsi Tablet Tambah Darah (TTD) bagi kelompok rentan merupakan intervensi spesifik penting dalam pencegahan stunting secara hulu. Target nasional diset pada angka 90% untuk menjamin pencegahan anemia secara masif.
          </div>
        </div>

        {/* Heatmap Korelasi Pearson */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-between">
          <div>
            <h3 className="text-lg font-bold text-gray-800">Matriks Korelasi Indikator</h3>
            <p className="text-xs text-gray-500 mt-1 mb-6">Hubungan statistik koefisien Pearson antar indikator kesehatan (Root Cause Analysis)</p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {dataCorrelation.length > 0 ? (
                dataCorrelation.map((item: any, i: number) => (
                  <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 border border-gray-100 hover:border-emerald-200 transition-colors">
                    <div className={`w-14 h-12 rounded-lg flex items-center justify-center text-white font-extrabold text-sm ${getCorrelationColor(item.value)}`}>
                      {item.value > 0 ? `+${item.value.toFixed(2)}` : item.value.toFixed(2)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-gray-500 truncate font-semibold">{item.ind1}</p>
                      <p className="text-xs font-bold text-gray-700 break-words leading-tight mt-0.5">vs {item.ind2}</p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-400 text-sm">Tidak ada data survei</div>
              )}
            </div>
          </div>
          <div className="pt-4 border-t border-gray-100 text-xs text-gray-500 italic mt-6 bg-gray-50 -mx-6 -mb-6 p-4 rounded-b-2xl">
            <span className="font-semibold text-gray-700">Catatan Analitik:</span> Matriks di atas menghitung koefisien korelasi Pearson aktual antara pasangan indikator PHBS menggunakan data survei langsung. Nilai mendekati +1,0 menunjukkan korelasi positif yang kuat (kedua perilaku berjalan seiring), sedangkan nilai mendekati 0 menunjukkan tidak ada hubungan linier. Warna mawar pekat menunjukkan korelasi positif kuat, amber korelasi sedang, dan emerald/abu untuk hubungan lemah.
          </div>
        </div>
      </div>

    </div>
  )
}
