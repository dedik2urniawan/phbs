'use client'

import React, { useState, useMemo } from 'react'
import { AppUser } from '@/lib/types'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer, Cell, PieChart, Pie } from 'recharts'
import { Activity, Home, ClipboardList, Target, TrendingUp, CheckCircle, Droplets, Utensils, CigaretteOff, Users, Stethoscope, Baby } from 'lucide-react'
import WelcomeReminderModal from '@/components/WelcomeReminderModal'

interface Props {
  user: AppUser & { ref_puskesmas?: { nama: string; kecamatan: string } | null }
  allHouseholds: any[]
  surveysData: any[]
  refPuskesmas: any[]
  refDesa: any[]
  sasaranData?: any[]
  familyMembersData?: any[]
}

const PHBS_INDICATORS = [
  { key: 'i1_persalinan_nakes', label: 'Persalinan Nakes', icon: Baby, color: '#10b981' },
  { key: 'i2_asi_eksklusif', label: 'ASI Eksklusif', icon: Droplets, color: '#3b82f6' },
  { key: 'i3_menimbang_balita', label: 'Menimbang Balita', icon: Activity, color: '#f59e0b' },
  { key: 'i4_air_bersih', label: 'Air Bersih', icon: Droplets, color: '#06b6d4' },
  { key: 'i5_cuci_tangan', label: 'Cuci Tangan Sabun', icon: Activity, color: '#8b5cf6' },
  { key: 'i6_jamban_sehat', label: 'Jamban Sehat', icon: Home, color: '#ec4899' },
  { key: 'i7_psn', label: 'PSN/3M Plus', icon: Target, color: '#ef4444' },
  { key: 'i8_makan_sayur_buah', label: 'Sayur & Buah', icon: Utensils, color: '#84cc16' },
  { key: 'i9_aktivitas_fisik', label: 'Aktivitas Fisik', icon: TrendingUp, color: '#f97316' },
  { key: 'i10_tidak_merokok', label: 'Tidak Merokok', icon: CigaretteOff, color: '#64748b' },
]

const NON_PHBS_INDICATORS = [
  { key: 'i11_cek_kesehatan', label: 'Cek Kesehatan', icon: Stethoscope, color: '#14b8a6' },
  { key: 'i12_kunjungan_posyandu', label: 'Kunjungan Posyandu', icon: Users, color: '#6366f1' },
  { key: 'i14_ibu_hamil', label: 'Ibu Hamil Normal', icon: Users, color: '#d946ef' },
  { key: 'i15_ibu_hamil_ttd', label: 'Bumil Konsumsi TTD', icon: CheckCircle, color: '#f43f5e' },
  { key: 'i16_remaja_putri', label: 'Ada Remaja Putri', icon: Users, color: '#eab308' },
  { key: 'i17_remaja_putri_ttd', label: 'Remaja Putri TTD', icon: CheckCircle, color: '#10b981' },
]

