'use client'

import { AppUser } from '@/lib/types'
import dynamic from 'next/dynamic'
import { 
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  PieChart, Pie, Cell
} from 'recharts'

const DynamicMap = dynamic(() => import('@/components/MapChart'), {
  ssr: false,
  loading: () => <div className="w-full h-[400px] bg-gray-100 rounded-xl animate-pulse flex items-center justify-center">Loading Map...</div>
})

interface Props {
  appUser: AppUser
  dbAnalytics?: any
}

// Fallback Mock Data
const MOCK_radarData = [
  { subject: 'Persalinan Nakes', A: 95, fullMark: 100 },
  { subject: 'ASI Eksklusif', A: 82, fullMark: 100 },
  { subject: 'Timbang Balita', A: 88, fullMark: 100 },
  { subject: 'Air Bersih', A: 99, fullMark: 100 },
  { subject: 'Cuci Tangan', A: 70, fullMark: 100 },
  { subject: 'Jamban Sehat', A: 92, fullMark: 100 },
  { subject: 'Bebas Jentik', A: 65, fullMark: 100 },
  { subject: 'Makan Sayur Buah', A: 55, fullMark: 100 },
  { subject: 'Aktivitas Fisik', A: 60, fullMark: 100 },
  { subject: 'Tidak Merokok', A: 45, fullMark: 100 },
]

const paretoData = [
  { name: 'Anggota Merokok', failure: 55 },
  { name: 'Kurang Sayur Buah', failure: 45 },
  { name: 'Jarang Olahraga', failure: 40 },
  { name: 'Ada Jentik', failure: 35 },
  { name: 'CTPS Kurang', failure: 30 },
]

const germasData = [
  { name: 'Desa A', Posyandu: 85, CKG: 60 },
  { name: 'Desa B', Posyandu: 90, CKG: 75 },
  { name: 'Desa C', Posyandu: 70, CKG: 50 },
  { name: 'Desa D', Posyandu: 95, CKG: 85 },
]

const donutData = [
  { name: 'Sehat', value: 350 },
  { name: 'Tidak Sehat', value: 150 },
]

const COLORS = ['#10b981', '#ef4444', '#f59e0b', '#3b82f6', '#8b5cf6']

const rentanData = {
  bumilTarget: 90,
  bumilCapaian: 75,
  remajaTarget: 90,
  remajaCapaian: 60,
}

const correlationMatrix = [
  { ind1: 'Merokok', ind2: 'Sayur/Buah', value: 0.45 },
  { ind1: 'Merokok', ind2: 'Aktivitas', value: 0.52 },
  { ind1: 'Sayur/Buah', ind2: 'Aktivitas', value: 0.78 },
  { ind1: 'CTPS', ind2: 'Jamban', value: 0.85 },
  { ind1: 'CTPS', ind2: 'Air Bersih', value: 0.65 },
  { ind1: 'Jentik', ind2: 'Jamban', value: 0.42 },
]

const getCorrelationColor = (val: number) => {
  if (val >= 0.8) return 'bg-red-600'
  if (val >= 0.6) return 'bg-red-400'
  if (val >= 0.4) return 'bg-red-300'
  return 'bg-blue-200'
}

