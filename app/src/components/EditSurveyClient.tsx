'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { offlineDB, nowISO } from '@/lib/db/offline'
import { enqueueSync } from '@/lib/db/sync'
import SyncStatusBar from '@/components/SyncStatusBar'

// ===== TYPES =====
interface Household {
  id: string; no_kk: string; nama_kk: string
  ref_desa: { desa_kel: string } | null
}
interface AppUser {
  id: string; email: string; role: string; puskesmas_id: string
  ref_puskesmas: { id: string; nama: string; kecamatan: string } | null
}
interface Survey {
  id: string
  household_id: string
  catatan: string | null
  [key: string]: any
}
interface Props {
  appUser: AppUser
  survey: Survey
  household: Household
  basePath?: string
}

// ===== 17 INDIKATOR GROUPS =====
const INDIKATOR_GROUPS = [
  {
    group: 'Kesehatan Ibu & Anak', icon: '👶',
    items: [
      { key: 'i1_persalinan_nakes', label: 'Persalinan oleh Tenaga Kesehatan', desc: 'Apakah persalinan terakhir ditolong oleh tenaga kesehatan?', skipIf: 'noBalita', skipLabel: 'Tidak ada ibu yang melahirkan dalam 5 tahun terakhir' },
      { key: 'i2_asi_eksklusif', label: 'ASI Eksklusif', desc: 'Apakah bayi (0-6 bulan) mendapat ASI eksklusif?', skipIf: 'noBayi', skipLabel: 'Tidak ada bayi 0-6 bulan' },
      { key: 'i3_menimbang_balita', label: 'Menimbang Balita', desc: 'Apakah balita ditimbang minimal 8x dalam setahun di Posyandu?', skipIf: 'noBalita', skipLabel: 'Tidak ada balita (0-59 bulan)' },
    ],
  },
  {
    group: 'Kesehatan Lingkungan', icon: '🌿',
    items: [
      { key: 'i4_air_bersih', label: 'Menggunakan Air Bersih', desc: 'Apakah keluarga menggunakan sumber air bersih?', skipIf: null, skipLabel: null },
      { key: 'i5_cuci_tangan', label: 'Cuci Tangan dengan Sabun', desc: 'Apakah anggota keluarga mencuci tangan dengan sabun di air mengalir?', skipIf: null, skipLabel: null },
      { key: 'i6_jamban_sehat', label: 'Menggunakan Jamban Sehat', desc: 'Apakah keluarga menggunakan jamban sehat?', skipIf: null, skipLabel: null },
      { key: 'i7_psn', label: 'Pemberantasan Sarang Nyamuk (PSN)', desc: 'Apakah dilakukan PSN minimal seminggu sekali (3M Plus)?', skipIf: null, skipLabel: null },
    ],
  },
  {
    group: 'Gizi & Aktivitas Fisik', icon: '🥗',
    items: [
      { key: 'i8_makan_sayur_buah', label: 'Makan Sayur dan Buah', desc: 'Apakah anggota keluarga makan sayur dan/atau buah setiap hari?', skipIf: null, skipLabel: null },
      { key: 'i9_aktivitas_fisik', label: 'Aktivitas Fisik', desc: 'Apakah anggota keluarga melakukan aktivitas fisik minimal 30 menit per hari?', skipIf: null, skipLabel: null },
    ],
  },
  {
    group: 'Perilaku Sehat', icon: '🚭',
    items: [
      { key: 'i10_tidak_merokok', label: 'Tidak Merokok di Dalam Rumah', desc: 'Apakah tidak ada anggota keluarga yang merokok di dalam rumah?', skipIf: null, skipLabel: null },
      { key: 'i11_cek_kesehatan', label: 'Cek Kesehatan Berkala', desc: 'Apakah anggota keluarga melakukan pemeriksaan kesehatan minimal 1x dalam 6 bulan?', skipIf: null, skipLabel: null },
      { key: 'i12_kunjungan_posyandu', label: 'Kunjungan Posyandu', desc: 'Apakah ada anggota keluarga yang aktif berkunjung ke Posyandu?', skipIf: null, skipLabel: null },
    ],
  },
  {
    group: 'Kesehatan Ibu Hamil', icon: '🤰',
    items: [
      { key: 'i14_ibu_hamil', label: 'Ada Ibu Hamil', desc: 'Apakah ada anggota keluarga yang sedang hamil?', skipIf: null, skipLabel: null },
      { key: 'i15_ibu_hamil_ttd', label: 'Ibu Hamil Konsumsi TTD', desc: 'Apakah ibu hamil rutin mengonsumsi Tablet Tambah Darah (TTD)?', skipIf: 'noIbuHamil', skipLabel: 'Tidak ada ibu hamil' },
    ],
  },
  {
    group: 'Remaja Putri', icon: '👧',
    items: [
      { key: 'i16_remaja_putri', label: 'Ada Remaja Putri (12-18 th)', desc: 'Apakah ada remaja putri usia 12-18 tahun dalam keluarga?', skipIf: null, skipLabel: null },
      { key: 'i17_remaja_putri_ttd', label: 'Remaja Putri Konsumsi TTD', desc: 'Apakah remaja putri rutin mengonsumsi Tablet Tambah Darah (TTD)?', skipIf: 'noRemajaP', skipLabel: 'Tidak ada remaja putri' },
    ],
  },
]