export default function DashboardClient({ user, allHouseholds, surveysData, refPuskesmas, refDesa, sasaranData = [], familyMembersData = [] }: Props) {
  const isSuperAdmin = user?.role === 'superadmin'
  const puskesmasName = isSuperAdmin ? 'Dinkes Kab. Malang' : `Puskesmas ${user?.ref_puskesmas?.nama || ''}`.trim()
  
  const currentYear = new Date().getFullYear()
  
  // States
  const [activeTab, setActiveTab] = useState<'metadata' | 'respondents' | 'phbs' | 'non-phbs'>('metadata')
  const [filterYear, setFilterYear] = useState<number>(currentYear)
  const [filterPuskesmas, setFilterPuskesmas] = useState<string>('ALL')
  const [filterDesa, setFilterDesa] = useState<string>('ALL')
  const [activeMetadataChart, setActiveMetadataChart] = useState<'progress' | 'capaian'>('progress')
  const [activeDemographicBreakdown, setActiveDemographicBreakdown] = useState<'gender' | 'education' | 'occupation'>('gender')
  
  const [activePhbsInd, setActivePhbsInd] = useState(PHBS_INDICATORS[0].key)
  const [activeNonPhbsInd, setActiveNonPhbsInd] = useState(NON_PHBS_INDICATORS[0].key)
  const [showWelcomeModal, setShowWelcomeModal] = useState(false)

  // Welcome modal logic
  React.useEffect(() => {
    // Only show if user has not seen it this session and there are no sasaran data (or just always show once)
    const hasSeenWelcome = sessionStorage.getItem('simphbs_welcome_seen')
    if (!hasSeenWelcome) {
      setShowWelcomeModal(true)
      sessionStorage.setItem('simphbs_welcome_seen', 'true')
    }
  }, [])

  // Derived options
  const years = Array.from(new Set(surveysData.map(s => s.tahun).filter(Boolean))).sort().reverse()
  if (!years.includes(currentYear)) years.unshift(currentYear)
  
  const availableDesa = useMemo(() => {
    if (isSuperAdmin && filterPuskesmas !== 'ALL') {
      return refDesa.filter(d => d.puskesmas_id === filterPuskesmas)
    } else if (!isSuperAdmin) {
      return refDesa.filter(d => d.puskesmas_id === user?.puskesmas_id)
    }
    return refDesa
  }, [filterPuskesmas, isSuperAdmin, refDesa, user?.puskesmas_id])

  // Filtered Data
  const filteredSurveys = useMemo(() => {
    return surveysData.filter(s => {
      let match = s.tahun === filterYear
      if (isSuperAdmin) {
        if (filterPuskesmas !== 'ALL') {
          if (s.households?.puskesmas_id !== filterPuskesmas) match = false
        }
      }
      if (filterDesa !== 'ALL') {
        if (s.households?.desa_id !== filterDesa) match = false
      }
      return match
    })
  }, [surveysData, filterYear, filterPuskesmas, filterDesa, isSuperAdmin])

  // Filtered Family Members based on surveyed households
  const filteredMembers = useMemo(() => {
    const activeHouseholdIds = new Set(filteredSurveys.map(s => s.household_id))
    return (familyMembersData || []).filter(m => activeHouseholdIds.has(m.household_id))
  }, [familyMembersData, filteredSurveys])

  // Gender Demographic Stats
  const genderStats = useMemo(() => {
    let lCount = 0
    let pCount = 0
    filteredMembers.forEach(m => {
      if (m.jenis_kelamin === 'L') lCount++
      else if (m.jenis_kelamin === 'P') pCount++
    })
    const total = lCount + pCount
    return {
      total,
      L: { count: lCount, pct: total > 0 ? Math.round((lCount / total) * 100) : 0 },
      P: { count: pCount, pct: total > 0 ? Math.round((pCount / total) * 100) : 0 }
    }
  }, [filteredMembers])

  // Education Demographic Stats
  const educationStats = useMemo(() => {
    const counts: Record<string, number> = {}
    const list = ['Tidak Sekolah', 'SD/Sederajat', 'SMP/Sederajat', 'SMA/Sederajat', 'D1/D2/D3', 'S1/D4', 'S2', 'S3']
    list.forEach(edu => { counts[edu] = 0 })
    
    filteredMembers.forEach(m => {
      const edu = m.pendidikan || 'Tidak Sekolah'
      if (counts[edu] !== undefined) {
        counts[edu]++
      } else {
        const matched = list.find(l => edu.toLowerCase().includes(l.toLowerCase()))
        if (matched) counts[matched]++
        else counts['Tidak Sekolah']++
      }
    })
    
    const total = filteredMembers.length
    return list.map(edu => ({
      name: edu,
      Jumlah: counts[edu],
      Persentase: total > 0 ? Math.round((counts[edu] / total) * 100) : 0
    }))
  }, [filteredMembers])

  // Occupation Demographic Stats
  const occupationStats = useMemo(() => {
    const counts: Record<string, number> = {}
    filteredMembers.forEach(m => {
      const occ = m.pekerjaan || 'Belum/Tidak Bekerja'
      counts[occ] = (counts[occ] || 0) + 1
    })
    const total = filteredMembers.length
    return Object.entries(counts)
      .map(([name, count]) => ({
        name: name || 'Belum/Tidak Bekerja',
        Jumlah: count,
        Persentase: total > 0 ? Math.round((count / total) * 100) : 0
      }))
      .sort((a, b) => b.Jumlah - a.Jumlah)
  }, [filteredMembers])

  // Regional Demographic breakdown
  const regionalDemographicData = useMemo(() => {
    const groupByPuskesmas = isSuperAdmin && filterPuskesmas === 'ALL'
    const entities = groupByPuskesmas
      ? refPuskesmas.filter(p => p.nama && !p.nama.toLowerCase().includes('dinkes'))
      : availableDesa

    return entities.map(entity => {
      const entityMembers = filteredMembers.filter(m => {
        const h = m.households
        return groupByPuskesmas
          ? String(h?.puskesmas_id) === String(entity.id)
          : String(h?.desa_id) === String(entity.id)
      })

      const entityTotal = entityMembers.length
      const name = groupByPuskesmas ? entity.nama : entity.desa_kel

      if (activeDemographicBreakdown === 'gender') {
        const L = entityMembers.filter(m => m.jenis_kelamin === 'L').length
        const P = entityMembers.filter(m => m.jenis_kelamin === 'P').length
        return {
          name,
          'Laki-laki': L,
          'Perempuan': P,
          Total: entityTotal
        }
      } else if (activeDemographicBreakdown === 'education') {
        const eduObj: Record<string, number> = { name } as any
        const list = ['Tidak Sekolah', 'SD/Sederajat', 'SMP/Sederajat', 'SMA/Sederajat', 'D1/D2/D3', 'S1/D4', 'S2', 'S3']
        list.forEach(edu => { eduObj[edu] = 0 })
        entityMembers.forEach(m => {
          const edu = m.pendidikan || 'Tidak Sekolah'
          if (eduObj[edu] !== undefined) {
            eduObj[edu]++
          } else {
            const matched = list.find(l => edu.toLowerCase().includes(l.toLowerCase()))
            if (matched) eduObj[matched]++
            else eduObj['Tidak Sekolah']++
          }
        })
        eduObj.Total = entityTotal
        return eduObj
      } else {
        const topOccs = occupationStats.slice(0, 5).map(o => o.name)
        const occObj: Record<string, number> = { name } as any
        topOccs.forEach(o => { occObj[o] = 0 })
        occObj['Lainnya'] = 0
        
        entityMembers.forEach(m => {
          const occ = m.pekerjaan || 'Belum/Tidak Bekerja'
          if (occObj[occ] !== undefined) {
            occObj[occ]++
          } else {
            occObj['Lainnya']++
          }
        })
        occObj.Total = entityTotal
        return occObj
      }
    }).sort((a, b) => b.Total - a.Total)
  }, [filteredMembers, activeDemographicBreakdown, isSuperAdmin, filterPuskesmas, refPuskesmas, availableDesa, occupationStats])

  const regionalBars = useMemo(() => {
    if (activeDemographicBreakdown === 'gender') {
      return [
        { key: 'Laki-laki', color: '#3b82f6' },
        { key: 'Perempuan', color: '#ec4899' }
      ]
    } else if (activeDemographicBreakdown === 'education') {
      return [
        { key: 'Tidak Sekolah', color: '#94a3b8' },
        { key: 'SD/Sederajat', color: '#f59e0b' },
        { key: 'SMP/Sederajat', color: '#10b981' },
        { key: 'SMA/Sederajat', color: '#3b82f6' },
        { key: 'D1/D2/D3', color: '#8b5cf6' },
        { key: 'S1/D4', color: '#ec4899' },
        { key: 'S2', color: '#14b8a6' },
        { key: 'S3', color: '#ef4444' }
      ]
    } else {
      const colors = ['#10b981', '#3b82f6', '#f59e0b', '#8b5cf6', '#ec4899', '#94a3b8']
      const topOccs = occupationStats.slice(0, 5).map(o => o.name)
      const bars = topOccs.map((name, i) => ({ key: name, color: colors[i] }))
      bars.push({ key: 'Lainnya', color: colors[5] })
      return bars
    }
  }, [activeDemographicBreakdown, occupationStats])

  // Aggregation Helpers
  const calculateIndicatorStats = (data: any[], key: string) => {
    let num = 0
    let den = 0
    data.forEach(s => {
      if (s[key] !== null && s[key] !== undefined) {
        den++
        if (s[key] === true) num++
      }
    })
    return { num, den, pct: den > 0 ? Math.round((num / den) * 100) : 0 }
  }

  // Calculate scores for Capaian PHBS total
  const capaianPhbsCount = useMemo(() => {
    return filteredSurveys.filter(s => {
      let num = 0; let den = 0;
      PHBS_INDICATORS.forEach(ind => {
        if (s[ind.key] !== null && s[ind.key] !== undefined) {
          den++
          if (s[ind.key] === true) num++
        }
      })
      // Based on scoring v2, it's 100% (skor === N) or >= 75 for some old legacy? We will use >= 75 as standard Capaian PHBS here or just the 100% RT Sehat rule.
      // Wait, scoring.ts uses "skor === N" for RT Sehat. But the existing Dashboard uses calculateSkor >= 75. Let's use skor === N for strictly "Rumah Sehat" based on v2, OR let's use the DB's skor_phbs if it exists.
      if (s.skor_phbs !== undefined && s.skor_phbs !== null && s.denominator_phbs) {
        return s.skor_phbs === s.denominator_phbs
      }
      return den > 0 && num === den;
    }).length
  }, [filteredSurveys])

  const kkDisurvei = filteredSurveys.length

  // Sasaran KK filtered — sum of jumlah_kk matching current filters & year
  const sasaranFiltered = useMemo(() => {
    return sasaranData.filter(s => {
      if (s.tahun !== filterYear) return false
      if (isSuperAdmin && filterPuskesmas !== 'ALL') {
        if (s.puskesmas_id !== filterPuskesmas) return false
      } else if (!isSuperAdmin) {
        if (s.puskesmas_id !== user?.puskesmas_id) return false
      }
      if (filterDesa !== 'ALL') {
        if (s.desa_id !== filterDesa) return false
      }
      return true
    })
  }, [sasaranData, filterYear, filterPuskesmas, filterDesa, isSuperAdmin, user?.puskesmas_id])

  const totalSasaranKK = useMemo(() => sasaranFiltered.reduce((sum, s) => sum + (s.jumlah_kk || 0), 0), [sasaranFiltered])
  const hasSasaran = totalSasaranKK > 0

  // Fallback total KK (from households) — only used in persentase if no sasaran
  const totalKkHouseholds = useMemo(() => {
    return allHouseholds.filter(h => {
      let match = true
      if (isSuperAdmin && filterPuskesmas !== 'ALL') {
        if (h.puskesmas_id !== filterPuskesmas) match = false
      } else if (!isSuperAdmin) {
        if (h.puskesmas_id !== user?.puskesmas_id) match = false
      }
      if (filterDesa !== 'ALL') {
        if (h.desa_id !== filterDesa) match = false
      }
      return match
    }).length
  }, [allHouseholds, filterPuskesmas, filterDesa, isSuperAdmin, user?.puskesmas_id])

  // Use sasaran if available, else use households count
  const totalKkFiltered = hasSasaran ? totalSasaranKK : totalKkHouseholds
  
  const persentaseCapaian = kkDisurvei > 0 ? ((capaianPhbsCount / kkDisurvei) * 100).toFixed(2) : "0.00"
  const persentaseDisurvei = totalKkFiltered > 0 ? ((kkDisurvei / totalKkFiltered) * 100).toFixed(2) : "0.00"

  // Metadata chart data — Progress Survey or Capaian PHBS by desa/puskesmas
  const getMetadataChartData = (type: 'progress' | 'capaian') => {
    const groupByPuskesmas = isSuperAdmin && filterPuskesmas === 'ALL'
    
    if (groupByPuskesmas) {
      return refPuskesmas.filter(p => !p.nama.toLowerCase().includes('dinkes')).map(p => {
        const surveysForP = filteredSurveys.filter(s => s.households?.puskesmas_id === p.id)
        const sasaranForP = sasaranData.filter(s => s.puskesmas_id === p.id && s.tahun === filterYear)
        const totalSas = sasaranForP.reduce((sum, s) => sum + (s.jumlah_kk || 0), 0)
        if (type === 'progress') {
          const pct = totalSas > 0 ? Number(((surveysForP.length / totalSas) * 100).toFixed(2)) : 0
          return { name: p.nama, Persentase: Math.min(pct, 100), Disurvei: surveysForP.length, Sasaran: totalSas }
        } else {
          const sehat = surveysForP.filter(s => s.is_rt_sehat).length
          const pct = surveysForP.length > 0 ? Number(((sehat / surveysForP.length) * 100).toFixed(2)) : 0
          return { name: p.nama, Persentase: pct, Sehat: sehat, Total: surveysForP.length }
        }
      }).sort((a, b) => b.Persentase - a.Persentase)
    } else {
      const validDesa = filterPuskesmas !== 'ALL' 
        ? refDesa.filter(d => d.puskesmas_id === filterPuskesmas)
        : refDesa.filter(d => !isSuperAdmin ? d.puskesmas_id === user?.puskesmas_id : true)
      return validDesa.map(d => {
        const surveysForD = filteredSurveys.filter(s => s.households?.desa_id === d.id)
        const sasaranForD = sasaranData.filter(s => s.desa_id === d.id && s.tahun === filterYear)
        const totalSas = sasaranForD.reduce((sum, s) => sum + (s.jumlah_kk || 0), 0)
        if (type === 'progress') {
          const pct = totalSas > 0 ? Number(((surveysForD.length / totalSas) * 100).toFixed(2)) : 0
          return { name: d.desa_kel, Persentase: Math.min(pct, 100), Disurvei: surveysForD.length, Sasaran: totalSas }
        } else {
          const sehat = surveysForD.filter(s => s.is_rt_sehat).length
          const pct = surveysForD.length > 0 ? Number(((sehat / surveysForD.length) * 100).toFixed(2)) : 0
          return { name: d.desa_kel, Persentase: pct, Sehat: sehat, Total: surveysForD.length }
        }
      }).sort((a, b) => b.Persentase - a.Persentase)
    }
  }

  // Chart Data preparation
  const getChartData = (indicatorKey: string) => {
    // Determine grouping: If Superadmin & ALL Puskesmas -> group by Puskesmas. Else -> group by Desa
    const groupByPuskesmas = isSuperAdmin && filterPuskesmas === 'ALL'
    
    if (groupByPuskesmas) {
      // Exclude Dinkes
      const validPuskesmas = refPuskesmas.filter(p => !p.nama.toLowerCase().includes('dinkes'))
      return validPuskesmas.map(p => {
        const surveysForP = filteredSurveys.filter(s => s.households?.puskesmas_id === p.id)
        const stats = calculateIndicatorStats(surveysForP, indicatorKey)
        return {
          name: p.nama,
          Persentase: stats.pct,
          Numerator: stats.num,
          Denominator: stats.den,
        }
      }).sort((a, b) => b.Persentase - a.Persentase)
    } else {
      // Group by Desa
      const validDesa = availableDesa
      return validDesa.map(d => {
        const surveysForD = filteredSurveys.filter(s => s.households?.desa_id === d.id)
        const stats = calculateIndicatorStats(surveysForD, indicatorKey)
        return {
          name: d.desa_kel,
          Persentase: stats.pct,
          Numerator: stats.num,
          Denominator: stats.den,
        }
      }).sort((a, b) => b.Persentase - a.Persentase)
    }
  }

  const renderFilterPanel = () => (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 mb-6 flex flex-wrap gap-4 items-end">
      <div className="flex-1 min-w-[200px]">
        <label className="block text-xs font-medium text-gray-500 mb-1">Tahun Survei</label>
        <select 
          value={filterYear}
          onChange={(e) => setFilterYear(Number(e.target.value))}
          className="w-full bg-gray-50 border border-gray-200 text-gray-900 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
        >
          {years.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>

      {isSuperAdmin && (
        <div className="flex-1 min-w-[200px]">
          <label className="block text-xs font-medium text-gray-500 mb-1">Puskesmas</label>
          <select 
            value={filterPuskesmas}
            onChange={(e) => {
              setFilterPuskesmas(e.target.value)
              setFilterDesa('ALL')
            }}
            className="w-full bg-gray-50 border border-gray-200 text-gray-900 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
          >
            <option value="ALL">Semua Puskesmas</option>
            {refPuskesmas.map(p => <option key={p.id} value={p.id}>{p.nama}</option>)}
          </select>
        </div>
      )}

      <div className="flex-1 min-w-[200px]">
        <label className="block text-xs font-medium text-gray-500 mb-1">Desa/Kelurahan</label>
        <select 
          value={filterDesa}
          onChange={(e) => setFilterDesa(e.target.value)}
          className="w-full bg-gray-50 border border-gray-200 text-gray-900 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
        >
          <option value="ALL">Semua Desa</option>
          {availableDesa.map(d => <option key={d.id} value={d.id}>{d.desa_kel}</option>)}
        </select>
      </div>
    </div>
  )

  const renderIndicatorScoreCards = (indicators: any[]) => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
      {indicators.map(ind => {
        const stats = calculateIndicatorStats(filteredSurveys, ind.key)
        const Icon = ind.icon
        return (
          <div key={ind.key} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 flex flex-col relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
              <Icon size={64} color={ind.color} />
            </div>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${ind.color}15`, color: ind.color }}>
                <Icon size={16} />
              </div>
              <h4 className="text-xs font-semibold text-gray-700 uppercase tracking-wide flex-1 leading-tight">{ind.label}</h4>
            </div>
            <div className="mt-auto">
              <div className="flex items-end gap-2">
                <span className="text-3xl font-bold text-gray-900">{stats.pct}<span className="text-lg text-gray-500">%</span></span>
              </div>
              <p className="text-xs text-gray-500 mt-1 font-medium">{stats.num} / {stats.den} RT</p>
            </div>
            <div className="absolute bottom-0 left-0 h-1 bg-gray-100 w-full">
              <div className="h-full transition-all duration-1000" style={{ width: `${stats.pct}%`, backgroundColor: ind.color }}></div>
            </div>
          </div>
        )
      })}
    </div>
  )

  const renderChartSection = (indicators: any[], activeInd: string, setActiveInd: (key: string) => void, titlePrefix: string) => {
    const chartData = getChartData(activeInd)
    const activeIndObj = indicators.find(i => i.key === activeInd)

    return (
      <div className="bg-white rounded-2xl shadow-md border border-gray-100 overflow-hidden mt-8 transition-shadow hover:shadow-lg">
        <div className="border-b border-gray-100 bg-gray-50/50 p-4 overflow-x-auto whitespace-nowrap scrollbar-hide">
          <div className="flex gap-3">
            {indicators.map(ind => {
              const isActive = activeInd === ind.key;
              return (
                <button
                  key={ind.key}
                  onClick={() => setActiveInd(ind.key)}
                  className={`px-5 py-2 rounded-full text-sm font-semibold transition-all duration-300 border-2 ${
                    isActive 
                      ? 'text-white shadow-md transform scale-105' 
                      : 'bg-white text-gray-500 hover:text-gray-700 hover:bg-gray-50 border-gray-200 hover:border-gray-300 hover:shadow-sm'
                  }`}
                  style={isActive ? { backgroundColor: ind.color, borderColor: ind.color } : {}}
                >
                  {ind.label}
                </button>
              )
            })}
          </div>
        </div>
        <div className="p-6">
          <div className="mb-8 flex justify-between items-center bg-gray-50/50 p-4 rounded-xl border border-gray-100">
            <div>
              <h3 className="text-xl font-bold text-gray-800">{titlePrefix} {activeIndObj?.label}</h3>
              <p className="text-sm text-gray-500 mt-1">Distribusi persentase capaian per wilayah ({isSuperAdmin && filterPuskesmas === 'ALL' ? 'Puskesmas' : 'Desa'})</p>
            </div>
            <div className="text-right flex items-center gap-4">
              <div className="text-right">
                <p className="text-4xl font-black drop-shadow-sm transition-colors duration-500" style={{ color: activeIndObj?.color }}>
                  {calculateIndicatorStats(filteredSurveys, activeInd).pct}%
                </p>
                <p className="text-xs text-gray-500 font-bold uppercase tracking-wider mt-1">Rata-rata Keseluruhan</p>
              </div>
            </div>
          </div>
          
          <div className="h-[400px] w-full mt-4">
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 20, right: 30, left: 0, bottom: 60 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                  <XAxis 
                    dataKey="name" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: '#6b7280', fontSize: 12 }} 
                    angle={-45} 
                    textAnchor="end"
                    interval={0}
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: '#6b7280', fontSize: 12 }}
                    domain={[0, 100]}
                    tickFormatter={(val) => `${val}%`}
                  />
                  <RechartsTooltip 
                    cursor={{ fill: '#f3f4f6' }}
                    content={({ active, payload, label }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div className="bg-white text-gray-800 text-sm rounded-xl p-4 shadow-2xl border border-gray-100">
                            <p className="font-bold text-gray-900 mb-2 border-b border-gray-100 pb-2">{label}</p>
                            <p className="text-gray-600 mb-1 flex justify-between gap-4"><span>Capaian:</span> <span className="font-bold" style={{ color: activeIndObj?.color }}>{data.Persentase}%</span></p>
                            <p className="text-gray-500 text-xs flex justify-between gap-4"><span>Numerator:</span> <span className="font-semibold text-gray-700">{data.Numerator}</span></p>
                            <p className="text-gray-500 text-xs flex justify-between gap-4"><span>Denominator:</span> <span className="font-semibold text-gray-700">{data.Denominator}</span></p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Bar 
                    dataKey="Persentase" 
                    radius={[6, 6, 0, 0]} 
                    maxBarSize={60}
                    animationDuration={1500}
                    animationEasing="ease-out"
                  >
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={activeIndObj?.color || '#3b82f6'} className="transition-all duration-300 hover:opacity-80 cursor-pointer" />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-gray-400">
                Belum ada data untuk ditampilkan pada filter ini.
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-8">
      <WelcomeReminderModal 
        isOpen={showWelcomeModal} 
        onClose={() => setShowWelcomeModal(false)} 
      />
      <div className="mb-6 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Selamat Datang 👋</h2>
          <p className="text-gray-500 mt-1">{puskesmasName} — Sistem Informasi Manajemen PHBS</p>
        </div>
      </div>

      {/* Global Filter Panel */}
      {renderFilterPanel()}

      {/* Main Tabs Navigation */}
      <div className="flex border-b border-gray-200 mb-6 gap-6 overflow-x-auto whitespace-nowrap scrollbar-hide">
        {[
          { id: 'metadata', label: 'Metadata Survey', icon: ClipboardList },
          { id: 'respondents', label: 'Statistics Responden', icon: Users },
          { id: 'phbs', label: 'Capaian Indikator PHBS', icon: Target },
          { id: 'non-phbs', label: 'Capaian Indikator Non PHBS', icon: Activity },
        ].map(tab => {
          const Icon = tab.icon
          const isActive = activeTab === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`pb-4 px-2 text-sm font-bold transition-all border-b-2 flex items-center gap-2 ${
                isActive 
                  ? 'border-emerald-500 text-emerald-600' 
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <Icon size={16} />
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* Tab Contents */}
      {activeTab === 'metadata' && (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          {/* Score Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {/* Total KK Sasaran */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden relative group">
              <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-bl-full -mr-16 -mt-16 opacity-10 group-hover:opacity-20 transition-opacity"></div>
              <div className="p-5 relative">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white flex items-center justify-center text-2xl mb-4 shadow-sm">🏠</div>
                <p className="text-gray-500 text-xs font-semibold uppercase tracking-wide">Sasaran KK {filterYear}</p>
                {hasSasaran ? (
                  <>
                    <p className="text-3xl font-bold text-gray-900 mt-1">{totalSasaranKK.toLocaleString('id')}</p>
                    <p className="text-gray-400 text-xs mt-1 font-medium">KK sasaran survei</p>
                  </>
                ) : (
                  <>
                    <p className="text-3xl font-bold text-gray-300 mt-1">–</p>
                    <p className="text-amber-500 text-xs mt-1 font-medium flex items-center gap-1">⚠️ Sasaran belum diinput</p>
                  </>
                )}
              </div>
            </div>
            {[
              { label: `KK Disurvei ${filterYear}`, value: kkDisurvei.toLocaleString('id'), icon: '📋', color: 'from-blue-500 to-indigo-600', sub: kkDisurvei === 0 ? 'Belum ada data' : 'Keluarga' },
              { label: 'Target Survei', value: hasSasaran ? `${persentaseDisurvei}%` : '–', icon: '🎯', color: 'from-amber-500 to-orange-600', sub: hasSasaran ? 'Dari total sasaran KK' : 'Sasaran belum diinput' },
              { label: 'Capaian PHBS', value: `${persentaseCapaian}%`, icon: '📈', color: 'from-purple-500 to-pink-600', sub: 'Rumah Sehat' },
            ].map((stat) => (
              <div key={stat.label} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden relative group">
                <div className={`absolute top-0 right-0 w-32 h-32 bg-gradient-to-br ${stat.color} rounded-bl-full -mr-16 -mt-16 opacity-10 group-hover:opacity-20 transition-opacity`}></div>
                <div className="p-5 relative">
                  <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${stat.color} text-white flex items-center justify-center text-2xl mb-4 shadow-sm`}>
                    {stat.icon}
                  </div>
                  <p className="text-gray-500 text-xs font-semibold uppercase tracking-wide">{stat.label}</p>
                  <p className={`text-3xl font-bold mt-1 ${stat.value === '–' ? 'text-gray-300' : 'text-gray-900'}`}>{stat.value}</p>
                  <p className="text-gray-400 text-xs mt-1 font-medium">{stat.sub}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Aksi Cepat */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
            <h3 className="text-gray-800 font-semibold mb-4">Aksi Cepat</h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {[
                { icon: '➕', label: 'Tambah Data KK', desc: 'Input rumah tangga baru', href: '/dashboard/households/new' },
                { icon: '📝', label: 'Input Survei PHBS', desc: 'Isi survei rumah tangga', href: '/dashboard/survey/new' },
                { icon: '🎯', label: 'Input Sasaran KK', desc: 'Set target survei per desa', href: '/dashboard/sasaran' },
                { icon: '📊', label: 'Lihat Laporan', desc: 'Rekap & visualisasi data', href: '/dashboard/reports/rekap' },
              ].map((action) => (
                <a
                  key={action.href}
                  href={action.href}
                  className="flex items-center gap-4 p-4 rounded-xl border-2 border-dashed border-gray-200 hover:border-emerald-300 hover:bg-emerald-50 transition-all group"
                >
                  <div className="w-12 h-12 bg-gray-50 group-hover:bg-white rounded-xl flex items-center justify-center text-xl transition-all shadow-sm">
                    {action.icon}
                  </div>
                  <div>
                    <p className="font-semibold text-gray-700 text-sm">{action.label}</p>
                    <p className="text-gray-400 text-xs mt-0.5">{action.desc}</p>
                  </div>
                </a>
              ))}
            </div>
          </div>

          {/* Metadata Charts */}
          <div className="bg-white rounded-2xl shadow-md border border-gray-100 overflow-hidden">
            <div className="border-b border-gray-100 bg-gray-50/50 p-4 flex items-center justify-between">
              <h3 className="font-bold text-gray-800 text-sm">Visualisasi Metadata Survey</h3>
              <div className="flex gap-2">
                {[
                  { id: 'progress', label: '📊 Progress Survey', color: '#3b82f6' },
                  { id: 'capaian', label: '🏆 Capaian PHBS', color: '#10b981' },
                ].map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveMetadataChart(tab.id as any)}
                    className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all border-2 ${
                      activeMetadataChart === tab.id
                        ? 'text-white shadow-md'
                        : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'
                    }`}
                    style={activeMetadataChart === tab.id ? { backgroundColor: tab.color, borderColor: tab.color } : {}}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-sm font-semibold text-gray-700">
                    {activeMetadataChart === 'progress' ? 'Progress Survey: KK Disurvei / Total Sasaran KK' : 'Capaian PHBS: % Rumah Tangga Sehat'}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">Distribusi per {isSuperAdmin && filterPuskesmas === 'ALL' ? 'Puskesmas' : 'Desa'}</p>
                </div>
                <div className="text-right">
                  <p className="text-3xl font-black" style={{ color: activeMetadataChart === 'progress' ? '#3b82f6' : '#10b981' }}>
                    {activeMetadataChart === 'progress' ? `${persentaseDisurvei}%` : `${persentaseCapaian}%`}
                  </p>
                  <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">Rata-rata Keseluruhan</p>
                </div>
              </div>
              {(() => {
                const chartData = getMetadataChartData(activeMetadataChart)
                const chartColor = activeMetadataChart === 'progress' ? '#3b82f6' : '#10b981'
                return chartData.length > 0 ? (
                  <div className="h-[360px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartData} margin={{ top: 20, right: 30, left: 0, bottom: 60 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#6b7280', fontSize: 11 }} angle={-40} textAnchor="end" interval={0} />
                        <YAxis axisLine={false} tickLine={false} tick={{ fill: '#6b7280', fontSize: 12 }} domain={[0, 100]} tickFormatter={v => `${v}%`} />
                        <RechartsTooltip
                          cursor={{ fill: '#f3f4f6' }}
                          content={({ active, payload, label }) => {
                            if (active && payload && payload.length) {
                              const d = payload[0].payload
                              return (
                                <div className="bg-white text-gray-800 text-sm rounded-xl p-4 shadow-2xl border border-gray-100">
                                  <p className="font-bold mb-2 border-b border-gray-100 pb-1">{label}</p>
                                  <p className="flex justify-between gap-4"><span>Capaian:</span> <span className="font-bold" style={{ color: chartColor }}>{d.Persentase}%</span></p>
                                  {activeMetadataChart === 'progress' && <p className="flex justify-between gap-4 text-xs text-gray-500 mt-1"><span>Disurvei / Sasaran:</span> <span>{d.Disurvei} / {d.Sasaran || 'N/A'}</span></p>}
                                  {activeMetadataChart === 'capaian' && <p className="flex justify-between gap-4 text-xs text-gray-500 mt-1"><span>Sehat / Total:</span> <span>{d.Sehat} / {d.Total}</span></p>}
                                </div>
                              )
                            }
                            return null
                          }}
                        />
                        <Bar dataKey="Persentase" radius={[6, 6, 0, 0]} maxBarSize={60} animationDuration={1200} animationEasing="ease-out">
                          {chartData.map((_, i) => <Cell key={i} fill={chartColor} />)}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="h-40 flex items-center justify-center text-gray-400 text-sm">Belum ada data survei untuk filter ini.</div>
                )
              })()}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'respondents' && (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-8">
          {/* Top Metric Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-bl-full opacity-5 group-hover:opacity-10 transition-opacity"></div>
              <p className="text-gray-500 text-xs font-semibold uppercase tracking-wide">Total Responden</p>
              <p className="text-4xl font-extrabold text-gray-900 mt-2">{filteredMembers.length.toLocaleString('id')}</p>
              <p className="text-gray-400 text-xs mt-1 font-medium">Anggota keluarga terdata</p>
            </div>
            
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-bl-full opacity-5 group-hover:opacity-10 transition-opacity"></div>
              <p className="text-gray-500 text-xs font-semibold uppercase tracking-wide">Laki-Laki</p>
              <p className="text-4xl font-extrabold text-blue-600 mt-2">
                {genderStats.L.count.toLocaleString('id')} <span className="text-lg text-gray-400 font-normal">({genderStats.L.pct}%)</span>
              </p>
              <p className="text-gray-400 text-xs mt-1 font-medium">Responden laki-laki</p>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-pink-500 to-rose-600 rounded-bl-full opacity-5 group-hover:opacity-10 transition-opacity"></div>
              <p className="text-gray-500 text-xs font-semibold uppercase tracking-wide">Perempuan</p>
              <p className="text-4xl font-extrabold text-pink-500 mt-2">
                {genderStats.P.count.toLocaleString('id')} <span className="text-lg text-gray-400 font-normal">({genderStats.P.pct}%)</span>
              </p>
              <p className="text-gray-400 text-xs mt-1 font-medium">Responden perempuan</p>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-amber-500 to-orange-600 rounded-bl-full opacity-5 group-hover:opacity-10 transition-opacity"></div>
              <p className="text-gray-500 text-xs font-semibold uppercase tracking-wide">Rasio Gender</p>
              <p className="text-4xl font-extrabold text-amber-500 mt-2">
                {genderStats.total > 0 ? (genderStats.L.count / Math.max(1, genderStats.P.count)).toFixed(2) : '0'}
              </p>
              <p className="text-gray-400 text-xs mt-1 font-medium">Perbandingan L dibanding P</p>
            </div>
          </div>

          {/* Demographics Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Gender Donut Chart */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 flex flex-col">
              <div>
                <h3 className="font-bold text-gray-800 text-sm">Distribusi Jenis Kelamin</h3>
                <p className="text-xs text-gray-400 mt-0.5">Persentase Laki-laki vs Perempuan</p>
              </div>
              <div className="h-64 w-full flex items-center justify-center relative mt-4">
                {filteredMembers.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={[
                          { name: 'Laki-laki', value: genderStats.L.count, color: '#3b82f6' },
                          { name: 'Perempuan', value: genderStats.P.count, color: '#ec4899' }
                        ]}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        <Cell fill="#3b82f6" />
                        <Cell fill="#ec4899" />
                      </Pie>
                      <RechartsTooltip 
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            const d = payload[0].payload;
                            const pct = genderStats.total > 0 ? Math.round((d.value / genderStats.total) * 100) : 0;
                            return (
                              <div className="bg-white text-gray-800 text-xs rounded-xl p-3 shadow-xl border border-gray-100">
                                <p className="font-bold">{d.name}</p>
                                <p className="text-gray-500 mt-1">Jumlah: <span className="font-bold text-gray-800">{d.value.toLocaleString('id')}</span></p>
                                <p className="text-gray-500">Porsi: <span className="font-bold text-gray-800">{pct}%</span></p>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-gray-400 text-xs">Belum ada data</p>
                )}
                {filteredMembers.length > 0 && (
                  <div className="absolute flex flex-col items-center justify-center">
                    <span className="text-2xl font-black text-gray-800">{filteredMembers.length}</span>
                    <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Jiwa</span>
                  </div>
                )}
              </div>
              <div className="flex justify-center gap-6 mt-auto pt-4 border-t border-gray-50">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                  <span className="text-xs font-semibold text-gray-600">Laki-laki ({genderStats.L.pct}%)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-pink-500"></div>
                  <span className="text-xs font-semibold text-gray-600">Perempuan ({genderStats.P.pct}%)</span>
                </div>
              </div>
            </div>

            {/* Education Level Chart */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 lg:col-span-2 flex flex-col">
              <div>
                <h3 className="font-bold text-gray-800 text-sm">Tingkat Pendidikan Responden</h3>
                <p className="text-xs text-gray-400 mt-0.5">Distribusi jenjang pendidikan terdata</p>
              </div>
              <div className="h-64 w-full mt-4 flex-1">
                {filteredMembers.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={educationStats}
                      layout="vertical"
                      margin={{ top: 10, right: 30, left: 40, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                      <XAxis type="number" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 10 }} />
                      <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fill: '#475569', fontSize: 11, fontWeight: 'bold' }} width={80} />
                      <RechartsTooltip
                        cursor={{ fill: '#f8fafc' }}
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            const d = payload[0].payload;
                            return (
                              <div className="bg-white text-gray-800 text-xs rounded-xl p-3 shadow-xl border border-gray-100">
                                <p className="font-bold text-gray-900 border-b pb-1 mb-1">{d.name}</p>
                                <p className="text-gray-500">Responden: <span className="font-bold text-gray-800">{d.Jumlah.toLocaleString('id')} orang</span></p>
                                <p className="text-gray-500">Persentase: <span className="font-bold text-gray-800">{d.Persentase}%</span></p>
                              </div>
                            )
                          }
                          return null;
                        }}
                      />
                      <Bar dataKey="Jumlah" fill="#3b82f6" radius={[0, 4, 4, 0]} maxBarSize={20}>
                        {educationStats.map((entry, index) => {
                          const colors = ['#94a3b8', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6', '#ef4444']
                          return <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
                        })}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-gray-400 text-xs">Belum ada data</div>
                )}
              </div>
            </div>

            {/* Occupation Distribution Chart */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 lg:col-span-3 flex flex-col">
              <div>
                <h3 className="font-bold text-gray-800 text-sm">Distribusi Pekerjaan Responden</h3>
                <p className="text-xs text-gray-400 mt-0.5">Pekerjaan terdata diurutkan dari yang paling umum</p>
              </div>
              <div className="h-80 w-full mt-4 flex-1">
                {filteredMembers.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={occupationStats.slice(0, 10)}
                      layout="vertical"
                      margin={{ top: 10, right: 30, left: 60, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                      <XAxis type="number" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 10 }} />
                      <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fill: '#475569', fontSize: 11, fontWeight: 'bold' }} width={120} />
                      <RechartsTooltip
                        cursor={{ fill: '#f8fafc' }}
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            const d = payload[0].payload;
                            return (
                              <div className="bg-white text-gray-800 text-xs rounded-xl p-3 shadow-xl border border-gray-100">
                                <p className="font-bold text-gray-900 border-b pb-1 mb-1">{d.name}</p>
                                <p className="text-gray-500">Responden: <span className="font-bold text-gray-800">{d.Jumlah.toLocaleString('id')} orang</span></p>
                                <p className="text-gray-500">Persentase: <span className="font-bold text-gray-800">{d.Persentase}%</span></p>
                              </div>
                            )
                          }
                          return null;
                        }}
                      />
                      <Bar dataKey="Jumlah" fill="#10b981" radius={[0, 4, 4, 0]} maxBarSize={20}>
                        {occupationStats.slice(0, 10).map((entry, index) => {
                          const colors = ['#10b981', '#3b82f6', '#f59e0b', '#8b5cf6', '#ec4899', '#94a3b8', '#14b8a6', '#ef4444', '#f97316', '#64748b']
                          return <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
                        })}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-gray-400 text-xs">Belum ada data</div>
                )}
              </div>
            </div>

          </div>

          {/* Regional Stacked Demographic Distribution Chart */}
          <div className="bg-white rounded-2xl shadow-md border border-gray-100 overflow-hidden">
            <div className="border-b border-gray-100 bg-gray-50/50 p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h3 className="font-bold text-gray-800 text-sm">Analisis Distribusi Wilayah</h3>
                <p className="text-xs text-gray-400 mt-0.5">Analisis spasial demografi responden berdasarkan {isSuperAdmin && filterPuskesmas === 'ALL' ? 'Puskesmas' : 'Desa'}</p>
              </div>
              <div className="flex gap-2">
                {[
                  { id: 'gender', label: '👫 Jenis Kelamin', color: '#3b82f6' },
                  { id: 'education', label: '🎓 Pendidikan', color: '#8b5cf6' },
                  { id: 'occupation', label: '💼 Pekerjaan', color: '#10b981' }
                ].map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveDemographicBreakdown(tab.id as any)}
                    className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all border-2 ${
                      activeDemographicBreakdown === tab.id
                        ? 'text-white shadow-md'
                        : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'
                    }`}
                    style={activeDemographicBreakdown === tab.id ? { backgroundColor: tab.color, borderColor: tab.color } : {}}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>
            
            <div className="p-6">
              <div className="h-[480px] w-full">
                {regionalDemographicData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={regionalDemographicData}
                      margin={{ top: 20, right: 30, left: 0, bottom: 20 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                      <XAxis 
                        dataKey="name" 
                        height={120}
                        axisLine={false} 
                        tickLine={false} 
                        tick={{ fill: '#6b7280', fontSize: 10 }} 
                        angle={-40} 
                        textAnchor="end"
                        interval={0}
                      />
                      <YAxis 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{ fill: '#6b7280', fontSize: 12 }}
                      />
                      <RechartsTooltip
                        cursor={{ fill: '#f3f4f6' }}
                        content={({ active, payload, label }) => {
                          if (active && payload && payload.length) {
                            return (
                              <div className="bg-white text-gray-800 text-xs rounded-xl p-4 shadow-2xl border border-gray-100 max-w-[280px]">
                                <p className="font-bold text-gray-900 mb-2 border-b border-gray-100 pb-2">{label}</p>
                                <div className="space-y-1.5 max-h-[200px] overflow-y-auto pr-1">
                                  {payload.map((item, i) => {
                                    const total = payload[0].payload.Total;
                                    const pct = total > 0 ? Math.round((Number(item.value) / total) * 100) : 0;
                                    return (
                                      <p key={i} className="flex justify-between gap-4 text-gray-600 font-medium">
                                        <span className="flex items-center gap-1.5">
                                          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }}></span>
                                          {item.name}:
                                        </span>
                                        <span className="font-bold text-gray-800">
                                          {item.value} <span className="text-[10px] text-gray-400 font-normal">({pct}%)</span>
                                        </span>
                                      </p>
                                    );
                                  })}
                                </div>
                                <p className="mt-2 pt-1 border-t border-gray-100 text-right text-[10px] text-gray-400 font-bold uppercase tracking-wider">
                                  Total: {payload[0].payload.Total} Responden
                                </p>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <Legend 
                        iconType="circle"
                        wrapperStyle={{ paddingTop: 10, fontSize: 12, fontWeight: 'semibold' }}
                      />
                      {regionalBars.map(bar => (
                        <Bar 
                          key={bar.key}
                          dataKey={bar.key} 
                          stackId="a" 
                          fill={bar.color} 
                          maxBarSize={50}
                        />
                      ))}
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-gray-400 text-xs">
                    Belum ada data untuk filter wilayah ini.
                  </div>
                )}
              </div>
            </div>
          </div>

        </div>
      )}

      {activeTab === 'phbs' && (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          {renderIndicatorScoreCards(PHBS_INDICATORS)}
          {renderChartSection(PHBS_INDICATORS, activePhbsInd, setActivePhbsInd, "Grafik Capaian Indikator PHBS:")}
        </div>
      )}

      {activeTab === 'non-phbs' && (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          {renderIndicatorScoreCards(NON_PHBS_INDICATORS)}
          {renderChartSection(NON_PHBS_INDICATORS, activeNonPhbsInd, setActiveNonPhbsInd, "Grafik Capaian Indikator Non PHBS:")}
        </div>
      )}

    </div>
  )
}
