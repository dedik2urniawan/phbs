'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import {
  Users,
  CigaretteOff,
  HeartPulse,
  Baby,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  Activity,
} from 'lucide-react'

interface AgeBucket {
  total: number
  male: number
  female: number
  rt_sehat: number
  i1_num: number
  i1_den: number
  i2_num: number
  i2_den: number
  i3_num: number
  i3_den: number
  i5_num: number
  i5_den: number
  i8_num: number
  i8_den: number
  i9_num: number
  i9_den: number
  i10_num: number
  i10_den: number
  i10_m_num: number
  i10_m_den: number
  ckg_num: number
  ckg_den: number
  pos_num: number
  pos_den: number
  bumil_num: number
  bumil_ttd_num: number
  rematri_ttd_num: number
  rematri_ttd_den: number
}

interface AgeSnapshot {
  tahun: number
  classified_art: number
  age_groups: { key: string; label: string; min: number; max: number }[]
  global: Record<string, AgeBucket>
  by_puskesmas: Record<string, Record<string, AgeBucket>>
  by_desa: Record<string, Record<string, AgeBucket>>
}

interface Props {
  selectedPuskesmas: string
  selectedDesa: string
  puskesmasList: any[]
  desaList: any[]
}

const pct = (num: number, den: number): number => {
  if (!den) return 0
  return Number(((num / den) * 100).toFixed(1))
}

