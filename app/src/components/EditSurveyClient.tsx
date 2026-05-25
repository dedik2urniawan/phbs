'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { offlineDB, nowISO, LocalFamilyMember, generateLocalId } from '@/lib/db/offline'
import { enqueueSync } from '@/lib/db/sync'
import SyncStatusBar from '@/components/SyncStatusBar'
import {
  hitungSkorPHBS,
  getARTQuestions,
  hitungUsia,
  ArtResponse,
  SurveyIndikator,
} from '@/lib/phbs/scoring'

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
  [key: string]: unknown
}
interface Props {
  appUser: AppUser
  survey: Survey
  household: Household
  basePath?: string
}

// ===== HELPER =====
const renderBinaryQuestion = (
  label: string,
  desc: string,
  val: boolean | undefined,
  onChange: (v: boolean) => void
) => (
  <div className={`rounded-xl p-4 border transition-all mb-4 ${
    val === true ? 'bg-emerald-50 border-emerald-200'
    : val === false ? 'bg-red-50 border-red-200'
    : 'bg-white border-gray-100'
  }`}>
    <p className="text-sm font-semibold text-gray-800 mb-1">{label}</p>
    {desc && <p className="text-xs text-gray-500 mb-3">{desc}</p>}
    <div className="flex gap-2">
      <button type="button" onClick={() => onChange(true)}
        className={`flex-1 py-2.5 rounded-lg text-sm font-medium border transition-all ${
          val === true ? 'bg-emerald-600 text-white border-emerald-600' : 'border-gray-200 text-gray-600 hover:bg-gray-50'
        }`}>✅ Ya</button>
      <button type="button" onClick={() => onChange(false)}
        className={`flex-1 py-2.5 rounded-lg text-sm font-medium border transition-all ${
          val === false ? 'bg-red-500 text-white border-red-500' : 'border-gray-200 text-gray-600 hover:bg-gray-50'
        }`}>❌ Tidak</button>
    </div>
  </div>
)