export default function ReportsClient({ appUser, dbAnalytics }: Props) {
  // Use DB data if available, otherwise fallback to mock
  const dataRadar = dbAnalytics?.radar_data || MOCK_radarData;
  
  // Sort pareto data by highest failure
  const rawPareto = dbAnalytics?.pareto_data || paretoData;
  const dataPareto = [...rawPareto].sort((a, b) => b.failure - a.failure).slice(0, 5); // top 5 bottlenecks
  
  const dataGermas = dbAnalytics?.germas_data?.length > 0 ? dbAnalytics.germas_data : germasData;
  const dataRentan = dbAnalytics?.rentan_data || rentanData;
  
  const totalKK = dbAnalytics?.total_surveys || 500;
  const iks = dbAnalytics?.iks_phbs || 70.0;
  
  const dataDonut = dbAnalytics ? [
    { name: 'Sehat', value: dbAnalytics.total_sehat },
    { name: 'Tidak Sehat', value: dbAnalytics.total_tidak_sehat },
  ] : donutData;

  const dataCorrelation = dbAnalytics?.correlation_matrix || correlationMatrix;

  return (
    <div className="space-y-6">
      
      {/* 1. Top Row: Executive Summary KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-500 font-medium">Total Rumah Tangga Disurvei</p>
            <p className="text-3xl font-bold text-gray-800 mt-2">{totalKK} <span className="text-sm font-normal text-gray-400">KK</span></p>
          </div>
          <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center text-2xl">📋</div>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-500 font-medium">Indeks Keluarga Sehat (IKS)</p>
            <p className="text-3xl font-bold text-emerald-600 mt-2">{iks}% <span className="text-sm font-normal text-gray-400">IKS-PHBS</span></p>
          </div>
          <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center text-2xl">📈</div>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
          <div className="w-24 h-24">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={dataDonut}
                  cx="50%"
                  cy="50%"
                  innerRadius={30}
                  outerRadius={45}
                  paddingAngle={5}
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
          <div className="flex-1">
            <p className="text-sm font-medium text-gray-800 flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-emerald-500 block"></span> {dataDonut[0].value} Sehat
            </p>
            <p className="text-sm font-medium text-gray-500 flex items-center gap-2 mt-2">
              <span className="w-3 h-3 rounded-full bg-red-500 block"></span> {dataDonut[1].value} Tidak
            </p>
          </div>
        </div>
      </div>

      {/* 2. Middle Row: Choropleth Map & Radar Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Choropleth Map */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col">
          <h3 className="text-lg font-bold text-gray-800 mb-1">Pemetaan IKS Spasial</h3>
          <p className="text-xs text-gray-500 mb-6">Distribusi status PHBS per wilayah administratif (GeoJSON)</p>
          <div className="flex-1 min-h-[400px]">
             <DynamicMap appUser={appUser} />
          </div>
        </div>

        {/* Radar Chart: 10 Indikator */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col">
          <h3 className="text-lg font-bold text-gray-800 mb-1">Capaian 10 Indikator PHBS</h3>
          <p className="text-xs text-gray-500 mb-6">Identifikasi gap dan performa setiap indikator utama</p>
          <div className="flex-1 min-h-[400px]">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart cx="50%" cy="50%" outerRadius="75%" data={dataRadar}>
                <PolarGrid stroke="#e5e7eb" />
                <PolarAngleAxis dataKey="subject" tick={{ fill: '#6b7280', fontSize: 11 }} />
                <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fill: '#9ca3af', fontSize: 10 }} />
                <Radar name="Capaian Wilayah (%)" dataKey="A" stroke="#10b981" fill="#10b981" fillOpacity={0.4} />
                <Tooltip />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* 3. Bottom Row: Bottlenecks & GERMAS Integration */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* The Culprit / Pareto */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <h3 className="text-lg font-bold text-gray-800 mb-1">Penyebab Gagal Terbanyak (Bottlenecks)</h3>
          <p className="text-xs text-gray-500 mb-6">Indikator dengan tingkat kegagalan tertinggi pada KK Tidak Sehat</p>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dataPareto} layout="vertical" margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f3f4f6" />
                <XAxis type="number" hide />
                <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fill: '#4b5563', fontSize: 12 }} />
                <Tooltip cursor={{fill: 'transparent'}} />
                <Bar dataKey="failure" fill="#ef4444" radius={[0, 4, 4, 0]} barSize={20} name="Total Gagal" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* GERMAS Stacked Bar */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <h3 className="text-lg font-bold text-gray-800 mb-1">Integrasi GERMAS & Posyandu</h3>
          <p className="text-xs text-gray-500 mb-6">Tingkat partisipasi Cek Kesehatan Gratis (CKG) dan Kunjungan Posyandu</p>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dataGermas} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#6b7280', fontSize: 12 }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#9ca3af', fontSize: 11 }} />
                <Tooltip cursor={{fill: '#f9fafb'}} />
                <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px' }} />
                <Bar dataKey="Posyandu" stackId="a" fill="#3b82f6" name="Hadir Posyandu (%)" radius={[0, 0, 4, 4]} maxBarSize={40} />
                <Bar dataKey="CKG" stackId="a" fill="#8b5cf6" name="Melakukan CKG (%)" radius={[4, 4, 0, 0]} maxBarSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* 4. Bottom Row 2: Kelompok Rentan & Advanced Analytics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Kelompok Rentan TTD */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-center">
          <h3 className="text-lg font-bold text-gray-800 mb-1">Analisis Kelompok Rentan (TTD)</h3>
          <p className="text-xs text-gray-500 mb-8">Kepatuhan konsumsi Tablet Tambah Darah vs Target Nasional</p>
          
          <div className="space-y-8">
            {/* Bumil */}
            <div>
              <div className="flex justify-between items-end mb-2">
                <div>
                  <p className="font-semibold text-gray-700">Ibu Hamil</p>
                  <p className="text-xs text-gray-500">Mengkonsumsi TTD</p>
                </div>
                <div className="text-right">
                  <span className="text-2xl font-bold text-pink-600">{dataRentan.bumilCapaian}%</span>
                  <span className="text-xs text-gray-400 ml-1">/ {dataRentan.bumilTarget}%</span>
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
                  <p className="font-semibold text-gray-700">Remaja Putri</p>
                  <p className="text-xs text-gray-500">Mengkonsumsi TTD</p>
                </div>
                <div className="text-right">
                  <span className="text-2xl font-bold text-purple-600">{dataRentan.remajaCapaian}%</span>
                  <span className="text-xs text-gray-400 ml-1">/ {dataRentan.remajaTarget}%</span>
                </div>
              </div>
              <div className="w-full bg-gray-100 h-4 rounded-full overflow-hidden relative">
                {/* Target Line */}
                <div className="absolute top-0 bottom-0 w-0.5 bg-gray-400 z-10" style={{ left: `${dataRentan.remajaTarget}%` }}></div>
                {/* Progress */}
                <div className="bg-gradient-to-r from-purple-400 to-purple-500 h-full rounded-full transition-all duration-1000" style={{ width: `${dataRentan.remajaCapaian}%` }}></div>
              </div>
            </div>
            
            <div className="pt-2 flex items-center gap-4 text-xs text-gray-500">
              <div className="flex items-center gap-1"><span className="w-3 h-3 bg-gray-400 rounded-sm"></span> Target 90%</div>
              <div className="flex items-center gap-1"><span className="w-3 h-3 bg-pink-400 rounded-sm"></span> Capaian Wilayah</div>
            </div>
          </div>
        </div>

        {/* Heatmap Korelasi */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <h3 className="text-lg font-bold text-gray-800 mb-1">Matriks Korelasi Indikator</h3>
          <p className="text-xs text-gray-500 mb-6">Hubungan statistik antar indikator kesehatan (Root Cause Analysis)</p>
          
          <div className="grid grid-cols-2 gap-4">
            {dataCorrelation.map((item: any, i: number) => (
              <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 border border-gray-100 hover:border-emerald-200 transition-colors">
                <div className={`w-12 h-12 rounded-lg flex items-center justify-center text-white font-bold text-sm ${getCorrelationColor(item.value)}`}>
                  {item.value.toFixed(2)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-gray-500 truncate">{item.ind1}</p>
                  <p className="text-xs font-semibold text-gray-700 break-words leading-tight">vs {item.ind2}</p>
                </div>
              </div>
            ))}
          </div>
          <p className="text-[10px] text-gray-400 mt-4 text-center">Warna merah pekat menunjukkan korelasi positif yang sangat kuat.</p>
        </div>
      </div>

    </div>
  )
}
