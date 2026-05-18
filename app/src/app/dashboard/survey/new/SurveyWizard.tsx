'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { offlineDB, generateLocalId, nowISO, LocalFamilyMember } from '@/lib/db/offline'
import { enqueueSync } from '@/lib/db/sync'
import SyncStatusBar from '@/components/SyncStatusBar'
import { hitungSkorPHBS, getARTQuestions, hitungUsia, ArtResponse, SurveyIndikator } from '@/lib/phbs/scoring'

interface Household {
  id: string; no_kk: string; nama_kk: string
  puskesmas_id?: string
  alamat?: string; rt?: string; rw?: string
  ref_desa: { desa_kel: string } | null
  ref_puskesmas?: { nama: string } | null
}
interface Desa { id: string; desa_kel: string; puskesmas_id: string }
interface Puskesmas { id: string; nama: string; kecamatan: string }
interface AppUser {
  id: string; email: string; role: string; puskesmas_id: string
  ref_puskesmas: { id: string; nama: string; kecamatan: string } | null
}
interface Props {
  appUser: AppUser
  initialHousehold: Household | null
  householdList: Household[]
  isSuperAdmin?: boolean
  allPuskesmas?: Puskesmas[]
  initialDesaList?: Desa[]
  basePath?: string
}

export default function SurveyWizard({ 
  appUser, initialHousehold, householdList, 
  isSuperAdmin = false, allPuskesmas = [], initialDesaList = [],
  basePath = '/dashboard' 
}: Props) {
  const router = useRouter()
  const supabase = createClient()

  const [household, setHousehold] = useState<Household | null>(initialHousehold)
  const [members, setMembers] = useState<LocalFamilyMember[]>([])
  const [step, setStep] = useState(0)
  
  // State for survey responses
  const [surveyKK, setSurveyKK] = useState<Partial<SurveyIndikator>>({})
  const [artResponses, setArtResponses] = useState<Record<string, Partial<ArtResponse>>>({})
  const [catatan, setCatatan] = useState('')
  
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')
  const [scoreResult, setScoreResult] = useState<any>(null)

  // Filters for household selection
  const [search, setSearch]             = useState('')
  const [filterDesa, setFilterDesa]     = useState('')
  const [selectedPkm, setSelectedPkm]   = useState('')
  const [desaList, setDesaList]         = useState<Desa[]>(initialDesaList)
  const [households, setHouseholds]     = useState<Household[]>(householdList)
  const [currentPage, setCurrentPage]   = useState(1)
  const itemsPerPage = 5
  
  const handlePkmChange = useCallback(async (pkmId: string) => {
    setSelectedPkm(pkmId)
    setFilterDesa('')
    setCurrentPage(1)

    if (pkmId) {
      const { data: desa } = await supabase
        .from('ref_desa')
        .select('id, desa_kel, puskesmas_id')
        .eq('puskesmas_id', pkmId)
        .order('desa_kel')
      setDesaList(desa || [])

      const { data: hh } = await supabase
        .from('households')
        .select('id, no_kk, nama_kk, puskesmas_id, alamat, rt, rw, ref_desa(desa_kel), ref_puskesmas(nama)')
        .eq('puskesmas_id', pkmId)
        .order('created_at', { ascending: false })
        .limit(1000)
      
      const formatted = (hh || []).map(h => ({
        ...h,
        ref_desa: Array.isArray(h.ref_desa) ? (h.ref_desa[0] ?? null) : h.ref_desa,
        ref_puskesmas: Array.isArray(h.ref_puskesmas) ? (h.ref_puskesmas[0] ?? null) : h.ref_puskesmas,
      }))
      setHouseholds(formatted as unknown as Household[])
    } else {
      setDesaList([])
      const { data: hh } = await supabase
        .from('households')
        .select('id, no_kk, nama_kk, puskesmas_id, alamat, rt, rw, ref_desa(desa_kel), ref_puskesmas(nama)')
        .order('created_at', { ascending: false })
        .limit(1000)
        
      const formatted = (hh || []).map(h => ({
        ...h,
        ref_desa: Array.isArray(h.ref_desa) ? (h.ref_desa[0] ?? null) : h.ref_desa,
        ref_puskesmas: Array.isArray(h.ref_puskesmas) ? (h.ref_puskesmas[0] ?? null) : h.ref_puskesmas,
      }))
      setHouseholds(formatted as unknown as Household[])
    }
  }, [supabase])

  const filtered = households.filter(h => {
    const matchSearch = !search ||
      h.nama_kk.toLowerCase().includes(search.toLowerCase()) ||
      h.no_kk.includes(search)
    const matchDesa = !filterDesa || h.ref_desa?.desa_kel === filterDesa
    return matchSearch && matchDesa
  })

  const totalPages = Math.ceil(filtered.length / itemsPerPage)
  const paginatedHouseholds = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)

  // Load members when household changes
  useEffect(() => {
    if (!household) return
    async function loadMembers() {
      let m = await offlineDB.family_members.where('household_id').equals(household!.id).toArray()
      if (m.length === 0 && navigator.onLine) {
        const { data } = await supabase.from('family_members').select('*').eq('household_id', household!.id)
        if (data) {
          m = data as LocalFamilyMember[]
          await offlineDB.family_members.bulkPut(m)
        }
      }
      setMembers(m)
      
      // Init ART responses
      const initialArt: Record<string, Partial<ArtResponse>> = {}
      m.forEach(mem => {
        initialArt[mem.id] = { family_member_id: mem.id }
      })
      setArtResponses(initialArt)
    }
    loadMembers()
  }, [household])

  // Hitung total steps: 1 (KK) + members.length (ART) + 1 (Catatan)
  const totalSteps = members.length > 0 ? members.length + 2 : 2
  const progress = Math.round((step / (totalSteps - 1)) * 100)

  // Cek apakah balita/bayi ada untuk applicability
  const hasBalita = members.some(m => hitungUsia(m.tgl_lahir) < 5)
  const hasBayi = members.some(m => hitungUsia(m.tgl_lahir) === 0) // Asumsi usia 0 = bayi
  const hasIbuHamil = surveyKK.i14_ibu_hamil === true
  const hasRemajaP = members.some(m => {
    const u = hitungUsia(m.tgl_lahir)
    return m.jenis_kelamin === 'P' && u >= 12 && u <= 18
  })

  // Validasi step
  const isStepValid = () => {
    if (step === 0) {
      if (!household) return false
      // Validasi KK questions
      const reqKeys = ['i4_air_bersih', 'i6_jamban_sehat', 'i7_psn']
      if (hasBalita) reqKeys.push('i1_persalinan_nakes', 'i3_menimbang_balita')
      if (hasBayi) reqKeys.push('i2_asi_eksklusif')
      reqKeys.push('i14_ibu_hamil')
      if (hasIbuHamil) reqKeys.push('i15_ibu_hamil_ttd')
      if (hasRemajaP) reqKeys.push('i17_remaja_putri_ttd')
      
      return reqKeys.every(k => surveyKK[k as keyof SurveyIndikator] !== undefined)
    }
    if (step > 0 && step <= members.length) {
      const m = members[step - 1]
      const q = getARTQuestions(hitungUsia(m.tgl_lahir), m.jenis_kelamin)
      const r = artResponses[m.id]
      if (!r) return false
      if (q.show_i5 && r.i5_cuci_tangan === undefined) return false
      if (q.show_i8 && r.i8_makan_sayur_buah === undefined) return false
      if (q.show_i9 && r.i9_aktivitas_fisik === undefined) return false
      if (q.show_i10 && r.i10_tidak_merokok === undefined) return false
      if (q.show_ckg && r.g_cek_kesehatan === undefined) return false
      if (q.show_posyandu && r.g_posyandu_hadir === undefined) return false
      return true
    }
    return true
  }

  async function handleSubmit() {
    setSubmitting(true)
    setError('')

    const surveyData: SurveyIndikator = {
      i1_persalinan_nakes: hasBalita ? (surveyKK.i1_persalinan_nakes ?? null) : null,
      i2_asi_eksklusif: hasBayi ? (surveyKK.i2_asi_eksklusif ?? null) : null,
      i3_menimbang_balita: hasBalita ? (surveyKK.i3_menimbang_balita ?? null) : null,
      i4_air_bersih: surveyKK.i4_air_bersih ?? false,
      i6_jamban_sehat: surveyKK.i6_jamban_sehat ?? false,
      i7_psn: surveyKK.i7_psn ?? false,
      i14_ibu_hamil: surveyKK.i14_ibu_hamil ?? false,
      i15_ibu_hamil_ttd: hasIbuHamil ? (surveyKK.i15_ibu_hamil_ttd ?? null) : null,
      i16_remaja_putri: hasRemajaP,
    }

    const artList = Object.values(artResponses) as ArtResponse[]
    const score = hitungSkorPHBS(surveyData, artList)
    setScoreResult(score)

    const id = generateLocalId()
    const now = nowISO()

    // Aggregate values for legacy columns
    const artCuciTangan = artList.filter(a => a.i5_cuci_tangan !== null)
    const i5 = artCuciTangan.length > 0 && artCuciTangan.some(a => a.i5_cuci_tangan)
    const artMakanSayur = artList.filter(a => a.i8_makan_sayur_buah !== null)
    const i8 = artMakanSayur.length > 0 && artMakanSayur.some(a => a.i8_makan_sayur_buah)
    const artAktivitas = artList.filter(a => a.i9_aktivitas_fisik !== null)
    const i9 = artAktivitas.length > 0 && artAktivitas.some(a => a.i9_aktivitas_fisik)
    const i10 = !artList.some(a => a.i10_tidak_merokok === false)
    const i11 = artList.some(a => a.g_cek_kesehatan === true)
    const i12 = artList.some(a => a.g_posyandu_hadir === true)

    const record = {
      id,
      household_id: household!.id,
      tahun: new Date().getFullYear(),
      survey_date: new Date().toISOString().split('T')[0],
      ...surveyData,
      i5_cuci_tangan: i5,
      i8_makan_sayur_buah: i8,
      i9_aktivitas_fisik: i9,
      i10_tidak_merokok: i10,
      i11_cek_kesehatan: i11,
      i12_kunjungan_posyandu: i12,
      i13_pengunjung_posyandu: null,
      i17_remaja_putri_ttd: hasRemajaP ? (surveyKK.i17_remaja_putri_ttd ?? null) : null,
      catatan: catatan || null,
      skor_phbs: score.skor,
      denominator_phbs: score.denominator,
      is_rt_sehat: score.is_rt_sehat,
      kategori_phbs: score.kategori,
      created_by: appUser.id,
      created_at: now,
      updated_at: now,
      sync_status: 'pending' as const,
    }

    try {
      // 1. Simpan ke local DB
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await offlineDB.surveys.add(record as any)
      
      const artRecordsToSave = artList.map(art => ({
        id: generateLocalId(),
        survey_id: id,
        family_member_id: art.family_member_id,
        i5_cuci_tangan: art.i5_cuci_tangan ?? null,
        i8_makan_sayur_buah: art.i8_makan_sayur_buah ?? null,
        i9_aktivitas_fisik: art.i9_aktivitas_fisik ?? null,
        i10_tidak_merokok: art.i10_tidak_merokok ?? null,
        g_cek_kesehatan: art.g_cek_kesehatan ?? null,
        g_posyandu_hadir: art.g_posyandu_hadir ?? null,
        created_at: now,
        updated_at: now,
        sync_status: 'pending' as const
      }))

      for (const artRecord of artRecordsToSave) {
        await offlineDB.survey_art_responses.add(artRecord)
      }

      // 2. Coba simpan ke server jika online
      if (navigator.onLine) {
        const { error: sbErr } = await supabase.from('surveys').insert({
          ...record, sync_status: undefined,
        })
        
        if (!sbErr) {
          await offlineDB.surveys.update(id, { sync_status: 'synced' })
          
          for (const artRecord of artRecordsToSave) {
            const payload = { ...artRecord, sync_status: undefined }
            const { error: artErr } = await supabase.from('survey_art_responses').upsert(payload)
            if (!artErr) {
               await offlineDB.survey_art_responses.update(artRecord.id, { sync_status: 'synced' })
            } else {
               await enqueueSync('survey_art_responses', artRecord.id, 'insert', artRecord)
            }
          }
        } else {
          if (sbErr.code === '23505') {
            await offlineDB.surveys.delete(id)
            for (const artRecord of artRecordsToSave) await offlineDB.survey_art_responses.delete(artRecord.id)
            setError('Survei untuk KK ini di tahun ini sudah ada.')
            setSubmitting(false); return
          }
          await enqueueSync('surveys', id, 'insert', record)
          for (const artRecord of artRecordsToSave) {
             await enqueueSync('survey_art_responses', artRecord.id, 'insert', artRecord)
          }
        }
      } else {
        await enqueueSync('surveys', id, 'insert', record)
        for (const artRecord of artRecordsToSave) {
           await enqueueSync('survey_art_responses', artRecord.id, 'insert', artRecord)
        }
      }

      setDone(true)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Gagal menyimpan survei')
    } finally {
      setSubmitting(false)
    }
  }

  if (done && scoreResult) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-3xl border border-gray-100 p-8 shadow-xl text-center max-w-lg w-full">
          <div className="text-6xl mb-4">🏆</div>
          <h2 className="text-2xl font-black text-gray-800 mb-1">Survei Selesai!</h2>
          <p className="text-gray-500 text-sm mb-6 font-medium">Analisis untuk Keluarga {household?.nama_kk}</p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div className="bg-gray-50 rounded-2xl p-5 text-center">
              <p className="text-4xl font-black text-gray-800">{scoreResult.skor}<span className="text-lg text-gray-400">/{scoreResult.denominator}</span></p>
              <p className="text-xs text-gray-400 uppercase tracking-wide font-bold mt-1">Skor Indikator</p>
            </div>
            <div className={`rounded-2xl p-5 text-center border flex flex-col justify-center ${
              scoreResult.is_rt_sehat ? 'bg-emerald-50 border-emerald-100 text-emerald-700' : 'bg-red-50 border-red-100 text-red-700'
            }`}>
              <p className="text-lg font-black leading-tight">{scoreResult.kategori}</p>
              <p className="text-[10px] uppercase tracking-wide font-bold opacity-60 mt-1">Klasifikasi PHBS</p>
            </div>
          </div>

          {scoreResult.failed_indicators.length > 0 && (
            <div className="mb-8 text-left">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">⚠️ Indikator Gagal:</p>
              <div className="space-y-2">
                {scoreResult.failed_indicators.map((label: string) => (
                  <div key={label} className="bg-red-50 text-red-700 text-xs px-3 py-2 rounded-lg flex items-center gap-2">
                    <span className="w-1.5 h-1.5 bg-red-400 rounded-full"></span>
                    {label}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-3">
            <button onClick={() => router.push(`${basePath}/households/new`)}
              className="flex-1 border-2 border-gray-100 text-gray-600 py-3 rounded-2xl text-sm font-bold hover:bg-gray-50 transition-all">
              + Tambah KK
            </button>
            <button onClick={() => router.push(`${basePath}/households`)}
              className="flex-1 bg-gray-800 text-white py-3 rounded-2xl text-sm font-bold hover:bg-gray-700 transition-all shadow-lg shadow-gray-200">
              Selesai & Tutup
            </button>
          </div>
        </div>
      </div>
    )
  }

  const renderBinaryQuestion = (label: string, desc: string, val: boolean | undefined, onChange: (v: boolean) => void) => (
    <div className={`rounded-xl p-4 border transition-all mb-4 ${
      val === true ? 'bg-emerald-50 border-emerald-200' : val === false ? 'bg-red-50 border-red-200' : 'bg-white border-gray-100'
    }`}>
      <p className="text-sm font-semibold text-gray-800 mb-1">{label}</p>
      {desc && <p className="text-xs text-gray-500 mb-3">{desc}</p>}
      <div className="flex gap-2">
        <button type="button" onClick={() => onChange(true)}
          className={`flex-1 py-2.5 rounded-lg text-sm font-medium border transition-all ${val === true ? 'bg-emerald-600 text-white border-emerald-600' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
          ✅ Ya
        </button>
        <button type="button" onClick={() => onChange(false)}
          className={`flex-1 py-2.5 rounded-lg text-sm font-medium border transition-all ${val === false ? 'bg-red-500 text-white border-red-500' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
          ❌ Tidak
        </button>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href={`${basePath}/households`} className="text-gray-400 hover:text-gray-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/></svg>
          </Link>
          <div>
            <h1 className="text-lg font-bold text-gray-800">Survei PHBS (Update)</h1>
            <p className="text-xs text-gray-500">{appUser?.ref_puskesmas?.nama}</p>
          </div>
        </div>
        <SyncStatusBar />
      </div>

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
        {!household && (
          <div className="bg-white border border-gray-200 rounded-2xl p-6 mb-5 shadow-sm">
            <h2 className="text-lg font-bold text-gray-800 mb-4">Pilih Rumah Tangga</h2>
            
            <div className="flex flex-wrap gap-3 mb-5">
              <div className="flex-1 min-w-48 relative">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
                </svg>
                <input
                  type="text"
                  placeholder="Cari nama KK atau No KK..."
                  value={search}
                  onChange={e => { setSearch(e.target.value); setCurrentPage(1); }}
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-400 focus:outline-none text-gray-900 bg-white font-medium placeholder-gray-400"
                />
              </div>

              {isSuperAdmin && (
                <select
                  value={selectedPkm}
                  onChange={e => handlePkmChange(e.target.value)}
                  className="border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-emerald-400 focus:outline-none text-gray-900 bg-white min-w-40 font-medium"
                >
                  <option value="">🏥 Semua Puskesmas</option>
                  {allPuskesmas.map(p => (
                    <option key={p.id} value={p.id}>{p.nama}</option>
                  ))}
                </select>
              )}

              {desaList.length > 0 && (
                <select
                  value={filterDesa}
                  onChange={e => { setFilterDesa(e.target.value); setCurrentPage(1); }}
                  className="border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-emerald-400 focus:outline-none text-gray-900 bg-white min-w-32 font-medium"
                >
                  <option value="">Semua Desa</option>
                  {desaList.map(d => (
                    <option key={d.id} value={d.desa_kel}>{d.desa_kel}</option>
                  ))}
                </select>
              )}
            </div>

            <div className="space-y-3">
              {paginatedHouseholds.length > 0 ? paginatedHouseholds.map(h => (
                <div key={h.id} 
                  onClick={() => setHousehold(h)}
                  className="bg-white border border-gray-100 rounded-xl p-4 hover:border-emerald-300 hover:shadow-md transition-all cursor-pointer group"
                >
                  <div className="flex justify-between items-center">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-mono">{h.no_kk}</span>
                        {h.ref_desa && <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">{h.ref_desa.desa_kel}</span>}
                        {isSuperAdmin && h.ref_puskesmas && (
                          <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">{h.ref_puskesmas.nama}</span>
                        )}
                      </div>
                      <h3 className="font-semibold text-gray-800 text-sm group-hover:text-emerald-600 transition-colors">{h.nama_kk}</h3>
                      <p className="text-gray-400 text-xs mt-0.5">{h.alamat} RT {h.rt}/RW {h.rw}</p>
                    </div>
                    <div className="text-emerald-500 opacity-0 group-hover:opacity-100 transition-opacity">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/></svg>
                    </div>
                  </div>
                </div>
              )) : (
                <div className="text-center py-8 text-gray-400 text-sm bg-gray-50 rounded-xl border border-dashed border-gray-200">
                  Tidak ada data KK ditemukan
                </div>
              )}
            </div>

            {totalPages > 0 && (
              <div className="flex justify-between items-center mt-5 pt-5 border-t border-gray-100">
                <p className="text-sm text-gray-500">
                  Halaman <span className="font-semibold text-gray-900">{currentPage}</span> dari <span className="font-semibold text-gray-900">{totalPages || 1}</span>
                </p>
                <div className="flex gap-2">
                  <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors">Sebelumnya</button>
                  <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages || totalPages === 0} className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors">Selanjutnya</button>
                </div>
              </div>
            )}
          </div>
        )}

        {household && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 mb-5 flex items-center gap-3">
            <span className="text-emerald-600">🏠</span>
            <div>
              <p className="text-emerald-800 font-medium text-sm">{household.nama_kk}</p>
              <p className="text-emerald-600 text-xs">{household.no_kk} · {household.ref_desa?.desa_kel}</p>
            </div>
          </div>
        )}

        {household && members.length === 0 && (
          <div className="bg-blue-50 text-blue-700 p-4 rounded-xl text-sm mb-5">
            Loading data anggota keluarga...
          </div>
        )}

        {household && members.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm mb-5">
            {step === 0 && (
              <>
                <h2 className="text-base font-bold text-gray-800 mb-5 flex items-center gap-2">
                  <span className="text-2xl">📋</span> Pertanyaan Level Rumah Tangga
                </h2>

                <h3 className="font-bold text-gray-700 mt-4 mb-3 pb-2 border-b">Indikator PHBS Inti</h3>
                {renderBinaryQuestion("Menggunakan Air Bersih", "Apakah keluarga menggunakan sumber air bersih?", surveyKK.i4_air_bersih, v => setSurveyKK({...surveyKK, i4_air_bersih: v}))}
                {renderBinaryQuestion("Menggunakan Jamban Sehat", "Apakah keluarga menggunakan jamban sehat leher angsa?", surveyKK.i6_jamban_sehat, v => setSurveyKK({...surveyKK, i6_jamban_sehat: v}))}
                {renderBinaryQuestion("Pemberantasan Sarang Nyamuk (PSN)", "Apakah dilakukan PSN minimal seminggu sekali (3M Plus)?", surveyKK.i7_psn, v => setSurveyKK({...surveyKK, i7_psn: v}))}
                
                {hasBalita && renderBinaryQuestion("Persalinan oleh Tenaga Kesehatan", "Apakah persalinan terakhir ditolong oleh tenaga kesehatan?", surveyKK.i1_persalinan_nakes ?? undefined, v => setSurveyKK({...surveyKK, i1_persalinan_nakes: v}))}
                {hasBayi && renderBinaryQuestion("ASI Eksklusif", "Apakah bayi (0-6 bulan) mendapat ASI eksklusif?", surveyKK.i2_asi_eksklusif ?? undefined, v => setSurveyKK({...surveyKK, i2_asi_eksklusif: v}))}
                {hasBalita && renderBinaryQuestion("Menimbang Balita", "Apakah balita ditimbang minimal 8x dalam setahun di Posyandu?", surveyKK.i3_menimbang_balita ?? undefined, v => setSurveyKK({...surveyKK, i3_menimbang_balita: v}))}
                
                <h3 className="font-bold text-gray-700 mt-6 mb-3 pb-2 border-b">Indikator GERMAS (Non-PHBS)</h3>
                {renderBinaryQuestion("Ada Ibu Hamil", "Apakah ada anggota keluarga yang sedang hamil?", surveyKK.i14_ibu_hamil ?? undefined, v => setSurveyKK({...surveyKK, i14_ibu_hamil: v}))}
                {hasIbuHamil && renderBinaryQuestion("Ibu Hamil Konsumsi TTD", "Apakah ibu hamil rutin mengonsumsi TTD?", surveyKK.i15_ibu_hamil_ttd ?? undefined, v => setSurveyKK({...surveyKK, i15_ibu_hamil_ttd: v}))}
                {hasRemajaP && renderBinaryQuestion("Remaja Putri Konsumsi TTD", "Apakah remaja putri (12-18 th) rutin mengonsumsi Tablet Tambah Darah?", surveyKK.i17_remaja_putri_ttd ?? undefined, v => setSurveyKK({...surveyKK, i17_remaja_putri_ttd: v}))}
              </>
            )}

            {step > 0 && step <= members.length && (
              <>
                {(() => {
                  const m = members[step - 1]
                  const u = hitungUsia(m.tgl_lahir)
                  const q = getARTQuestions(u, m.jenis_kelamin)
                  const r = artResponses[m.id]
                  const updateArt = (key: keyof ArtResponse, val: boolean) => {
                    setArtResponses(prev => ({...prev, [m.id]: {...prev[m.id], [key]: val}}))
                  }

                  return (
                    <>
                      <div className="flex items-center gap-3 mb-6 p-4 bg-gray-50 rounded-xl border border-gray-100">
                        <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center text-xl">👤</div>
                        <div>
                          <h2 className="text-base font-bold text-gray-800">{m.nama}</h2>
                          <p className="text-xs text-gray-500">{m.hubungan_kk} · {m.jenis_kelamin} · {u} tahun</p>
                        </div>
                      </div>

                      {q.show_i5 || q.show_i8 || q.show_i9 || q.show_i10 ? (
                        <h3 className="font-bold text-gray-700 mt-4 mb-3 pb-2 border-b">Indikator PHBS Inti</h3>
                      ) : null}
                      {q.show_i5 && renderBinaryQuestion("Cuci Tangan Pakai Sabun", "Apakah mencuci tangan dengan sabun di air mengalir?", r.i5_cuci_tangan ?? undefined, v => updateArt('i5_cuci_tangan', v))}
                      {q.show_i8 && renderBinaryQuestion("Makan Sayur dan Buah", "Apakah makan sayur dan buah setiap hari?", r.i8_makan_sayur_buah ?? undefined, v => updateArt('i8_makan_sayur_buah', v))}
                      {q.show_i9 && renderBinaryQuestion("Aktivitas Fisik", "Apakah melakukan aktivitas fisik minimal 30 menit/hari?", r.i9_aktivitas_fisik ?? undefined, v => updateArt('i9_aktivitas_fisik', v))}
                      {q.show_i10 && renderBinaryQuestion("TIDAK Merokok", "Apakah ART ini TIDAK MEROKOK?", r.i10_tidak_merokok ?? undefined, v => updateArt('i10_tidak_merokok', v))}
                      
                      {q.show_ckg || q.show_posyandu ? (
                        <h3 className="font-bold text-gray-700 mt-6 mb-3 pb-2 border-b">Indikator GERMAS (Non-PHBS)</h3>
                      ) : null}
                      {q.show_ckg && renderBinaryQuestion("Cek Kesehatan Berkala", "Apakah melakukan cek kesehatan minimal 1x dalam 6 bulan? (GERMAS)", r.g_cek_kesehatan ?? undefined, v => updateArt('g_cek_kesehatan', v))}
                      {q.show_posyandu && renderBinaryQuestion("Kunjungan Posyandu", "Apakah hadir di posyandu bulan lalu? (GERMAS)", r.g_posyandu_hadir ?? undefined, v => updateArt('g_posyandu_hadir', v))}
                    </>
                  )
                })()}
              </>
            )}

            {step === totalSteps - 1 && (
              <>
                <h2 className="text-base font-bold text-gray-800 mb-5 flex items-center gap-2">
                  <span className="text-2xl">📝</span> Catatan & Simpan
                </h2>
                <div className="bg-white rounded-xl border border-gray-100 p-4 mb-5">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Catatan Surveyor (opsional)</label>
                  <textarea rows={3} value={catatan} onChange={e => setCatatan(e.target.value)} placeholder="Catatan tambahan..." className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-400 resize-none"/>
                </div>
              </>
            )}
          </div>
        )}

        {error && <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-4 text-red-700 text-sm">⚠️ {error}</div>}

        {household && members.length > 0 && (
          <div className="flex gap-3">
            {step > 0 && (
              <button onClick={() => setStep(s => s - 1)} className="px-5 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50 transition-colors">
                ← Sebelumnya
              </button>
            )}
            {step < totalSteps - 1 ? (
              <button onClick={() => setStep(s => s + 1)} disabled={!isStepValid()} className="flex-1 bg-emerald-600 hover:bg-emerald-500 disabled:bg-gray-200 disabled:text-gray-400 text-white font-medium py-2.5 rounded-xl text-sm transition-colors">
                Lanjut →
              </button>
            ) : (
              <button onClick={handleSubmit} disabled={submitting || !isStepValid()} className="flex-1 bg-emerald-600 hover:bg-emerald-500 disabled:bg-gray-200 text-white font-medium py-2.5 rounded-xl text-sm transition-colors flex items-center justify-center gap-2">
                {submitting ? 'Menyimpan...' : '💾 Simpan Survei'}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