export default function AgeAnalysisTab({
  selectedPuskesmas,
  selectedDesa,
  puskesmasList,
  desaList,
}: Props) {
  const [snapshot, setSnapshot] = useState<AgeSnapshot | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    fetch('/data/phbs-age-snapshot-2026.json')
      .then((res) => {
        if (!res.ok) throw new Error('Gagal memuat data kategori usia')
        return res.json()
      })
      .then((json: AgeSnapshot) => {
        if (active) {
          setSnapshot(json)
          setLoading(false)
        }
      })
      .catch((err) => {
        if (active) {
          setError(err.message || 'Gagal memuat snapshot usia')
          setLoading(false)
        }
      })
    return () => {
      active = false
    }
  }, [])

  const regionLabel = useMemo(() => {
    if (selectedDesa !== 'all') {
      const d = desaList.find((item) => String(item.id) === String(selectedDesa))
      const p = puskesmasList.find((item) => String(item.id) === String(selectedPuskesmas))
      return `Desa ${d?.desa_kel || '-'} (${p?.nama || 'Puskesmas'})`
    }
    if (selectedPuskesmas !== 'all') {
      const p = puskesmasList.find((item) => String(item.id) === String(selectedPuskesmas))
      return `Puskesmas ${p?.nama || '-'}`
    }
    return 'Kabupaten Malang (Semua Wilayah)'
  }, [selectedPuskesmas, selectedDesa, puskesmasList, desaList])

  const activeBuckets = useMemo(() => {
    if (!snapshot) return null
    if (selectedDesa !== 'all' && snapshot.by_desa[selectedDesa]) {
      return snapshot.by_desa[selectedDesa]
    }
    if (selectedPuskesmas !== 'all' && snapshot.by_puskesmas[selectedPuskesmas]) {
      return snapshot.by_puskesmas[selectedPuskesmas]
    }
    return snapshot.global
  }, [snapshot, selectedPuskesmas, selectedDesa])

  const ageRows = useMemo(() => {
    if (!snapshot || !activeBuckets) return []
    const totalAll = snapshot.age_groups.reduce(
      (sum, g) => sum + (activeBuckets[g.key]?.total || 0),
      0
    )

    return snapshot.age_groups.map((g) => {
      const b = activeBuckets[g.key]
      if (!b) {
        return {
          key: g.key,
          label: g.label,
          shortLabel: g.label.split(' ')[0],
          total: 0,
          sharePct: 0,
          male: 0,
          female: 0,
          rtSehatPct: 0,
          ctpsPct: 0,
          sayurPct: 0,
          aktivitasPct: 0,
          tidakMerokokPct: 0,
          merokokPct: 0,
          merokokMalePct: 0,
          ckgPct: 0,
          posyanduPct: 0,
          raw: null as AgeBucket | null,
        }
      }
      const tidakMerokokPct = pct(b.i10_num, b.i10_den)
      const tidakMerokokMalePct = pct(b.i10_m_num, b.i10_m_den)
      return {
        key: g.key,
        label: g.label,
        shortLabel: g.label.split(' ')[0],
        total: b.total,
        sharePct: pct(b.total, totalAll),
        male: b.male,
        female: b.female,
        rtSehatPct: pct(b.rt_sehat, b.total),
        ctpsPct: pct(b.i5_num, b.i5_den),
        sayurPct: pct(b.i8_num, b.i8_den),
        aktivitasPct: pct(b.i9_num, b.i9_den),
        tidakMerokokPct,
        merokokPct: b.i10_den > 0 ? Number((100 - tidakMerokokPct).toFixed(1)) : 0,
        merokokMalePct: b.i10_m_den > 0 ? Number((100 - tidakMerokokMalePct).toFixed(1)) : 0,
        ckgPct: pct(b.ckg_num, b.ckg_den),
        posyanduPct: pct(b.pos_num, b.pos_den),
        raw: b,
      }
    })
  }, [snapshot, activeBuckets])

  const insights = useMemo(() => {
    if (!ageRows.length) return null
    const totalArt = ageRows.reduce((s, r) => s + r.total, 0)
    const dominant = [...ageRows].sort((a, b) => b.total - a.total)[0]
    const adultPlus = ageRows.filter((r) => r.key !== 'balita' && r.total > 0)
    const highestSmoking = [...adultPlus].sort((a, b) => b.merokokPct - a.merokokPct)[0]
    const lowestSayur = [...adultPlus].sort((a, b) => a.sayurPct - b.sayurPct)[0]
    const lowestAktivitas = [...adultPlus].sort((a, b) => a.aktivitasPct - b.aktivitasPct)[0]
    const balita = ageRows.find((r) => r.key === 'balita')
    const remaja = ageRows.find((r) => r.key === 'remaja')
    const lansia = ageRows.find((r) => r.key === 'lansia')

    return {
      totalArt,
      dominant,
      highestSmoking,
      lowestSayur,
      lowestAktivitas,
      balita,
      remaja,
      lansia,
    }
  }, [ageRows])

  if (loading) {
    return (
      <div className="bg-white rounded-2xl p-12 border border-gray-100 shadow-sm text-center">
        <div className="w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-sm font-medium text-gray-600">
          Memuat data agregasi kategori usia (613.307 responden ART)...
        </p>
      </div>
    )
  }

  if (error || !activeBuckets || !insights) {
    return (
      <div className="bg-rose-50 border border-rose-200 rounded-2xl p-6 text-rose-700 text-sm">
        {error || 'Data kategori usia belum tersedia.'}
      </div>
    )
  }

  const behaviorChartData = ageRows.filter((r) => r.key !== 'balita')
  const balitaRaw = insights.balita?.raw
  const remajaRaw = insights.remaja?.raw
  const dewasaRaw = ageRows.find((r) => r.key === 'dewasa')?.raw

  return (
    <div className="space-y-6">
      {/* Header Scope Banner */}
      <div className="bg-gradient-to-r from-emerald-900 to-teal-800 text-white rounded-2xl p-6 shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <span className="inline-block px-2.5 py-1 rounded-full bg-white/15 text-emerald-100 text-[11px] font-bold uppercase tracking-wider mb-2">
            Analisis Siklus Hidup (Individual ART)
          </span>
          <h3 className="text-xl font-bold">{regionLabel}</h3>
          <p className="text-emerald-100/90 text-xs mt-1">
            Klasifikasi 6 kelompok umur dari <code>tgl_lahir</code> anggota keluarga terhadap kepatuhan PHBS & GERMAS
          </p>
        </div>
        <div className="bg-white/10 backdrop-blur rounded-xl px-4 py-3 text-right shrink-0">
          <div className="text-[11px] text-emerald-200 font-semibold uppercase">Total ART Terklasifikasi</div>
          <div className="text-2xl font-black">{insights.totalArt.toLocaleString('id-ID')}</div>
        </div>
      </div>

      {/* 4 KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between text-gray-500 text-xs font-semibold mb-2">
            <span>KELOMPOK USIA DOMINAN</span>
            <Users className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-lg font-bold text-gray-900">{insights.dominant?.label}</div>
          <div className="text-xs text-emerald-600 font-semibold mt-1">
            {insights.dominant?.total.toLocaleString('id-ID')} ART ({insights.dominant?.sharePct}%)
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between text-gray-500 text-xs font-semibold mb-2">
            <span>PREVALENSI MEROKOK TERTINGGI</span>
            <CigaretteOff className="w-4 h-4 text-rose-500" />
          </div>
          <div className="text-lg font-bold text-gray-900">{insights.highestSmoking?.label || '-'}</div>
          <div className="text-xs text-rose-600 font-semibold mt-1">
            {insights.highestSmoking?.merokokPct}% merokok (Laki-laki: {insights.highestSmoking?.merokokMalePct}%)
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between text-gray-500 text-xs font-semibold mb-2">
            <span>POSYANDU LANSIA (60+ TH)</span>
            <HeartPulse className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="text-2xl font-bold text-gray-900">{insights.lansia?.posyanduPct ?? 0}%</div>
          <div className="text-xs text-gray-500 mt-1">
            Cek Kesehatan Gratis (CKG): <span className="font-semibold text-indigo-600">{insights.lansia?.ckgPct ?? 0}%</span>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between text-gray-500 text-xs font-semibold mb-2">
            <span>POSYANDU BALITA (0–4 TH)</span>
            <Baby className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-bold text-gray-900">{insights.balita?.posyanduPct ?? 0}%</div>
          <div className="text-xs text-gray-500 mt-1">
            Menimbang Balita: <span className="font-semibold text-amber-600">{balitaRaw ? pct(balitaRaw.i3_num, balitaRaw.i3_den) : 0}%</span>
          </div>
        </div>
      </div>

      {/* Dynamic Epidemiological Insights */}
      <div className="bg-amber-50/70 border border-amber-200 rounded-2xl p-5">
        <div className="flex items-center gap-2 text-amber-900 font-bold text-sm mb-3">
          <Sparkles className="w-4 h-4 text-amber-600" />
          Insight Epidemiologi & Rekomendasi Intervensi ({regionLabel})
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-amber-950 leading-relaxed">
          <div className="bg-white/80 rounded-xl p-3.5 border border-amber-100">
            <div className="font-bold text-rose-700 flex items-center gap-1.5 mb-1">
              <AlertTriangle className="w-3.5 h-3.5" /> Fokus Perilaku Merokok
            </div>
            Kelompok <strong>{insights.highestSmoking?.label}</strong> memiliki angka merokok tertinggi sebesar{' '}
            <strong>{insights.highestSmoking?.merokokPct}%</strong> (pada laki-laki mencapai{' '}
            <strong>{insights.highestSmoking?.merokokMalePct}%</strong>). Diperlukan intervensi KTR rumah tangga dan konseling UBM (Upaya Berhenti Merokok) pada usia produktif.
            {insights.remaja && insights.remaja.merokokPct > 0 && (
              <> Perhatian khusus: pada <strong>Remaja (12–17 th)</strong> tercatat <strong>{insights.remaja.merokokPct}%</strong> sudah merokok.</>
            )}
          </div>

          <div className="bg-white/80 rounded-xl p-3.5 border border-amber-100">
            <div className="font-bold text-amber-700 flex items-center gap-1.5 mb-1">
              <Activity className="w-3.5 h-3.5" /> Kesenjangan Gizi & Aktivitas Fisik
            </div>
            Kepatuhan konsumsi sayur & buah terendah ada pada kelompok <strong>{insights.lowestSayur?.label}</strong> ({insights.lowestSayur?.sayurPct}%), sedangkan kepatuhan aktivitas fisik terendah pada{' '}
            <strong>{insights.lowestAktivitas?.label}</strong> ({insights.lowestAktivitas?.aktivitasPct}%). Program edukasi GERMAS di sekolah/tempat kerja perlu menyasar kelompok ini.
          </div>

          <div className="bg-white/80 rounded-xl p-3.5 border border-amber-100">
            <div className="font-bold text-emerald-700 flex items-center gap-1.5 mb-1">
              <CheckCircle2 className="w-3.5 h-3.5" /> Transformasi Layanan Primer (ILP)
            </div>
            Kunjungan Posyandu pada Balita mencapai <strong>{insights.balita?.posyanduPct ?? 0}%</strong>, sedangkan pada{' '}
            <strong>Lansia (60+ th)</strong> sebesar <strong>{insights.lansia?.posyanduPct ?? 0}%</strong> dan CKG sebesar{' '}
            <strong>{insights.lansia?.ckgPct ?? 0}%</strong>.{' '}
            {(insights.lansia?.posyanduPct ?? 0) < 50
              ? 'Posyandu masih terfokus pada ibu/balita; perlu penguatan Posyandu ILP untuk skrining PTM Lansia.'
              : 'Partisipasi Lansia di Posyandu sudah cukup aktif dan perlu dipertahankan.'}
          </div>
        </div>
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Distribusi Usia & Gender */}
        <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
          <h4 className="text-sm font-bold text-gray-800 mb-1">Distribusi Responden per Kelompok Usia & Gender</h4>
          <p className="text-xs text-gray-500 mb-4">Jumlah anggota rumah tangga (ART) tersurvei berdasarkan jenis kelamin</p>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={ageRows} margin={{ top: 10, right: 16, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="shortLabel" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="male" name="Laki-laki" fill="#0284c7" radius={[4, 4, 0, 0]} />
                <Bar dataKey="female" name="Perempuan" fill="#ec4899" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Perilaku PHBS Lintas Usia */}
        <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
          <h4 className="text-sm font-bold text-gray-800 mb-1">Kepatuhan 4 Perilaku PHBS Lintas Usia (%)</h4>
          <p className="text-xs text-gray-500 mb-4">Perbandingan CTPS, Sayur & Buah, Aktivitas Fisik, dan Tidak Merokok (usia 5–60+ th)</p>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={behaviorChartData} margin={{ top: 10, right: 16, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="shortLabel" tick={{ fontSize: 11 }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: any) => `${v}%`} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="ctpsPct" name="Cuci Tangan" fill="#10b981" radius={[3, 3, 0, 0]} />
                <Bar dataKey="sayurPct" name="Sayur & Buah" fill="#f59e0b" radius={[3, 3, 0, 0]} />
                <Bar dataKey="aktivitasPct" name="Aktivitas Fisik" fill="#6366f1" radius={[3, 3, 0, 0]} />
                <Bar dataKey="tidakMerokokPct" name="Tidak Merokok" fill="#ef4444" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Charts Row 2: GERMAS + Fokus Siklus Hidup */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
          <h4 className="text-sm font-bold text-gray-800 mb-1">Partisipasi GERMAS (CKG & Posyandu) per Kelompok Usia (%)</h4>
          <p className="text-xs text-gray-500 mb-4">Mengukur jangkauan Cek Kesehatan Gratis & Posyandu dari Balita hingga Lansia</p>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={ageRows} margin={{ top: 10, right: 16, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="shortLabel" tick={{ fontSize: 11 }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: any) => `${v}%`} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="ckgPct" name="Cek Kesehatan Gratis (CKG)" fill="#0d9488" radius={[4, 4, 0, 0]} />
                <Bar dataKey="posyanduPct" name="Kunjungan Posyandu" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Fokus Siklus Hidup: Balita & Rentan */}
        <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm space-y-4">
          <h4 className="text-sm font-bold text-gray-800">Fokus Indikator Spesifik Usia</h4>

          <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-100 space-y-2">
            <div className="text-xs font-bold text-emerald-800">Kelompok Balita (0–4 Tahun)</div>
            <div className="flex justify-between text-xs">
              <span className="text-gray-600">Persalinan Nakes</span>
              <span className="font-bold text-emerald-700">{balitaRaw ? pct(balitaRaw.i1_num, balitaRaw.i1_den) : 0}%</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-gray-600">ASI Eksklusif</span>
              <span className="font-bold text-emerald-700">{balitaRaw ? pct(balitaRaw.i2_num, balitaRaw.i2_den) : 0}%</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-gray-600">Menimbang Balita</span>
              <span className="font-bold text-emerald-700">{balitaRaw ? pct(balitaRaw.i3_num, balitaRaw.i3_den) : 0}%</span>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-indigo-50 border border-indigo-100 space-y-2">
            <div className="text-xs font-bold text-indigo-800">Kelompok Rentan (TTD)</div>
            <div className="flex justify-between text-xs">
              <span className="text-gray-600">TTD Remaja Putri (12–17 th)</span>
              <span className="font-bold text-indigo-700">
                {remajaRaw ? pct(remajaRaw.rematri_ttd_num, remajaRaw.rematri_ttd_den) : 0}%
              </span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-gray-600">TTD Ibu Hamil (Dewasa Muda)</span>
              <span className="font-bold text-indigo-700">
                {dewasaRaw ? pct(dewasaRaw.bumil_ttd_num, dewasaRaw.bumil_num) : 0}%
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Detailed Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-gray-100">
          <h4 className="text-sm font-bold text-gray-800">Tabel Rekapitulasi PHBS & GERMAS per Kategori Usia</h4>
          <p className="text-xs text-gray-500 mt-0.5">Menampilkan persentase pemenuhan indikator pada masing-masing kelompok umur</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-gray-50 text-gray-600 font-bold uppercase">
              <tr>
                <th className="px-4 py-3">Kelompok Usia</th>
                <th className="px-4 py-3 text-right">Total ART</th>
                <th className="px-4 py-3 text-right">Proporsi</th>
                <th className="px-4 py-3 text-right">RT Sehat</th>
                <th className="px-4 py-3 text-right">CTPS</th>
                <th className="px-4 py-3 text-right">Sayur & Buah</th>
                <th className="px-4 py-3 text-right">Aktivitas Fisik</th>
                <th className="px-4 py-3 text-right">Tidak Merokok</th>
                <th className="px-4 py-3 text-right">CKG</th>
                <th className="px-4 py-3 text-right">Posyandu</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {ageRows.map((row) => (
                <tr key={row.key} className="hover:bg-emerald-50/40 transition-colors">
                  <td className="px-4 py-3 font-bold text-gray-800">{row.label}</td>
                  <td className="px-4 py-3 text-right font-semibold">{row.total.toLocaleString('id-ID')}</td>
                  <td className="px-4 py-3 text-right text-gray-500">{row.sharePct}%</td>
                  <td className="px-4 py-3 text-right font-semibold text-emerald-700">{row.rtSehatPct}%</td>
                  <td className="px-4 py-3 text-right">{row.key === 'balita' ? '-' : `${row.ctpsPct}%`}</td>
                  <td className="px-4 py-3 text-right">{row.key === 'balita' ? '-' : `${row.sayurPct}%`}</td>
                  <td className="px-4 py-3 text-right">{row.key === 'balita' ? '-' : `${row.aktivitasPct}%`}</td>
                  <td className="px-4 py-3 text-right">
                    {row.key === 'balita' ? (
                      '-'
                    ) : (
                      <span className={`px-2 py-0.5 rounded-full font-semibold ${row.tidakMerokokPct < 70 ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'}`}>
                        {row.tidakMerokokPct}%
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">{row.ckgPct}%</td>
                  <td className="px-4 py-3 text-right font-semibold text-indigo-700">{row.posyanduPct}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
