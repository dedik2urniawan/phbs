'use client'

import React, { useState, useMemo } from 'react'
import { AppUser } from '@/lib/types'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer, Cell } from 'recharts'
import { Activity, Home, ClipboardList, Target, TrendingUp, CheckCircle, Droplets, Utensils, CigaretteOff, Users, Stethoscope, Baby } from 'lucide-react'

interface Props {
  user: AppUser & { ref_puskesmas?: { nama: string; kecamatan: string } | null }
  totalKK: number
  surveysData: any[]
  refPuskesmas: any[]
  refDesa: any[]
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

export default function DashboardClient({ user, totalKK, surveysData, refPuskesmas, refDesa }: Props) {
  const isSuperAdmin = user?.role === 'superadmin'
  const puskesmasName = isSuperAdmin ? 'Dinkes Kab. Malang' : `Puskesmas ${user?.ref_puskesmas?.nama || ''}`.trim()
  
  const currentYear = new Date().getFullYear()
  
  // States
  const [activeTab, setActiveTab] = useState<'metadata' | 'phbs' | 'non-phbs'>('metadata')
  const [filterYear, setFilterYear] = useState<number>(currentYear)
  const [filterPuskesmas, setFilterPuskesmas] = useState<string>('ALL')
  const [filterDesa, setFilterDesa] = useState<string>('ALL')
  
  const [activePhbsInd, setActivePhbsInd] = useState(PHBS_INDICATORS[0].key)
  const [activeNonPhbsInd, setActiveNonPhbsInd] = useState(NON_PHBS_INDICATORS[0].key)

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
  const totalKkFiltered = totalKK // Ideally, if filtering by Desa, totalKK should adjust, but totalKK passed from server is just global/puskesmas level. We'll use the ratio of surveyed vs registered as best effort.
  
  const persentaseCapaian = kkDisurvei > 0 ? Math.round((capaianPhbsCount / kkDisurvei) * 100) : 0
  const persentaseDisurvei = totalKkFiltered > 0 ? Math.round((kkDisurvei / totalKkFiltered) * 100) : 0

  // Chart Data preparation
  const getChartData = (indicatorKey: string) => {
    // Determine grouping: If Superadmin & ALL Puskesmas -> group by Puskesmas. Else -> group by Desa
    const groupByPuskesmas = isSuperAdmin && filterPuskesmas === 'ALL'
    
    const groups: Record<string, any[]> = {}
    
    filteredSurveys.forEach(s => {
      const gId = groupByPuskesmas ? s.households?.puskesmas_id : s.households?.desa_id
      const gName = groupByPuskesmas ? s.households?.ref_puskesmas?.nama : s.households?.ref_desa?.desa_kel
      const finalName = gName || 'Tidak Diketahui'
      
      if (!groups[finalName]) groups[finalName] = []
      groups[finalName].push(s)
    })

    return Object.keys(groups).map(name => {
      const stats = calculateIndicatorStats(groups[name], indicatorKey)
      return {
        name,
        Persentase: stats.pct,
        Numerator: stats.num,
        Denominator: stats.den,
      }
    }).sort((a, b) => b.Persentase - a.Persentase)
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

  const renderChartSection = (indicators: any[], activeInd: string, setActiveInd: (key: string) => void) => {
    const chartData = getChartData(activeInd)
    const activeIndObj = indicators.find(i => i.key === activeInd)

    return (
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="border-b border-gray-100 bg-gray-50 p-2 overflow-x-auto whitespace-nowrap scrollbar-hide">
          <div className="flex gap-2">
            {indicators.map(ind => (
              <button
                key={ind.key}
                onClick={() => setActiveInd(ind.key)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  activeInd === ind.key 
                    ? 'bg-white shadow-sm text-gray-900 border border-gray-200' 
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100 border border-transparent'
                }`}
              >
                {ind.label}
              </button>
            ))}
          </div>
        </div>
        <div className="p-6">
          <div className="mb-6 flex justify-between items-center">
            <div>
              <h3 className="text-lg font-bold text-gray-800">Grafik {activeIndObj?.label}</h3>
              <p className="text-sm text-gray-500">Persentase capaian per wilayah ({isSuperAdmin && filterPuskesmas === 'ALL' ? 'Puskesmas' : 'Desa'})</p>
            </div>
            <div className="text-right">
              <p className="text-3xl font-bold" style={{ color: activeIndObj?.color }}>
                {calculateIndicatorStats(filteredSurveys, activeInd).pct}%
              </p>
              <p className="text-xs text-gray-500 font-medium">Rata-rata Keseluruhan</p>
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
                          <div className="bg-gray-900 text-white text-sm rounded-lg p-3 shadow-xl">
                            <p className="font-bold mb-1">{label}</p>
                            <p className="text-gray-300">Capaian: <span className="text-white font-semibold">{data.Persentase}%</span></p>
                            <p className="text-gray-300 text-xs mt-1">Numerator: {data.Numerator}</p>
                            <p className="text-gray-300 text-xs">Denominator: {data.Denominator}</p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Bar dataKey="Persentase" radius={[4, 4, 0, 0]} maxBarSize={50}>
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={activeIndObj?.color || '#3b82f6'} />
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
      <div className="mb-6 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Selamat Datang 👋</h2>
          <p className="text-gray-500 mt-1">{puskesmasName} — Sistem Informasi Manajemen PHBS</p>
        </div>
      </div>

      {/* Global Filter Panel */}
      {renderFilterPanel()}

      {/* Main Tabs Navigation */}
      <div className="flex border-b border-gray-200 mb-6 gap-6">
        {[
          { id: 'metadata', label: 'Metadata Survey', icon: ClipboardList },
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {[
              { label: 'Total KK Terdaftar', value: totalKkFiltered.toLocaleString('id'), icon: '🏠', color: 'from-emerald-500 to-teal-600', sub: 'Rumah tangga' },
              { label: `KK Disurvei ${filterYear}`, value: kkDisurvei.toLocaleString('id'), icon: '📋', color: 'from-blue-500 to-indigo-600', sub: kkDisurvei === 0 ? 'Belum ada data' : 'Keluarga' },
              { label: 'Target Survei', value: `${persentaseDisurvei}%`, icon: '🎯', color: 'from-amber-500 to-orange-600', sub: 'Dari total KK' },
              { label: 'Capaian PHBS', value: `${persentaseCapaian}%`, icon: '📈', color: 'from-purple-500 to-pink-600', sub: 'Rumah Sehat' },
            ].map((stat) => (
              <div key={stat.label} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden relative group">
                <div className={`absolute top-0 right-0 w-32 h-32 bg-gradient-to-br ${stat.color} rounded-bl-full -mr-16 -mt-16 opacity-10 group-hover:opacity-20 transition-opacity`}></div>
                <div className="p-5 relative">
                  <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${stat.color} text-white flex items-center justify-center text-2xl mb-4 shadow-sm`}>
                    {stat.icon}
                  </div>
                  <p className="text-gray-500 text-xs font-semibold uppercase tracking-wide">{stat.label}</p>
                  <p className="text-3xl font-bold text-gray-900 mt-1">{stat.value}</p>
                  <p className="text-gray-400 text-xs mt-1 font-medium">{stat.sub}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <h3 className="text-gray-800 font-semibold mb-4">Aksi Cepat</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                { icon: '➕', label: 'Tambah Data KK', desc: 'Input rumah tangga baru', href: '/dashboard/households/new', color: 'emerald' },
                { icon: '📝', label: 'Input Survei PHBS', desc: 'Isi survei rumah tangga', href: '/dashboard/survey/new', color: 'blue' },
                { icon: '📊', label: 'Lihat Laporan', desc: 'Rekap & visualisasi data', href: '/dashboard/reports/rekap', color: 'purple' },
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
        </div>
      )}

      {activeTab === 'phbs' && (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          {renderIndicatorScoreCards(PHBS_INDICATORS)}
          {renderChartSection(PHBS_INDICATORS, activePhbsInd, setActivePhbsInd)}
        </div>
      )}

      {activeTab === 'non-phbs' && (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          {renderIndicatorScoreCards(NON_PHBS_INDICATORS)}
          {renderChartSection(NON_PHBS_INDICATORS, activeNonPhbsInd, setActiveNonPhbsInd)}
        </div>
      )}

    </div>
  )
}