type IndikatorValues = Record<string, boolean | null>
type SkipFlags = { noBalita: boolean; noBayi: boolean; noIbuHamil: boolean; noRemajaP: boolean }

export default function EditSurveyClient({ appUser, survey, household, basePath = '/dashboard' }: Props) {
  const router = useRouter()
  const supabase = createClient()

  const [groupIdx, setGroupIdx] = useState(0)
  const [values, setValues] = useState<IndikatorValues>({})
  const [skipFlags, setSkipFlags] = useState<SkipFlags>({ noBalita: false, noBayi: false, noIbuHamil: false, noRemajaP: false })
  const [catatan, setCatatan] = useState(survey.catatan || '')
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  // Initialize values
  useEffect(() => {
    const initVals: IndikatorValues = {}
    let skips: SkipFlags = { noBalita: false, noBayi: false, noIbuHamil: false, noRemajaP: false }
    
    // Auto detect skips from nulls if the dependent trigger was false
    skips.noIbuHamil = survey.i14_ibu_hamil === false
    skips.noRemajaP = survey.i16_remaja_putri === false
    // For noBalita and noBayi, we just guess based on whether the dependent values are null
    skips.noBalita = survey.i1_persalinan_nakes === null && survey.i3_menimbang_balita === null
    skips.noBayi = survey.i2_asi_eksklusif === null

    INDIKATOR_GROUPS.forEach(g => {
      g.items.forEach(item => {
        initVals[item.key] = survey[item.key] ?? null
      })
    })

    setValues(initVals)
    setSkipFlags(skips)
  }, [survey])

  const currentGroup = INDIKATOR_GROUPS[groupIdx]
  const totalGroups = INDIKATOR_GROUPS.length
  const progress = Math.round(((groupIdx) / totalGroups) * 100)

  function setAnswer(key: string, val: boolean | null) {
    setValues(prev => ({ ...prev, [key]: val }))
    if (key === 'i14_ibu_hamil') setSkipFlags(p => ({ ...p, noIbuHamil: val === false }))
    if (key === 'i16_remaja_putri') setSkipFlags(p => ({ ...p, noRemajaP: val === false }))
  }

  function isSkipped(item: typeof INDIKATOR_GROUPS[0]['items'][0]): boolean {
    if (!item.skipIf) return false
    return skipFlags[item.skipIf as keyof SkipFlags]
  }

  function allAnswered(): boolean {
    return currentGroup.items.every(item => {
      if (isSkipped(item)) return true
      return values[item.key] !== undefined && values[item.key] !== null
    })
  }

  async function handleSubmit() {
    setSubmitting(true)
    setError('')

    const now = nowISO()

    let total = 0; let max = 0;
    
    const boolKeys = ['i4_air_bersih','i5_cuci_tangan','i6_jamban_sehat','i7_psn',
      'i8_makan_sayur_buah','i9_aktivitas_fisik','i10_tidak_merokok','i11_cek_kesehatan',
      'i12_kunjungan_posyandu','i14_ibu_hamil','i16_remaja_putri']
    const nullableKeys = ['i1_persalinan_nakes','i2_asi_eksklusif','i3_menimbang_balita',
      'i15_ibu_hamil_ttd','i17_remaja_putri_ttd']

    boolKeys.forEach(k => { max++; if (values[k]) total++ })
    nullableKeys.forEach(k => { 
      const item = INDIKATOR_GROUPS.flatMap(g => g.items).find(i => i.key === k)
      if (item && !isSkipped(item)) { max++; if (values[k]) total++ } 
    })
    const skor = max > 0 ? Math.round((total/max)*100) : 0

    const record = {
      i1_persalinan_nakes: skipFlags.noBalita ? null : (values['i1_persalinan_nakes'] ?? null),
      i2_asi_eksklusif: skipFlags.noBayi ? null : (values['i2_asi_eksklusif'] ?? null),
      i3_menimbang_balita: skipFlags.noBalita ? null : (values['i3_menimbang_balita'] ?? null),
      i4_air_bersih: values['i4_air_bersih'] ?? false,
      i5_cuci_tangan: values['i5_cuci_tangan'] ?? false,
      i6_jamban_sehat: values['i6_jamban_sehat'] ?? false,
      i7_psn: values['i7_psn'] ?? false,
      i8_makan_sayur_buah: values['i8_makan_sayur_buah'] ?? false,
      i9_aktivitas_fisik: values['i9_aktivitas_fisik'] ?? false,
      i10_tidak_merokok: values['i10_tidak_merokok'] ?? false,
      i11_cek_kesehatan: values['i11_cek_kesehatan'] ?? false,
      i12_kunjungan_posyandu: values['i12_kunjungan_posyandu'] ?? false,
      i14_ibu_hamil: values['i14_ibu_hamil'] ?? false,
      i15_ibu_hamil_ttd: skipFlags.noIbuHamil ? null : (values['i15_ibu_hamil_ttd'] ?? null),
      i16_remaja_putri: values['i16_remaja_putri'] ?? false,
      i17_remaja_putri_ttd: skipFlags.noRemajaP ? null : (values['i17_remaja_putri_ttd'] ?? null),
      skor,
      catatan: catatan || null,
      updated_at: now,
    }

    try {
      if (navigator.onLine) {
        const { error: sbErr } = await supabase.from('surveys').update(record).eq('id', survey.id)
        if (!sbErr) {
          try { await offlineDB.surveys.update(survey.id, record) } catch (e) {}
        } else {
          throw sbErr
        }
      } else {
        const exists = await offlineDB.surveys.get(survey.id)
        if (exists) {
          await offlineDB.surveys.update(survey.id, { ...record, sync_status: 'pending' })
          await enqueueSync('surveys', survey.id, 'update', record)
        } else {
          setError('Anda sedang offline dan data survei ini tidak ada di lokal.')
          setSubmitting(false)
          return
        }
      }
      setDone(true)
    } catch (e: any) {
      setError(e.message || 'Gagal menyimpan perubahan')
    } finally {
      setSubmitting(false)
    }
  }

  if (done) {
    const boolKeys = ['i4_air_bersih','i5_cuci_tangan','i6_jamban_sehat','i7_psn',
      'i8_makan_sayur_buah','i9_aktivitas_fisik','i10_tidak_merokok','i11_cek_kesehatan',
      'i12_kunjungan_posyandu','i14_ibu_hamil','i16_remaja_putri']
    const nullableKeys = ['i1_persalinan_nakes','i2_asi_eksklusif','i3_menimbang_balita',
      'i15_ibu_hamil_ttd','i17_remaja_putri_ttd']
    let total = 0; let max = 0
    boolKeys.forEach(k => { max++; if (values[k]) total++ })
    nullableKeys.forEach(k => { 
      const item = INDIKATOR_GROUPS.flatMap(g => g.items).find(i => i.key === k)
      if (item && !isSkipped(item)) { max++; if (values[k]) total++ } 
    })
    const pct = max > 0 ? Math.round((total/max)*100) : 0
    const kategori = pct >= 75 ? 'Sehat Paripurna' : pct >= 50 ? 'Sehat Utama' : pct >= 25 ? 'Sehat Madya' : 'Sehat Pratama'

    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-3xl border border-gray-100 p-8 shadow-xl text-center max-w-lg w-full">
          <div className="text-6xl mb-4">✅</div>
          <h2 className="text-2xl font-black text-gray-800 mb-1">Perubahan Disimpan!</h2>
          <p className="text-gray-500 text-sm mb-6 font-medium">Survei untuk Keluarga {household.nama_kk} berhasil diperbarui.</p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div className="bg-gray-50 rounded-2xl p-5 text-center">
              <p className="text-4xl font-black text-gray-800">{total}<span className="text-lg text-gray-400">/{max}</span></p>
              <p className="text-xs text-gray-400 uppercase tracking-wide font-bold mt-1">Skor Indikator</p>
            </div>
            <div className={`rounded-2xl p-5 text-center border flex flex-col justify-center ${
              pct >= 75 ? 'bg-emerald-50 border-emerald-100 text-emerald-700' : 
              pct >= 50 ? 'bg-blue-50 border-blue-100 text-blue-700' :
              'bg-red-50 border-red-100 text-red-700'
            }`}>
              <p className="text-lg font-black leading-tight">{kategori}</p>
            </div>
          </div>
          <div className="mt-8">
            <button onClick={() => router.push(`${basePath}/households/${household.id}`)}
              className="w-full bg-emerald-600 text-white py-3 rounded-2xl text-sm font-bold hover:bg-emerald-500 transition-all shadow-lg shadow-emerald-200">
              Kembali ke Detail KK
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href={`${basePath}/households/${household.id}`} className="text-gray-400 hover:text-gray-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/>
            </svg>
          </Link>
          <div>
            <h1 className="text-lg font-bold text-gray-800">Edit Survei PHBS</h1>
            <p className="text-xs text-gray-500">Keluarga {household.nama_kk}</p>
          </div>
        </div>
        <SyncStatusBar />
      </div>

      <div className="bg-white border-b border-gray-100">
        <div className="h-1 bg-gray-100">
          <div className="h-1 bg-emerald-500 transition-all duration-500" style={{ width: `${progress}%` }} />
        </div>
        <div className="px-6 py-2 flex items-center justify-between text-xs text-gray-400">
          <span>Kelompok {groupIdx + 1} dari {totalGroups}</span>
          <span>{progress}% selesai</span>
        </div>
      </div>

      <div className="p-6 max-w-2xl mx-auto">
        {groupIdx === 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-5">
            <p className="text-blue-800 text-sm font-medium mb-3">📋 Komposisi Keluarga (Filter)</p>
            <div className="space-y-2">
              {[
                { flag: 'noBalita', label: 'Tidak ada bayi/balita (0-59 bulan) & ibu melahirkan' },
                { flag: 'noBayi', label: 'Tidak ada bayi 0-6 bulan' },
              ].map(({ flag, label }) => (
                <label key={flag} className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={skipFlags[flag as keyof SkipFlags]}
                    onChange={e => setSkipFlags(p => ({ ...p, [flag]: e.target.checked }))}
                    className="w-4 h-4 rounded text-emerald-600" />
                  <span className="text-sm text-blue-700">{label}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm mb-5">
          <h2 className="text-base font-bold text-gray-800 mb-5 flex items-center gap-2">
            <span className="text-2xl">{currentGroup.icon}</span>
            {currentGroup.group}
          </h2>

          <div className="space-y-5">
            {currentGroup.items.map(item => {
              const skipped = isSkipped(item)
              const val = values[item.key]

              return (
                <div key={item.key} className={`rounded-xl p-4 border transition-all ${
                  skipped ? 'bg-gray-50 border-gray-100 opacity-50' :
                  val === true ? 'bg-emerald-50 border-emerald-200' :
                  val === false ? 'bg-red-50 border-red-200' :
                  'bg-white border-gray-100'
                }`}>
                  <p className="text-sm font-semibold text-gray-800 mb-1">{item.label}</p>
                  <p className="text-xs text-gray-500 mb-3">{item.desc}</p>
                  {skipped ? (
                    <p className="text-xs text-gray-400 italic">⤷ {item.skipLabel}</p>
                  ) : (
                    <div className="flex gap-2">
                      {[
                        { v: true, label: '✅ Ya' },
                        { v: false, label: '❌ Tidak' },
                      ].map(({ v, label }) => (
                        <button key={String(v)} type="button" onClick={() => setAnswer(item.key, v)}
                          className={`flex-1 py-2.5 rounded-lg text-sm font-medium border transition-all ${
                            val === v
                              ? v ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-red-500 text-white border-red-500'
                              : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                          }`}>
                          {label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {groupIdx === totalGroups - 1 && (
          <div className="bg-white rounded-xl border border-gray-100 p-4 mb-5">
            <label className="block text-sm font-medium text-gray-700 mb-2">Catatan Surveyor</label>
            <textarea rows={3} value={catatan} onChange={e => setCatatan(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 resize-none" />
          </div>
        )}

        {error && <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-4 text-red-700 text-sm">⚠️ {error}</div>}

        <div className="flex gap-3">
          {groupIdx > 0 && (
            <button onClick={() => setGroupIdx(i => i - 1)} className="px-5 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50 transition-colors">
              ← Sebelumnya
            </button>
          )}

          {groupIdx < totalGroups - 1 ? (
            <button onClick={() => setGroupIdx(i => i + 1)} disabled={!allAnswered()}
              className="flex-1 bg-emerald-600 hover:bg-emerald-500 disabled:bg-gray-200 disabled:text-gray-400 text-white font-medium py-2.5 rounded-xl text-sm transition-colors">
              Lanjut →
            </button>
          ) : (
            <button onClick={handleSubmit} disabled={submitting || !allAnswered()}
              className="flex-1 bg-emerald-600 hover:bg-emerald-500 disabled:bg-gray-200 disabled:text-gray-400 text-white font-medium py-2.5 rounded-xl text-sm transition-colors flex items-center justify-center gap-2">
              {submitting ? 'Menyimpan...' : '💾 Simpan Perubahan'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