export default function EditSurveyClient({ appUser, survey, household, basePath = '/dashboard' }: Props) {
  const router = useRouter()
  const supabase = createClient()

  const [members, setMembers] = useState<LocalFamilyMember[]>([])
  const [step, setStep] = useState(0)
  const [surveyKK, setSurveyKK] = useState<Partial<SurveyIndikator>>({})
  const [artResponses, setArtResponses] = useState<Record<string, Partial<ArtResponse>>>({})
  const [catatan, setCatatan] = useState(survey.catatan || '')
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')
  const [scoreResult, setScoreResult] = useState<ReturnType<typeof hitungSkorPHBS> | null>(null)

  // Load ART members + prefill existing survey values
  useEffect(() => {
    async function load() {
      let m = await offlineDB.family_members.where('household_id').equals(household.id).toArray()
      if (m.length === 0 && navigator.onLine) {
        const { data } = await supabase.from('family_members').select('*').eq('household_id', household.id)
        if (data) {
          m = data as LocalFamilyMember[]
          await offlineDB.family_members.bulkPut(m)
        }
      }
      setMembers(m)

      // Pre-fill KK indicators from existing survey
      setSurveyKK({
        i4_air_bersih: (survey.i4_air_bersih as boolean) ?? false,
        i6_jamban_sehat: (survey.i6_jamban_sehat as boolean) ?? false,
        i7_psn: (survey.i7_psn as boolean) ?? false,
      })

      // Try to load existing ART responses
      let existingArt: Record<string, Partial<ArtResponse>> = {}
      try {
        let artRows = await offlineDB.survey_art_responses.where('survey_id').equals(survey.id).toArray()
        
        if (artRows.length === 0 && navigator.onLine) {
          const { data } = await supabase.from('survey_art_responses').select('*').eq('survey_id', survey.id)
          if (data && data.length > 0) {
            artRows = data as any[]
            await offlineDB.survey_art_responses.bulkPut(artRows.map(r => ({ ...r, sync_status: 'synced' })))
          }
        }
        
        if (artRows.length > 0) {
          artRows.forEach(r => {
            existingArt[r.family_member_id] = {
              id: r.id, // KEEP ID
              family_member_id: r.family_member_id,
              i1_persalinan_nakes: r.i1_persalinan_nakes ?? undefined,
              i2_asi_eksklusif: r.i2_asi_eksklusif ?? undefined,
              i3_menimbang_balita: r.i3_menimbang_balita ?? undefined,
              i5_cuci_tangan: r.i5_cuci_tangan ?? undefined,
              i8_makan_sayur_buah: r.i8_makan_sayur_buah ?? undefined,
              i9_aktivitas_fisik: r.i9_aktivitas_fisik ?? undefined,
              i10_tidak_merokok: r.i10_tidak_merokok ?? undefined,
              g_cek_kesehatan: r.g_cek_kesehatan ?? undefined,
              g_posyandu_hadir: r.g_posyandu_hadir ?? undefined,
              g_ibu_hamil: r.g_ibu_hamil ?? undefined,
              g_ibu_hamil_ttd: r.g_ibu_hamil_ttd ?? undefined,
              g_remaja_putri_ttd: r.g_remaja_putri_ttd ?? undefined,
            }
          })
        }
      } catch (_) {}

      // Init blank for members without existing responses
      const initArt: Record<string, Partial<ArtResponse>> = {}
      m.forEach(mem => {
        initArt[mem.id] = existingArt[mem.id] ?? { family_member_id: mem.id }
      })
      setArtResponses(initArt)
    }
    load()
  }, [household.id, survey.id])

  // Usia dkk dihandle di dalam loop ART

  const totalSteps = members.length > 0 ? members.length + 2 : 2
  const progress = Math.round((step / (totalSteps - 1)) * 100)

  const has_bayi_1_tahun = members.some(m => hitungUsia(m.tgl_lahir) <= 1)

  const isStepValid = () => {
    if (step === 0) {
      const reqKeys: (keyof SurveyIndikator)[] = ['i4_air_bersih', 'i6_jamban_sehat', 'i7_psn']
      return reqKeys.every(k => surveyKK[k] !== undefined && surveyKK[k] !== null)
    }
    if (step > 0 && step <= members.length) {
      const m = members[step - 1]
      const q = getARTQuestions(m.tgl_lahir, m.jenis_kelamin, m.hubungan_kk, has_bayi_1_tahun)
      const r = artResponses[m.id]
      if (!r) return false
      if (q.show_i1 && r.i1_persalinan_nakes === undefined) return false
      if (q.show_i2 && r.i2_asi_eksklusif === undefined) return false
      if (q.show_i3 && r.i3_menimbang_balita === undefined) return false
      if (q.show_i5 && r.i5_cuci_tangan === undefined) return false
      if (q.show_i8 && r.i8_makan_sayur_buah === undefined) return false
      if (q.show_i9 && r.i9_aktivitas_fisik === undefined) return false
      if (q.show_i10 && r.i10_tidak_merokok === undefined) return false
      if (q.show_ckg && r.g_cek_kesehatan === undefined) return false
      if (q.show_posyandu && r.g_posyandu_hadir === undefined) return false
      if (q.show_ibu_hamil && r.g_ibu_hamil === undefined) return false
      if (r.g_ibu_hamil && r.g_ibu_hamil_ttd === undefined) return false
      if (q.show_remaja_putri_ttd && r.g_remaja_putri_ttd === undefined) return false
      return true
    }
    return true
  }

  async function handleSubmit() {
    setSubmitting(true)
    setError('')

    const surveyData: SurveyIndikator = {
      i4_air_bersih: surveyKK.i4_air_bersih ?? false,
      i6_jamban_sehat: surveyKK.i6_jamban_sehat ?? false,
      i7_psn: surveyKK.i7_psn ?? false,
    }

    const artList = Object.values(artResponses) as ArtResponse[]
    const score = hitungSkorPHBS(surveyData, artList)
    setScoreResult(score)

    // Aggregate computed columns for backward compatibility
    const i5 = artList.filter(a => a.i5_cuci_tangan !== null).some(a => a.i5_cuci_tangan)
    const i8 = artList.filter(a => a.i8_makan_sayur_buah !== null).some(a => a.i8_makan_sayur_buah)
    const i9 = artList.filter(a => a.i9_aktivitas_fisik !== null).some(a => a.i9_aktivitas_fisik)
    const i10 = !artList.some(a => a.i10_tidak_merokok === false)
    const i11 = artList.some(a => a.g_cek_kesehatan === true)
    const i12 = artList.some(a => a.g_posyandu_hadir === true)
    const i14_ibu_hamil = artList.some(a => a.g_ibu_hamil === true)
    const i16_remaja_putri = members.some(m => m.jenis_kelamin === 'P' && hitungUsia(m.tgl_lahir) >= 12 && hitungUsia(m.tgl_lahir) <= 18)
    const i1 = artList.find(a => a.i1_persalinan_nakes !== null)?.i1_persalinan_nakes ?? null
    const i2 = artList.find(a => a.i2_asi_eksklusif !== null)?.i2_asi_eksklusif ?? null
    const i3 = artList.find(a => a.i3_menimbang_balita !== null)?.i3_menimbang_balita ?? null
    const i15 = artList.find(a => a.g_ibu_hamil_ttd !== null)?.g_ibu_hamil_ttd ?? null
    const i17 = artList.find(a => a.g_remaja_putri_ttd !== null)?.g_remaja_putri_ttd ?? null

    const now = nowISO()
    const record = {
      ...surveyData,
      i5_cuci_tangan: i5,
      i8_makan_sayur_buah: i8,
      i9_aktivitas_fisik: i9,
      i10_tidak_merokok: i10,
      i11_cek_kesehatan: i11,
      i12_kunjungan_posyandu: i12,
      i14_ibu_hamil: i14_ibu_hamil,
      i16_remaja_putri: i16_remaja_putri,
      i1_persalinan_nakes: i1,
      i2_asi_eksklusif: i2,
      i3_menimbang_balita: i3,
      i15_ibu_hamil_ttd: i15,
      i17_remaja_putri_ttd: i17,
      skor_phbs: score.skor,
      denominator_phbs: score.denominator,
      is_rt_sehat: score.is_rt_sehat,
      kategori_phbs: score.kategori,
      catatan: catatan || null,
      updated_at: now,
    }

    try {
      // 1. Prepare ART payload
      const artRecordsToSave = artList.map(art => {
        const artRecord = {
          id: art.id || generateLocalId(),
          survey_id: survey.id,
          family_member_id: art.family_member_id,
          i1_persalinan_nakes: art.i1_persalinan_nakes ?? null,
          i2_asi_eksklusif: art.i2_asi_eksklusif ?? null,
          i3_menimbang_balita: art.i3_menimbang_balita ?? null,
          i5_cuci_tangan: art.i5_cuci_tangan ?? null,
          i8_makan_sayur_buah: art.i8_makan_sayur_buah ?? null,
          i9_aktivitas_fisik: art.i9_aktivitas_fisik ?? null,
          i10_tidak_merokok: art.i10_tidak_merokok ?? null,
          g_cek_kesehatan: art.g_cek_kesehatan ?? null,
          g_posyandu_hadir: art.g_posyandu_hadir ?? null,
          g_ibu_hamil: art.g_ibu_hamil ?? null,
          g_ibu_hamil_ttd: art.g_ibu_hamil_ttd ?? null,
          g_remaja_putri_ttd: art.g_remaja_putri_ttd ?? null,
          created_at: now,
          updated_at: now,
        }
        return artRecord
      })

      // 2. Save offline directly
      const exists = await offlineDB.surveys.get(survey.id)
      if (exists) {
        try { await offlineDB.surveys.update(survey.id, record as any) } catch (_) {}
      }
      for (const artRecord of artRecordsToSave) {
        try { await offlineDB.survey_art_responses.put({ ...artRecord, sync_status: 'pending' }) } catch (_) {}
      }

      // 3. Try to sync server if online
      if (navigator.onLine) {
        const { error: sbErr } = await supabase.from('surveys').update(record).eq('id', survey.id)
        
        if (!sbErr) {
          if (exists) await offlineDB.surveys.update(survey.id, { sync_status: 'synced' } as any)
          
          for (const artRecord of artRecordsToSave) {
            const { error: artErr } = await supabase.from('survey_art_responses')
              .upsert({ ...artRecord }, { onConflict: 'survey_id,family_member_id' })
            if (!artErr) {
               await offlineDB.survey_art_responses.update(artRecord.id, { sync_status: 'synced' })
            } else {
               await enqueueSync('survey_art_responses', artRecord.id, 'update', artRecord)
            }
          }
        } else {
          // If update survey fails, we need to enqueue it
          if (exists) {
            await offlineDB.surveys.update(survey.id, { sync_status: 'pending' } as any)
            await enqueueSync('surveys', survey.id, 'update', record)
            for (const artRecord of artRecordsToSave) {
              await enqueueSync('survey_art_responses', artRecord.id, 'update', artRecord)
            }
          } else {
            throw sbErr // fallback error if we can't queue offline
          }
        }
      } else {
        // Offline logic
        if (exists) {
          await offlineDB.surveys.update(survey.id, { sync_status: 'pending' } as any)
          await enqueueSync('surveys', survey.id, 'update', record)
          for (const artRecord of artRecordsToSave) {
             await enqueueSync('survey_art_responses', artRecord.id, 'update', artRecord)
          }
        } else {
          setError('Anda sedang offline dan data survei ini tidak ada di lokal.')
          setSubmitting(false)
          return
        }
      }

      setDone(true)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Gagal menyimpan perubahan')
    } finally {
      setSubmitting(false)
    }
  }

  // ===== DONE SCREEN =====
  if (done && scoreResult) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-3xl border border-gray-100 p-8 shadow-xl text-center max-w-lg w-full">
          <div className="text-6xl mb-4">✅</div>
          <h2 className="text-2xl font-black text-gray-800 mb-1">Perubahan Disimpan!</h2>
          <p className="text-gray-500 text-sm mb-6 font-medium">Survei Keluarga {household.nama_kk} berhasil diperbarui.</p>

          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="bg-gray-50 rounded-2xl p-5 text-center">
              <p className="text-4xl font-black text-gray-800">
                {scoreResult.skor}<span className="text-lg text-gray-400">/{scoreResult.denominator}</span>
              </p>
              <p className="text-xs text-gray-400 uppercase tracking-wide font-bold mt-1">Skor Indikator</p>
            </div>
            <div className={`rounded-2xl p-5 text-center border flex flex-col justify-center ${
              scoreResult.is_rt_sehat
                ? 'bg-emerald-50 border-emerald-100 text-emerald-700'
                : 'bg-red-50 border-red-100 text-red-700'
            }`}>
              <p className="text-lg font-black leading-tight">{scoreResult.kategori}</p>
              <p className="text-[10px] uppercase tracking-wide font-bold opacity-60 mt-1">Klasifikasi PHBS</p>
            </div>
          </div>

          {scoreResult.failed_indicators.length > 0 && (
            <div className="mb-6 text-left">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">⚠️ Indikator Belum Terpenuhi:</p>
              <div className="space-y-2">
                {scoreResult.failed_indicators.map((label: string) => (
                  <div key={label} className="bg-red-50 text-red-700 text-xs px-3 py-2 rounded-lg flex items-center gap-2">
                    <span className="w-1.5 h-1.5 bg-red-400 rounded-full" />
                    {label}
                  </div>
                ))}
              </div>
            </div>
          )}

          <button
            onClick={() => router.push(`${basePath}/households/${household.id}`)}
            className="w-full bg-emerald-600 text-white py-3 rounded-2xl text-sm font-bold hover:bg-emerald-500 transition-all shadow-lg shadow-emerald-200"
          >
            Kembali ke Detail KK
          </button>
        </div>
      </div>
    )
  }

  // ===== MAIN WIZARD =====
  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
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

      {/* Progress Bar */}
      <div className="bg-white border-b border-gray-100">
        <div className="h-1 bg-gray-100">
          <div className="h-1 bg-emerald-500 transition-all duration-500" style={{ width: `${progress}%` }} />
        </div>
        <div className="px-6 py-2 flex items-center justify-between text-xs text-gray-400">
          <span>Langkah {step + 1} dari {totalSteps}</span>
          <span>{progress}% selesai</span>
        </div>
      </div>

      <div className="p-6 max-w-2xl mx-auto">
        {/* Household Info */}
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 mb-5 flex items-center gap-3">
          <span className="text-emerald-600">🏠</span>
          <div>
            <p className="text-emerald-800 font-medium text-sm">{household.nama_kk}</p>
            <p className="text-emerald-600 text-xs">{household.no_kk} · {household.ref_desa?.desa_kel}</p>
          </div>
        </div>

        {members.length === 0 && (
          <div className="bg-blue-50 text-blue-700 p-4 rounded-xl text-sm mb-5">
            Loading data anggota keluarga...
          </div>
        )}

        {members.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm mb-5">
            {/* Step 0: KK-level questions */}
            {step === 0 && (
              <>
                <h2 className="text-base font-bold text-gray-800 mb-5 flex items-center gap-2">
                  <span className="text-2xl">📋</span> Pertanyaan Level Rumah Tangga
                </h2>
                {renderBinaryQuestion('Menggunakan Air Bersih', 'Apakah keluarga menggunakan sumber air bersih?',
                  surveyKK.i4_air_bersih, v => setSurveyKK(p => ({ ...p, i4_air_bersih: v })))}
                {renderBinaryQuestion('Menggunakan Jamban Sehat', 'Apakah keluarga menggunakan jamban sehat leher angsa?',
                  surveyKK.i6_jamban_sehat, v => setSurveyKK(p => ({ ...p, i6_jamban_sehat: v })))}
                {renderBinaryQuestion('PSN 3M Plus', 'Apakah dilakukan PSN minimal seminggu sekali?',
                  surveyKK.i7_psn, v => setSurveyKK(p => ({ ...p, i7_psn: v })))}
              </>
            )}

            {/* Steps 1..N: per-ART */}
            {step > 0 && step <= members.length && (() => {
              const m = members[step - 1]
              const u = hitungUsia(m.tgl_lahir)
              const q = getARTQuestions(m.tgl_lahir, m.jenis_kelamin, m.hubungan_kk, has_bayi_1_tahun)
              const r = artResponses[m.id] ?? {}
              const updateArt = (key: keyof ArtResponse, val: boolean) => {
                setArtResponses(prev => ({ ...prev, [m.id]: { ...prev[m.id], [key]: val } }))
              }
              return (
                <>
                  <div className="flex items-center gap-3 mb-6 p-4 bg-gray-50 rounded-xl border border-gray-100">
                    <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center text-xl font-bold text-emerald-700">
                      {m.nama.charAt(0)}
                    </div>
                    <div>
                      <h2 className="text-base font-bold text-gray-800">{m.nama}</h2>
                      <p className="text-xs text-gray-500">{m.hubungan_kk} · {m.jenis_kelamin} · {u} tahun</p>
                    </div>
                    <div className="ml-auto text-xs bg-emerald-100 text-emerald-700 px-2 py-1 rounded-full font-medium">
                      ART {step}/{members.length}
                    </div>
                  </div>
                  {q.show_i1 || q.show_i2 || q.show_i3 || q.show_i5 || q.show_i8 || q.show_i9 || q.show_i10 ? (
                    <h3 className="font-bold text-gray-700 mt-4 mb-3 pb-2 border-b">Indikator PHBS Inti</h3>
                  ) : null}
                  {q.show_i1 && renderBinaryQuestion("Persalinan oleh Nakes", "Apakah pada persalinan termuda, ibu ditolong oleh tenaga kesehatan di fasilitas kesehatan?", r.i1_persalinan_nakes ?? undefined, v => updateArt('i1_persalinan_nakes', v))}
                  {q.show_i2 && renderBinaryQuestion("ASI Eksklusif", "Apakah bayi (0-6 bulan) ini mendapat ASI eksklusif?", r.i2_asi_eksklusif ?? undefined, v => updateArt('i2_asi_eksklusif', v))}
                  {q.show_i3 && renderBinaryQuestion("Menimbang Balita", "Apakah anak ini ditimbang minimal 8x dalam setahun di Posyandu?", r.i3_menimbang_balita ?? undefined, v => updateArt('i3_menimbang_balita', v))}
                  {q.show_i5 && renderBinaryQuestion('Cuci Tangan Pakai Sabun',
                    'Apakah mencuci tangan dengan sabun di air mengalir?',
                    r.i5_cuci_tangan as boolean | undefined, v => updateArt('i5_cuci_tangan', v))}
                  {q.show_i8 && renderBinaryQuestion('Makan Sayur dan Buah',
                    'Apakah makan sayur dan buah setiap hari?',
                    r.i8_makan_sayur_buah as boolean | undefined, v => updateArt('i8_makan_sayur_buah', v))}
                  {q.show_i9 && renderBinaryQuestion('Aktivitas Fisik',
                    'Apakah melakukan aktivitas fisik minimal 30 menit/hari?',
                    r.i9_aktivitas_fisik as boolean | undefined, v => updateArt('i9_aktivitas_fisik', v))}
                  {q.show_i10 && renderBinaryQuestion('Apakah Anggota Rumah Tangga ini TIDAK MEROKOK?',
                    'Apakah ART ini TIDAK MEROKOK di dalam rumah?',
                    r.i10_tidak_merokok as boolean | undefined, v => updateArt('i10_tidak_merokok', v))}
                  
                  {q.show_ckg || q.show_posyandu || q.show_ibu_hamil || q.show_remaja_putri_ttd ? (
                    <h3 className="font-bold text-gray-700 mt-6 mb-3 pb-2 border-b">Indikator GERMAS (Non-PHBS)</h3>
                  ) : null}
                  {q.show_ckg && renderBinaryQuestion('Cek Kesehatan Berkala',
                    'Apakah melakukan cek kesehatan minimal 1x dalam 6 bulan? (GERMAS)',
                    r.g_cek_kesehatan as boolean | undefined, v => updateArt('g_cek_kesehatan', v))}
                  {q.show_posyandu && renderBinaryQuestion('Kunjungan Posyandu',
                    'Apakah hadir di posyandu bulan lalu? (GERMAS)',
                    r.g_posyandu_hadir as boolean | undefined, v => updateArt('g_posyandu_hadir', v))}
                  
                  {q.show_ibu_hamil && renderBinaryQuestion("Sedang Hamil?", "Apakah ART ini sedang hamil?", r.g_ibu_hamil ?? undefined, v => {
                    updateArt('g_ibu_hamil', v)
                    if (!v) updateArt('g_ibu_hamil_ttd', false)
                  })}
                  {r.g_ibu_hamil && renderBinaryQuestion("Ibu Hamil Konsumsi TTD", "Apakah ibu hamil ini rutin mengonsumsi TTD?", r.g_ibu_hamil_ttd ?? undefined, v => updateArt('g_ibu_hamil_ttd', v))}
                  {q.show_remaja_putri_ttd && renderBinaryQuestion("Remaja Putri Konsumsi TTD", "Apakah remaja putri ini rutin mengonsumsi Tablet Tambah Darah?", r.g_remaja_putri_ttd ?? undefined, v => updateArt('g_remaja_putri_ttd', v))}
                </>
              )
            })()}

            {/* Last step: notes */}
            {step === totalSteps - 1 && (
              <>
                <h2 className="text-base font-bold text-gray-800 mb-5 flex items-center gap-2">
                  <span className="text-2xl">📝</span> Catatan &amp; Simpan
                </h2>
                <label className="block text-sm font-medium text-gray-700 mb-2">Catatan Surveyor (opsional)</label>
                <textarea rows={3} value={catatan} onChange={e => setCatatan(e.target.value)}
                  placeholder="Catatan tambahan..."
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-400 resize-none" />
              </>
            )}
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-4 text-red-700 text-sm">⚠️ {error}</div>
        )}

        {/* Navigation */}
        {members.length > 0 && (
          <div className="flex gap-3">
            {step > 0 && (
              <button onClick={() => setStep(s => s - 1)}
                className="px-5 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50 transition-colors">
                ← Sebelumnya
              </button>
            )}
            {step < totalSteps - 1 ? (
              <button onClick={() => setStep(s => s + 1)} disabled={!isStepValid()}
                className="flex-1 bg-emerald-600 hover:bg-emerald-500 disabled:bg-gray-200 disabled:text-gray-400 text-white font-medium py-2.5 rounded-xl text-sm transition-colors">
                Lanjut →
              </button>
            ) : (
              <button onClick={handleSubmit} disabled={submitting || !isStepValid()}
                className="flex-1 bg-emerald-600 hover:bg-emerald-500 disabled:bg-gray-200 text-white font-medium py-2.5 rounded-xl text-sm transition-colors flex items-center justify-center gap-2">
                {submitting ? 'Menyimpan...' : '💾 Simpan Perubahan'}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
