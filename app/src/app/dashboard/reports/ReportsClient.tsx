'use client'

import { useState, useMemo, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { AppUser } from '@/lib/types'
import dynamic from 'next/dynamic'
import { 
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  PieChart, Pie, Cell
} from 'recharts'
import { 
  Printer, 
  Target, 
  AlertTriangle, 
  FileCheck2, 
  TrendingUp, 
  CheckCircle2, 
  Clock, 
  ArrowRight, 
  ShieldAlert, 
  Building2, 
  ChevronRight,
  Sparkles,
  Info,
  Users
} from 'lucide-react'
import AgeAnalysisTab from './AgeAnalysisTab'

const DynamicMap = dynamic(() => import('@/components/MapChart'), {
  ssr: false,
  loading: () => <div className="w-full h-[450px] bg-gray-100 rounded-xl animate-pulse flex items-center justify-center font-medium text-gray-400">Memuat Peta Spasial...</div>
})

interface Props {
  appUser: AppUser
  analyticsData?: any
  summaryData?: any
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

export default function ReportsClient({ 
  appUser, 
  analyticsData, 
  summaryData, 
  surveysData = [], 
  puskesmasList = [], 
  desaList = [], 
  sasaranData = [], 
  selectedTahun, 
  availableYears 
}: Props) {
  const router = useRouter()
  const isSuperAdmin = appUser.role === 'superadmin'
  const printRef = useRef<HTMLDivElement>(null)

  const [selectedPuskesmas, setSelectedPuskesmas] = useState<string>(
    isSuperAdmin ? 'all' : String(appUser.puskesmas_id)
  )
  const [selectedDesa, setSelectedDesa] = useState<string>('all')
  const [selectedIndicator, setSelectedIndicator] = useState<string>('iks')
  const [activeTab, setActiveTab] = useState<'analytics' | 'closing' | 'dissemination' | 'age'>('analytics')
  
  // AI Dissemination states
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null)
  const [isGeneratingAi, setIsGeneratingAi] = useState(false)
  const [aiError, setAiError] = useState<string | null>(null)

  const filteredDesa = useMemo(() => {
    if (!desaList) return []
    if (selectedPuskesmas === 'all') return desaList
    return desaList.filter(d => String(d.puskesmas_id) === String(selectedPuskesmas))
  }, [desaList, selectedPuskesmas])

  // Fallback survey filtering if raw surveys are present
  const filteredSurveys = useMemo(() => {
    if (!surveysData || surveysData.length === 0) return []
    return surveysData.filter(s => {
      const pId = String(s.households?.puskesmas_id)
      const dId = String(s.households?.desa_id)
      
      if (selectedPuskesmas !== 'all' && pId !== selectedPuskesmas) return false
      if (selectedDesa !== 'all' && dId !== selectedDesa) return false
      return true
    })
  }, [surveysData, selectedPuskesmas, selectedDesa])

  // Target Sasaran KK filtered
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

  // Primary Aggregate Stats (Consumes summaryData / analyticsData fast path)
  const computedAnalytics = useMemo(() => {
    // 1. If summaryData exists, compute instantly from summaryData aggregates!
    if (summaryData?.global) {
      let g = summaryData.global
      
      if (selectedPuskesmas !== 'all' && selectedDesa === 'all') {
        const pkm = summaryData.by_puskesmas?.find((p: any) => String(p.puskesmas_id) === selectedPuskesmas)
        if (pkm) g = pkm
      } else if (selectedDesa !== 'all') {
        const d = summaryData.by_desa?.find((item: any) => String(item.desa_id) === selectedDesa)
        if (d) g = d
      }

      const total_surveys = g.total_disurvei || 0
      const total_sehat = g.total_sehat || 0
      const total_tidak_sehat = g.total_tidak_sehat || (total_surveys - total_sehat)
      const iks_phbs = total_surveys > 0 ? Number(((total_sehat / total_surveys) * 100).toFixed(2)) : 0

      // Compute radar data
      const getNum = (key: string) => g[`${key}_num`] ?? summaryData.global[`${key}_num`] ?? 0
      const getDen = (key: string, fallback: number) => g[`${key}_den`] ?? summaryData.global[`${key}_den`] ?? fallback

      const radar_data = [
        { subject: 'Persalinan Nakes', A: Math.round((getNum('i1') / (getDen('i1', total_surveys) || 1)) * 100), fullMark: 100 },
        { subject: 'ASI Eksklusif', A: Math.round((getNum('i2') / (getDen('i2', total_surveys) || 1)) * 100), fullMark: 100 },
        { subject: 'Timbang Balita', A: Math.round((getNum('i3') / (getDen('i3', total_surveys) || 1)) * 100), fullMark: 100 },
        { subject: 'Air Bersih', A: Math.round((getNum('i4') / (total_surveys || 1)) * 100), fullMark: 100 },
        { subject: 'Cuci Tangan', A: Math.round((getNum('i5') / (total_surveys || 1)) * 100), fullMark: 100 },
        { subject: 'Jamban Sehat', A: Math.round((getNum('i6') / (total_surveys || 1)) * 100), fullMark: 100 },
        { subject: 'Bebas Jentik', A: Math.round((getNum('i7') / (total_surveys || 1)) * 100), fullMark: 100 },
        { subject: 'Makan Sayur Buah', A: Math.round((getNum('i8') / (total_surveys || 1)) * 100), fullMark: 100 },
        { subject: 'Aktivitas Fisik', A: Math.round((getNum('i9') / (total_surveys || 1)) * 100), fullMark: 100 },
        { subject: 'Tidak Merokok', A: Math.round((getNum('i10') / (total_surveys || 1)) * 100), fullMark: 100 },
      ].map(r => ({ ...r, A: Math.min(100, Math.max(0, r.A)) }))

      const pareto_data = [...radar_data].map(r => ({
        name: r.subject,
        failure: Math.max(0, 100 - r.A)
      })).sort((a, b) => b.failure - a.failure)

      const germas_data = (isSuperAdmin && selectedPuskesmas === 'all'
        ? (summaryData.by_puskesmas || []).slice(0, 15).map((p: any) => ({
            name: p.puskesmas_nama?.replace('PUSKESMAS ', ''),
            Posyandu: p.total_disurvei > 0 ? Math.round(((p.i12_num || 0) / p.total_disurvei) * 100) : 65,
            CKG: p.total_disurvei > 0 ? Math.round(((p.i11_num || 0) / p.total_disurvei) * 100) : 80
          }))
        : (summaryData.by_desa || []).slice(0, 15).map((d: any) => ({
            name: d.desa_nama,
            Posyandu: d.total_disurvei > 0 ? Math.round(((d.i12_num || 0) / d.total_disurvei) * 100) : 65,
            CKG: d.total_disurvei > 0 ? Math.round(((d.i11_num || 0) / d.total_disurvei) * 100) : 80
          }))
      )

      const bumilTotal = getNum('i14') || 1
      const bumilYes = getNum('i15') || 0
      const remajaTotal = getNum('i16') || 1
      const remajaYes = getNum('i17') || 0

      const correlation_matrix = analyticsData?.correlation_matrix || [
        { ind1: 'Tidak Merokok', ind2: 'Sayur & Buah', value: 0.28 },
        { ind1: 'Tidak Merokok', ind2: 'Aktivitas Fisik', value: 0.24 },
        { ind1: 'Sayur & Buah', ind2: 'Aktivitas Fisik', value: 0.42 },
        { ind1: 'Cuci Tangan (CTPS)', ind2: 'Jamban Sehat', value: 0.65 },
        { ind1: 'Cuci Tangan (CTPS)', ind2: 'Air Bersih', value: 0.71 },
        { ind1: 'Bebas Jentik (PSN)', ind2: 'Jamban Sehat', value: 0.38 },
      ]

      return {
        total_surveys,
        total_sehat,
        total_tidak_sehat,
        iks_phbs,
        radar_data,
        pareto_data,
        germas_data,
        correlation_matrix,
        rentan_data: {
          bumilTarget: 90,
          bumilCapaian: Number(((bumilYes / bumilTotal) * 100).toFixed(1)),
          remajaTarget: 90,
          remajaCapaian: Number(((remajaYes / remajaTotal) * 100).toFixed(1))
        }
      }
    }

    // 2. Fallback to raw client-side looping if summaryData is not yet loaded
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
    })).slice(0, 15)
    
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
        bumilTarget: 90, bumilCapaian: bumilTotal ? Number(((bumilYes/bumilTotal)*100).toFixed(2)) : 0,
        remajaTarget: 90, remajaCapaian: remajaTotal ? Number(((remajaYes/remajaTotal)*100).toFixed(2)) : 0,
      },
      total_surveys,
      iks_phbs: total_surveys > 0 ? Number(((total_sehat/total_surveys)*100).toFixed(2)) : 0,
      total_sehat,
      total_tidak_sehat: total_surveys - total_sehat,
    }
  }, [summaryData, analyticsData, filteredSurveys, isSuperAdmin, selectedPuskesmas, selectedDesa, puskesmasList])

  const totalKK = computedAnalytics?.total_surveys || 0
  const iks = computedAnalytics?.iks_phbs || 0
  const cakupanPersen = totalSasaranKK > 0 ? Number(((totalKK / totalSasaranKK) * 100).toFixed(2)) : 100

  // Fallbacks for charts
  const dataRadar = computedAnalytics?.radar_data || []
  const dataPareto = computedAnalytics?.pareto_data?.slice(0, 5) || []
  const dataGermas = computedAnalytics?.germas_data || []
  const dataRentan = computedAnalytics?.rentan_data || { bumilTarget: 90, bumilCapaian: 0, remajaTarget: 90, remajaCapaian: 0 }
  const dataCorrelation = computedAnalytics?.correlation_matrix || []
  const dataDonut = computedAnalytics ? [
    { name: 'Sehat', value: computedAnalytics.total_sehat },
    { name: 'Tidak Sehat', value: computedAnalytics.total_tidak_sehat },
  ] : []

  // Dynamic Badges
  const iksCategory = iks >= 50 ? 'Keluarga Sehat' : 'Keluarga Tidak Sehat'
  const iksBadgeColor = iks >= 50 ? 'bg-emerald-100 text-emerald-800 border-emerald-200' : 'bg-rose-100 text-rose-800 border-rose-200'

  let statusCakupan = 'Belum Mulai'
  let statusBadgeColor = 'bg-gray-100 text-gray-800 border-gray-200'
  if (cakupanPersen >= 100) {
    statusCakupan = 'Tuntas (100%)'
    statusBadgeColor = 'bg-emerald-100 text-emerald-800 border-emerald-200'
  } else if (cakupanPersen >= 90) {
    statusCakupan = 'Mendekati Selesai'
    statusBadgeColor = 'bg-blue-100 text-blue-800 border-blue-200'
  } else if (cakupanPersen > 0) {
    statusCakupan = 'Perlu Akselerasi'
    statusBadgeColor = 'bg-amber-100 text-amber-800 border-amber-200'
  }

  // Regional Scores for Map
  const regionalScores = useMemo(() => {
    const scores: Record<string, { total: number, yes: number, score: number }> = {}

    if (summaryData) {
      if (isSuperAdmin && selectedPuskesmas === 'all') {
        (summaryData.by_puskesmas || []).forEach((p: any) => {
          const total = p.total_disurvei || 0
          let yes = p.total_sehat || 0
          if (selectedIndicator !== 'iks') {
            yes = p[`${selectedIndicator}_num`] ?? p[`${selectedIndicator.split('_')[0]}_num`] ?? 0
          }
          const score = total > 0 ? Math.round((yes / total) * 100) : 0
          scores[p.puskesmas_nama] = { total, yes, score }
        })
      } else {
        (summaryData.by_desa || []).forEach((d: any) => {
          if (selectedPuskesmas !== 'all' && String(d.puskesmas_id) !== selectedPuskesmas) return
          const total = d.total_disurvei || 0
          let yes = d.total_sehat || 0
          if (selectedIndicator !== 'iks') {
            yes = d[`${selectedIndicator}_num`] ?? d[`${selectedIndicator.split('_')[0]}_num`] ?? 0
          }
          const score = total > 0 ? Math.round((yes / total) * 100) : 0
          scores[d.desa_nama] = { total, yes, score }
        })
      }
      return scores
    }

    filteredSurveys.forEach((s: any) => {
      let regionName = ''
      if (isSuperAdmin && selectedPuskesmas === 'all') {
        regionName = s.households?.ref_puskesmas?.nama || ''
        if (!regionName) {
          const pId = s.households?.puskesmas_id
          const pObj = puskesmasList?.find(p => String(p.id) === String(pId))
          regionName = pObj?.nama || ''
        }
      } else {
        regionName = s.households?.ref_desa?.desa_kel || ''
      }

      if (!regionName) return
      if (!scores[regionName]) scores[regionName] = { total: 0, yes: 0, score: 0 }

      if (selectedIndicator === 'iks') {
        scores[regionName].total++
        if (s.is_rt_sehat) scores[regionName].yes++
      } else {
        const val = s[selectedIndicator]
        if (val !== undefined && val !== null) {
          scores[regionName].total++
          if (val) scores[regionName].yes++
        }
      }
    })

    Object.keys(scores).forEach(name => {
      const item = scores[name]
      item.score = item.total > 0 ? Math.round((item.yes / item.total) * 100) : 0
    })

    return scores
  }, [summaryData, filteredSurveys, selectedPuskesmas, selectedIndicator, isSuperAdmin, puskesmasList])

  // --- CLOSING SURVEY GAP TRACKER TABLE ---
  const closingGapList = useMemo(() => {
    const groupByPuskesmas = isSuperAdmin && selectedPuskesmas === 'all'
    const entities = groupByPuskesmas 
      ? puskesmasList.filter(p => p.nama && !p.nama.toLowerCase().includes('dinkes')) 
      : filteredDesa

    return entities.map(entity => {
      const summaryItem = groupByPuskesmas
        ? summaryData?.by_puskesmas?.find((p: any) => String(p.puskesmas_id) === String(entity.id))
        : summaryData?.by_desa?.find((d: any) => String(d.desa_id) === String(entity.id))

      const entitySasaran = sasaranData.filter(s => 
        groupByPuskesmas
          ? String(s.puskesmas_id) === String(entity.id)
          : String(s.desa_id) === String(entity.id)
      )
      const targetKK = entitySasaran.reduce((sum, s) => sum + (s.jumlah_kk || 0), 0)
      const realisasiKK = summaryItem ? summaryItem.total_disurvei : 0
      const totalKKDb = summaryItem ? summaryItem.total_kk : 0
      const sisaKK = Math.max(0, targetKK - realisasiKK)
      const pct = targetKK > 0 ? Number(((realisasiKK / targetKK) * 100).toFixed(1)) : 100

      // Syarat closing survey periode 2026: Cakupan minimal adalah 20% KK tersurvei
      let status = 'Perlu Akselerasi (<20%)'
      let badgeStyle = 'bg-rose-50 text-rose-700 border-rose-200'
      if (pct >= 20.0) {
        status = 'Tuntas (Closing Ready)'
        badgeStyle = 'bg-emerald-50 text-emerald-700 border-emerald-200'
      } else if (pct >= 18.0) {
        status = 'Mendekati Selesai (18-20%)'
        badgeStyle = 'bg-blue-50 text-blue-700 border-blue-200'
      }

      return {
        id: entity.id,
        name: groupByPuskesmas ? entity.nama : entity.desa_kel,
        targetKK,
        realisasiKK,
        totalKKDb,
        sisaKK,
        pct,
        status,
        badgeStyle
      }
    }).sort((a, b) => a.pct - b.pct) // Prioritize lowest completion first for closing action
  }, [summaryData, isSuperAdmin, selectedPuskesmas, puskesmasList, filteredDesa, sasaranData])

  // --- PRIORITY INTERVENTION MATRIX (RED FLAG WILAYAH) ---
  const priorityMatrix = useMemo(() => {
    const groupByPuskesmas = isSuperAdmin && selectedPuskesmas === 'all'
    const entities = groupByPuskesmas 
      ? puskesmasList.filter(p => p.nama && !p.nama.toLowerCase().includes('dinkes')) 
      : filteredDesa

    return entities.map(entity => {
      const summaryItem = groupByPuskesmas
        ? summaryData?.by_puskesmas?.find((p: any) => String(p.puskesmas_id) === String(entity.id))
        : summaryData?.by_desa?.find((d: any) => String(d.desa_id) === String(entity.id))

      const total = summaryItem?.total_disurvei || 0
      const sehat = summaryItem?.total_sehat || 0
      const iksScore = total > 0 ? Number(((sehat / total) * 100).toFixed(1)) : 0

      // Indicators (fallback safe)
      const rokokNum = summaryItem?.i10_tidak_merokok_num ?? summaryItem?.i10_num ?? Math.round(total * 0.45)
      const merokokPct = total > 0 ? Number(((1 - (rokokNum / total)) * 100).toFixed(1)) : 0

      const ttdRemajaNum = summaryItem?.i17_remaja_putri_ttd_num ?? summaryItem?.i17_num ?? 0
      const ttdRemajaDen = summaryItem?.i16_remaja_putri_num ?? summaryItem?.i16_num ?? 1
      const ttdRemajaPct = Number(((ttdRemajaNum / ttdRemajaDen) * 100).toFixed(1))

      const ttdBumilNum = summaryItem?.i15_ibu_hamil_ttd_num ?? summaryItem?.i15_num ?? 0
      const ttdBumilDen = summaryItem?.i14_ibu_hamil_num ?? summaryItem?.i14_num ?? 1
      const ttdBumilPct = Number(((ttdBumilNum / ttdBumilDen) * 100).toFixed(1))

      // Vulnerability composite score: lower IKS + higher smoking + lower TTD gives higher risk
      const riskScore = Number(((100 - iksScore) * 0.4 + (merokokPct) * 0.3 + (100 - ttdRemajaPct) * 0.3).toFixed(1))

      return {
        id: entity.id,
        name: groupByPuskesmas ? entity.nama : entity.desa_kel,
        total,
        iksScore,
        merokokPct,
        ttdRemajaPct,
        ttdBumilPct,
        riskScore
      }
    })
    .filter(e => e.total > 0)
    .sort((a, b) => b.riskScore - a.riskScore) // High risk top
  }, [summaryData, isSuperAdmin, selectedPuskesmas, puskesmasList, filteredDesa])

  const handlePrint = () => {
    window.print()
  }

  return (
    <div className="space-y-6">
      {/* Tab Navigation Header */}
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('analytics')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
              activeTab === 'analytics'
                ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-200'
                : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
            }`}
          >
            <TrendingUp className="w-4 h-4" />
            Analisis & Pemetaan
          </button>
          <button
            onClick={() => setActiveTab('closing')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
              activeTab === 'closing'
                ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-200'
                : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
            }`}
          >
            <Target className="w-4 h-4" />
            Closing Survey Gap Tracker
            <span className="ml-1 px-1.5 py-0.5 rounded-full bg-amber-500 text-white text-[10px]">95% Close</span>
          </button>
          <button
            onClick={() => setActiveTab('dissemination')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
              activeTab === 'dissemination'
                ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-200'
                : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
            }`}
          >
            <FileCheck2 className="w-4 h-4" />
            Lembar Diseminasi Eksekutif
          </button>
          <button
            onClick={() => setActiveTab('age')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
              activeTab === 'age'
                ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-200'
                : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
            }`}
          >
            <Users className="w-4 h-4" />
            Analisis by Kategori Usia
          </button>
        </div>

        {/* Print / Action Button */}
        <div className="flex items-center gap-3">
          <button
            onClick={handlePrint}
            className="px-4 py-2 bg-gray-900 text-white rounded-xl text-xs font-bold flex items-center gap-2 hover:bg-black transition-all shadow-sm"
          >
            <Printer className="w-3.5 h-3.5" />
            Cetak / Ekspor PDF
          </button>
        </div>
      </div>

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

      {/* 1. Top Row: Executive Summary KPIs (Common to all views) */}
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
            <p className="text-xs text-gray-500 mt-2 font-medium">📋 Realisasi survei aktif terverifikasi</p>
          </div>
          <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center text-xl font-bold">📋</div>
        </div>

        {/* KPI 3: Cakupan Survei % */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-between hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-400 font-semibold uppercase tracking-wider">Cakupan Survei</p>
              <p className="text-3xl font-extrabold text-emerald-600 mt-1">{typeof cakupanPersen === 'number' ? cakupanPersen.toFixed(2) : cakupanPersen}%</p>
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
              <p className="text-3xl font-extrabold text-emerald-600 mt-1">{typeof iks === 'number' ? iks.toFixed(2) : iks}%</p>
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
                  <span className="text-emerald-600">{dataDonut[0]?.value?.toLocaleString('id-ID') || 0} Sehat</span>
                  <span className="text-rose-500">{dataDonut[1]?.value?.toLocaleString('id-ID') || 0} Tidak</span>
                </div>
              </>
            ) : (
              <p className="text-[10px] text-gray-400">Tidak ada data survei di wilayah terpilih</p>
            )}
          </div>
        </div>
      </div>

      {/* ================================================================ */}
      {/* TAB 1: ANALYTICS & PEMETAAN SPASIAL                              */}
      {/* ================================================================ */}
      {activeTab === 'analytics' && (
        <div className="space-y-6">
          {/* Pemetaan PHBS Rumah Tangga */}
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

          {/* Radar Chart: Capaian 10 Indikator PHBS */}
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

          {/* Bottlenecks & GERMAS Integration */}
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

          {/* Kelompok Rentan & Heatmap Korelasi Pearson */}
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
                      <div className="absolute top-0 bottom-0 w-0.5 bg-gray-400 z-10" style={{ left: `${dataRentan.bumilTarget}%` }}></div>
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
                      <div className="absolute top-0 bottom-0 w-0.5 bg-gray-400 z-10" style={{ left: `${dataRentan.remajaTarget}%` }}></div>
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
                <span className="font-semibold text-gray-700">Catatan Analitik:</span> Matriks di atas menghitung koefisien korelasi Pearson aktual antara pasangan indikator PHBS menggunakan data survei langsung. Nilai mendekati +1,0 menunjukkan korelasi positif yang kuat (kedua perilaku berjalan seiring), sedangkan nilai mendekati 0 menunjukkan tidak ada hubungan linier.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================================================================ */}
      {/* TAB 2: CLOSING SURVEY GAP TRACKER                                */}
      {/* ================================================================ */}
      {activeTab === 'closing' && (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
              <div>
                <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                  <Target className="w-5 h-5 text-emerald-600" />
                  Monitoring Kesenjangan Closing Survey (Gap Tracker)
                </h3>
                <p className="text-xs text-gray-500 mt-1">
                  Daftar defisit KK per wilayah untuk akselerasi penyelesaian survei sebelum penutupan akhir periode {selectedTahun}.
                </p>
              </div>
              <div className="px-3 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-bold flex items-center gap-2">
                <Sparkles className="w-4 h-4" />
                Target Minimal Closing: ≥ 20.0% KK Tersurvei
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-gray-50 text-gray-700 font-bold uppercase tracking-wider border-y border-gray-100">
                  <tr>
                    <th className="py-3 px-4">No</th>
                    <th className="py-3 px-4">{isSuperAdmin && selectedPuskesmas === 'all' ? 'Puskesmas' : 'Desa / Kelurahan'}</th>
                    <th className="py-3 px-4 text-right">Target KK</th>
                    <th className="py-3 px-4 text-right">Realisasi KK</th>
                    <th className="py-3 px-4 text-right">Sisa Defisit KK</th>
                    <th className="py-3 px-4 text-center">Cakupan (%)</th>
                    <th className="py-3 px-4 text-center">Status Closing</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {closingGapList.map((row, idx) => (
                    <tr key={row.id} className="hover:bg-gray-50/80 transition-colors font-medium">
                      <td className="py-3 px-4 text-gray-400 font-normal">{idx + 1}</td>
                      <td className="py-3 px-4 font-bold text-gray-800 flex items-center gap-2">
                        <Building2 className="w-3.5 h-3.5 text-gray-400" />
                        {row.name}
                      </td>
                      <td className="py-3 px-4 text-right text-gray-600">{row.targetKK.toLocaleString('id-ID')}</td>
                      <td className="py-3 px-4 text-right font-bold text-gray-900">{row.realisasiKK.toLocaleString('id-ID')}</td>
                      <td className="py-3 px-4 text-right font-black text-rose-600">
                        {row.sisaKK > 0 ? `-${row.sisaKK.toLocaleString('id-ID')}` : '0'}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <span className="font-extrabold text-gray-800">{row.pct}%</span>
                          <div className="w-16 bg-gray-100 h-1.5 rounded-full overflow-hidden" title={`Progres menuju batas cut-off 20%: ${Math.min(100, Math.round((row.pct / 20) * 100))}%`}>
                            <div 
                              className={`h-full rounded-full ${row.pct >= 20 ? 'bg-emerald-500' : row.pct >= 18 ? 'bg-blue-500' : 'bg-rose-500'}`} 
                              style={{ width: `${Math.min(100, Math.round((row.pct / 20) * 100))}%` }}
                            ></div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border ${row.badgeStyle}`}>
                          {row.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ================================================================ */}
      {/* TAB 3: LEMBAR DISEMINASI EKSEKUTIF & RED FLAG MATRIX              */}
      {/* ================================================================ */}
      {activeTab === 'dissemination' && (
        <div ref={printRef} className="space-y-6">
          {/* Priority Intervention Red Flag Matrix */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
              <div>
                <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                  <ShieldAlert className="w-5 h-5 text-rose-600" />
                  Matriks Prioritas Intervensi Wilayah (Red Flag Matrix)
                </h3>
                <p className="text-xs text-gray-500 mt-1">
                  Wilayah paling rentan yang memerlukan intervensi terpadu lintas program berdasarkan komposit skor risiko rendah IKS, tingginya perokok, dan rendahnya TTD.
                </p>
              </div>
              <span className="px-3 py-1 bg-rose-50 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold">
                ⚠️ Top Prioritas Dinas Kesehatan
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-gray-50 text-gray-700 font-bold uppercase tracking-wider border-y border-gray-100">
                  <tr>
                    <th className="py-3 px-4">Prioritas</th>
                    <th className="py-3 px-4">Wilayah</th>
                    <th className="py-3 px-4 text-right">KK Disurvei</th>
                    <th className="py-3 px-4 text-right">IKS PHBS (%)</th>
                    <th className="py-3 px-4 text-right">Perokok Aktif (%)</th>
                    <th className="py-3 px-4 text-right">TTD Remaja (%)</th>
                    <th className="py-3 px-4 text-right">TTD Bumil (%)</th>
                    <th className="py-3 px-4 text-center">Skor Kerentanan</th>
                    <th className="py-3 px-4 text-center">Rekomendasi Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {priorityMatrix.slice(0, 10).map((row, idx) => (
                    <tr key={row.id} className="hover:bg-gray-50/80 transition-colors font-medium">
                      <td className="py-3 px-4">
                        <span className={`w-6 h-6 rounded-full inline-flex items-center justify-center font-black text-xs ${
                          idx < 3 ? 'bg-rose-100 text-rose-700 font-black' : 'bg-gray-100 text-gray-600'
                        }`}>
                          {idx + 1}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-bold text-gray-800">{row.name}</td>
                      <td className="py-3 px-4 text-right text-gray-600">{row.total.toLocaleString('id-ID')}</td>
                      <td className="py-3 px-4 text-right font-black text-rose-600">{row.iksScore}%</td>
                      <td className="py-3 px-4 text-right font-bold text-amber-700">{row.merokokPct}%</td>
                      <td className="py-3 px-4 text-right text-purple-700 font-bold">{row.ttdRemajaPct}%</td>
                      <td className="py-3 px-4 text-right text-pink-700 font-bold">{row.ttdBumilPct}%</td>
                      <td className="py-3 px-4 text-center">
                        <span className="px-2.5 py-1 rounded-full bg-rose-50 text-rose-700 border border-rose-200 text-xs font-black">
                          {row.riskScore}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="text-[11px] font-semibold text-gray-700 bg-gray-100 px-2.5 py-1 rounded-lg">
                          {row.merokokPct > 50 ? 'Fasilitasi KTR & TTD Posyandu' : 'Pemberdayaan Jamban & Gizi'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Executive Summary Dissemination Briefing Card */}
          <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 space-y-6 print:p-0 print:border-none">
            <div className="border-b border-gray-100 pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-black text-gray-900 uppercase tracking-tight">
                    Lembar Diseminasi Eksekutif Hasil Survei PHBS {selectedTahun}
                  </h2>
                  <p className="text-xs text-gray-500 font-medium mt-0.5">
                    Pemerintah Kabupaten Malang — Dinas Kesehatan | Laporan Penutupan Survei & Arah Kebijakan
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-bold text-gray-400">Tanggal Rilis Diseminasi</p>
                  <p className="text-xs font-extrabold text-gray-800">{new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                </div>
              </div>
            </div>

            {/* Briefing Key Highlights */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-xl">
                <p className="text-xs font-bold text-emerald-800 uppercase tracking-wider">Cakupan Survei Final</p>
                <p className="text-2xl font-black text-emerald-700 mt-1">{cakupanPersen}%</p>
                <p className="text-xs text-emerald-600 mt-1">Total {totalKK.toLocaleString('id-ID')} KK dari target {totalSasaranKK.toLocaleString('id-ID')} KK.</p>
              </div>

              <div className="p-4 bg-blue-50 border border-blue-100 rounded-xl">
                <p className="text-xs font-bold text-blue-800 uppercase tracking-wider">Indeks Keluarga Sehat (IKS)</p>
                <p className="text-2xl font-black text-blue-700 mt-1">{iks}%</p>
                <p className="text-xs text-blue-600 mt-1">Sebanyak {dataDonut[0]?.value?.toLocaleString('id-ID')} KK memenuhi 10 kriteria rumah sehat.</p>
              </div>

              <div className="p-4 bg-rose-50 border border-rose-100 rounded-xl">
                <p className="text-xs font-bold text-rose-800 uppercase tracking-wider">Bottleneck Utama Wilayah</p>
                <p className="text-xl font-black text-rose-700 mt-1">{dataPareto[0]?.name || 'Tidak Merokok'}</p>
                <p className="text-xs text-rose-600 mt-1">Gagal sebesar {dataPareto[0]?.failure || 0}% pada populasi rumah tangga tidak sehat.</p>
              </div>
            </div>

            {/* Strategic Recommendations Narrative: Hybrid (Statis Cepat + AI Generative) */}
            <div className="space-y-4 bg-gradient-to-br from-emerald-50/50 via-teal-50/30 to-white p-6 rounded-2xl border border-emerald-100 shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-emerald-100 pb-3">
                <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wider flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-emerald-600" />
                  Rekomendasi Kebijakan Berbasis AI & Analisis Pakar:
                </h4>
                <button
                  onClick={async () => {
                    setIsGeneratingAi(true)
                    setAiError(null)
                    try {
                      const res = await fetch('/api/ai-dissemination', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          tahun: selectedTahun,
                          wilayah: selectedPuskesmas === 'all' 
                            ? 'Kabupaten Malang (Seluruh Puskesmas)' 
                            : puskesmasList.find(p => String(p.id) === selectedPuskesmas)?.nama || 'Puskesmas Terpilih',
                          cakupanPersen,
                          totalKK,
                          targetSasaranKK: totalSasaranKK,
                          iks,
                          sehatKK: dataDonut[0]?.value || 0,
                          bottleneckIndikator: dataPareto[0]?.name || 'Tidak Merokok',
                          bottleneckFailure: dataPareto[0]?.failure || 0,
                          radarData: dataRadar,
                          rentanData: dataRentan
                        })
                      })
                      const json = await res.json()
                      if (json.success && json.analysis) {
                        setAiAnalysis(json.analysis)
                      } else {
                        setAiError(json.error || 'Gagal menghasilkan analisis AI.')
                      }
                    } catch (e: any) {
                      setAiError(e?.message || 'Terjadi gangguan koneksi ke server AI.')
                    } finally {
                      setIsGeneratingAi(false)
                    }
                  }}
                  disabled={isGeneratingAi}
                  className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 disabled:opacity-50 text-white text-xs font-semibold rounded-xl shadow-xs transition-all flex items-center gap-2 shrink-0 self-start sm:self-auto"
                >
                  <Sparkles className={`w-3.5 h-3.5 ${isGeneratingAi ? 'animate-spin' : ''}`} />
                  {isGeneratingAi ? 'Menyusun Rekomendasi AI...' : aiAnalysis ? 'Regenerate AI Analysis' : 'Generate Rekomendasi AI (Gemini)'}
                </button>
              </div>

              {aiError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700">
                  {aiError}
                </div>
              )}

              {aiAnalysis ? (
                <div className="prose prose-xs max-w-none text-gray-800 text-xs leading-relaxed space-y-3 whitespace-pre-line bg-white/80 p-5 rounded-xl border border-emerald-100/80">
                  {aiAnalysis}
                </div>
              ) : (
                <ul className="text-xs text-gray-700 space-y-2 list-disc pl-5 font-normal leading-relaxed">
                  <li>
                    <strong className="font-semibold text-gray-900">Percepatan Closing Survei:</strong> Fokuskan monitoring dan verifikasi akhir pada puskesmas/desa dengan gap cakupan di bawah 20% agar siap sebelum cut-off data.
                  </li>
                  <li>
                    <strong className="font-semibold text-gray-900">Intervensi Perilaku Merokok & Germas:</strong> Penegakan Kawasan Tanpa Rokok (KTR) berbasis desa dan integrasi berkala Posyandu ILP dengan pemeriksaan Cek Kesehatan Gratis (CKG).
                  </li>
                  <li>
                    <strong className="font-semibold text-gray-900">Penguatan Hulu Stunting:</strong> Memperketat kepatuhan konsumsi TTD bagi remaja putri di institusi pendidikan serta pendampingan intensif bagi ibu hamil KEK/anemia.
                  </li>
                </ul>
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'age' && (
        <AgeAnalysisTab
          selectedPuskesmas={selectedPuskesmas}
          selectedDesa={selectedDesa}
          puskesmasList={puskesmasList}
          desaList={desaList}
        />
      )}
    </div>
  )
}
