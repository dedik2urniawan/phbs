'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { offlineDB, generateLocalId, nowISO } from '@/lib/db/offline'
import { enqueueSync } from '@/lib/db/sync'
import { validateNoKK } from '@/lib/validators/nik'
import SyncStatusBar from '@/components/SyncStatusBar'
import AddFamilyMemberForm, { FamilyMemberInput } from './AddFamilyMemberForm'

interface Desa { id: string; desa_kel: string; puskesmas_id?: string }
interface AppUser {
  id: string; email: string; role: string
  puskesmas_id: string
  ref_puskesmas: { id: string; nama: string; kecamatan: string } | null
}

interface Props {
  appUser: AppUser
  desaList: Desa[]
  allPuskesmas?: { id: string; nama: string }[]
  backHref?: string   // Override back URL (default: /dashboard/households)
}

type Step = 'household' | 'members' | 'done'

export default function AddHouseholdForm({ appUser, desaList, allPuskesmas = [], backHref = '/dashboard/households' }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const [step, setStep] = useState<Step>('household')
  const [householdId, setHouseholdId] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  // Form state KK
  const [form, setForm] = useState({
    puskesmas_id: appUser.role === 'superadmin' ? '' : appUser.puskesmas_id,
    no_kk: '',
    nik_kk: '',
    nama_kk: '',
    desa_id: '',
    alamat: '',
    rt: '',
    rw: '',
  })
  const [nikInfo, setNikInfo] = useState<{ tgl_lahir: Date | null; jenis_kelamin: 'L' | 'P' | null } | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  const isSuperAdmin = appUser.role === 'superadmin'
  const pkmData = Array.isArray(appUser?.ref_puskesmas) ? appUser.ref_puskesmas[0] : appUser?.ref_puskesmas
  const puskesmasName = isSuperAdmin ? 'Dinkes Kab. Malang' : (pkmData?.nama || 'Puskesmas')

  // Filter desa berdasarkan puskesmas_id yang dipilih
  const availableDesa = isSuperAdmin 
    ? desaList.filter(d => d.puskesmas_id === form.puskesmas_id)
    : desaList

  function validateForm() {
    const errs: Record<string, string> = {}
    if (isSuperAdmin && !form.puskesmas_id) errs.puskesmas_id = 'Pilih Puskesmas'
    const kkResult = validateNoKK(form.no_kk)
    if (!kkResult.valid) errs.no_kk = kkResult.error!
    
    // NIK validation (opsional tapi jika diisi harus valid)
    if (form.nik_kk) {
      const { validateNIK } = require('@/lib/validators/nik')
      const nikResult = validateNIK(form.nik_kk)
      if (!nikResult.valid) {
        errs.nik_kk = nikResult.error!
      }
    }
    
    if (!form.nama_kk.trim()) errs.nama_kk = 'Nama KK wajib diisi'
    if (!form.desa_id) errs.desa_id = 'Pilih desa/kelurahan'
    if (!form.alamat.trim()) errs.alamat = 'Alamat wajib diisi'
    if (!form.rt.trim()) errs.rt = 'RT wajib diisi'
    if (!form.rw.trim()) errs.rw = 'RW wajib diisi'
    setFieldErrors(errs)
    return Object.keys(errs).length === 0
  }

  async function handleHouseholdSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validateForm()) return
    setSubmitting(true)
    setError('')

    const id = generateLocalId()
    const now = nowISO()
    const record = {
      id,
      puskesmas_id: form.puskesmas_id,
      desa_id: form.desa_id,
      no_kk: form.no_kk.replace(/\s/g, ''),
      nik_kk: form.nik_kk ? form.nik_kk.replace(/\s/g, '') : null,
      nama_kk: form.nama_kk.trim(),
      alamat: form.alamat.trim(),
      rt: form.rt.trim(),
      rw: form.rw.trim(),
      created_by: appUser.id,
      created_at: now,
      updated_at: now,
      sync_status: 'pending' as const,
    }

    try {
      // Cek duplikat No KK lokal
      const existing = await offlineDB.households
        .where('no_kk').equals(record.no_kk)
        .first()
      if (existing) {
        setError(`No KK ${record.no_kk} sudah terdaftar di lokal`)
        setSubmitting(false)
        return
      }

      // Simpan ke IndexedDB dulu
      await offlineDB.households.add(record)

      // Coba simpan ke Supabase langsung
      if (navigator.onLine) {
        const { error: sbError } = await supabase.from('households').insert({
          ...record,
          sync_status: undefined,
        })
        if (sbError) {
          // Jika error duplikat no_kk
          if (sbError.code === '23505') {
            await offlineDB.households.delete(id)
            setError('No KK sudah terdaftar di database. Gunakan No KK yang berbeda.')
            setSubmitting(false)
            return
          }
          // Error lain: masuk queue untuk retry
          await enqueueSync('households', id, 'insert', record)
        } else {
          await offlineDB.households.update(id, { sync_status: 'synced' })
        }
      } else {
        await enqueueSync('households', id, 'insert', record)
      }

      setHouseholdId(id)
      setStep('members')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Terjadi kesalahan')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleMembersDone(members: FamilyMemberInput[]) {
    // Simpan semua anggota keluarga
    for (const m of members) {
      const id = generateLocalId()
      const now = nowISO()
      const record = {
        id,
        household_id: householdId,
        nama: m.nama.trim(),
        nik: m.nik?.replace(/\s/g, '') || null,
        jenis_kelamin: m.jenis_kelamin,
        tgl_lahir: m.tgl_lahir,
        hubungan_kk: m.hubungan_kk,
        pendidikan: m.pendidikan || null,
        pekerjaan: m.pekerjaan || null,
        created_at: now,
        sync_status: 'pending' as const,
      }

      await offlineDB.family_members.add(record)

      if (navigator.onLine) {
        const { error } = await supabase.from('family_members').insert({
          ...record,
          sync_status: undefined,
        })
        if (!error) {
          await offlineDB.family_members.update(id, { sync_status: 'synced' })
        } else {
          await enqueueSync('family_members', id, 'insert', record)
        }
      } else {
        await enqueueSync('family_members', id, 'insert', record)
      }
    }

    setStep('done')
  }

  const field = (name: keyof typeof form, uppercase?: boolean) => ({
    value: form[name],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
      const val = uppercase ? e.target.value.toUpperCase() : e.target.value
      setForm(prev => ({ ...prev, [name]: val }))
    },
    className: `w-full border rounded-xl px-4 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-400 transition-all ${
      fieldErrors[name] ? 'border-red-400 bg-red-50' : 'border-gray-200 bg-white'
    }`,
  })

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href={backHref} className="text-gray-400 hover:text-gray-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div>
            <h1 className="text-lg font-bold text-gray-800">Tambah Rumah Tangga</h1>
            <p className="text-xs text-gray-500">{puskesmasName}</p>
          </div>
        </div>
        <SyncStatusBar />
      </div>

      {/* Step Indicator */}
      <div className="bg-white border-b border-gray-100 px-6 py-3">
        <div className="flex items-center gap-4 max-w-2xl mx-auto">
          {[
            { key: 'household', label: 'Data KK', num: 1 },
            { key: 'members', label: 'Anggota Keluarga', num: 2 },
            { key: 'done', label: 'Selesai', num: 3 },
          ].map((s, i, arr) => (
            <div key={s.key} className="flex items-center flex-1">
              <div className="flex items-center gap-2">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                  step === s.key
                    ? 'bg-emerald-600 text-white'
                    : ['done', 'members'].includes(step) && s.num < (step === 'done' ? 4 : step === 'members' ? 2 : 1)
                    ? 'bg-emerald-100 text-emerald-700'
                    : 'bg-gray-100 text-gray-400'
                }`}>
                  {s.num}
                </div>
                <span className={`text-xs font-medium ${step === s.key ? 'text-emerald-700' : 'text-gray-400'}`}>
                  {s.label}
                </span>
              </div>
              {i < arr.length - 1 && (
                <div className="flex-1 h-px bg-gray-200 mx-3" />
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="p-6 max-w-2xl mx-auto">
        {/* Step 1: Data KK */}
        {step === 'household' && (
          <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
            <h2 className="font-semibold text-gray-800 mb-5 flex items-center gap-2">
              🏠 Data Kepala Keluarga
            </h2>
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-5 text-red-700 text-sm flex items-start gap-2">
                <span className="shrink-0">⚠️</span> {error}
              </div>
            )}
            <form onSubmit={handleHouseholdSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Nomor Kartu Keluarga (No KK) <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="16 digit angka"
                  maxLength={16}
                  inputMode="numeric"
                  {...field('no_kk')}
                />
                {fieldErrors.no_kk && (
                  <p className="text-red-500 text-xs mt-1">{fieldErrors.no_kk}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  NIK Kepala Keluarga (Opsional)
                </label>
                <input
                  type="text"
                  placeholder="16 digit NIK Kepala Keluarga"
                  maxLength={16}
                  inputMode="numeric"
                  value={form.nik_kk}
                  onChange={e => {
                    const val = e.target.value.replace(/\D/g, '')
                    setForm(prev => ({ ...prev, nik_kk: val }))
                    if (val.length === 16) {
                      const { validateNIK } = require('@/lib/validators/nik')
                      const result = validateNIK(val)
                      if (!result.valid) {
                        setFieldErrors(prev => ({ ...prev, nik_kk: result.error! }))
                        setNikInfo(null)
                      } else {
                        setFieldErrors(prev => { const n = {...prev}; delete n.nik_kk; return n })
                        setNikInfo(result.info || null)
                      }
                    } else {
                      setFieldErrors(prev => { const n = {...prev}; delete n.nik_kk; return n })
                      setNikInfo(null)
                    }
                  }}
                  className={`w-full border rounded-xl px-4 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-emerald-400 bg-white text-gray-900 ${
                    fieldErrors.nik_kk ? 'border-red-400 bg-red-50' : 
                    nikInfo ? 'border-emerald-400 bg-emerald-50' : 'border-gray-200'
                  }`}
                />
                {fieldErrors.nik_kk && (
                  <p className="text-red-500 text-xs mt-1 flex items-center gap-1">
                    ⚠️ {fieldErrors.nik_kk}
                  </p>
                )}
                {nikInfo && !fieldErrors.nik_kk && form.nik_kk.length === 16 && (
                  <p className="text-emerald-600 text-xs mt-1 flex items-center gap-1">
                    ✅ NIK valid — {nikInfo.jenis_kelamin === 'L' ? 'Laki-laki' : 'Perempuan'}
                    {nikInfo.tgl_lahir && `, lahir ${nikInfo.tgl_lahir.toLocaleDateString('id-ID')}`}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Nama Kepala Keluarga <span className="text-red-500">*</span>
                </label>
                <input type="text" placeholder="Nama lengkap sesuai KK" {...field('nama_kk', true)} />
                {fieldErrors.nama_kk && (
                  <p className="text-red-500 text-xs mt-1">{fieldErrors.nama_kk}</p>
                )}
              </div>

              {isSuperAdmin && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Puskesmas <span className="text-red-500">*</span>
                  </label>
                  <select 
                    value={form.puskesmas_id || ''}
                    onChange={e => setForm(p => ({ ...p, puskesmas_id: e.target.value, desa_id: '' }))}
                    className={`w-full border rounded-xl px-4 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-400 ${
                      fieldErrors.puskesmas_id ? 'border-red-400 bg-red-50' : 'border-gray-200 bg-white'
                    }`}
                  >
                    <option value="">— Pilih Puskesmas —</option>
                    {allPuskesmas.map(p => (
                      <option key={p.id} value={p.id}>{p.nama}</option>
                    ))}
                  </select>
                  {fieldErrors.puskesmas_id && (
                    <p className="text-red-500 text-xs mt-1">{fieldErrors.puskesmas_id}</p>
                  )}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Desa / Kelurahan <span className="text-red-500">*</span>
                </label>
                <select {...field('desa_id')} disabled={isSuperAdmin && !form.puskesmas_id}>
                  <option value="">— Pilih Desa/Kelurahan —</option>
                  {availableDesa.map(d => (
                    <option key={d.id} value={d.id}>{d.desa_kel}</option>
                  ))}
                </select>
                {fieldErrors.desa_id && (
                  <p className="text-red-500 text-xs mt-1">{fieldErrors.desa_id}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Alamat <span className="text-red-500">*</span>
                </label>
                <textarea
                  rows={2}
                  placeholder="Jalan, nomor, gang, dll"
                  value={form.alamat}
                  onChange={e => setForm(p => ({ ...p, alamat: e.target.value.toUpperCase() }))}
                  className={`w-full border rounded-xl px-4 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-400 resize-none ${
                    fieldErrors.alamat ? 'border-red-400 bg-red-50' : 'border-gray-200'
                  }`}
                />
                {fieldErrors.alamat && (
                  <p className="text-red-500 text-xs mt-1">{fieldErrors.alamat}</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    RT <span className="text-red-500">*</span>
                  </label>
                  <input type="text" placeholder="001" maxLength={4} {...field('rt')} />
                  {fieldErrors.rt && (
                    <p className="text-red-500 text-xs mt-1">{fieldErrors.rt}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    RW <span className="text-red-500">*</span>
                  </label>
                  <input type="text" placeholder="001" maxLength={4} {...field('rw')} />
                  {fieldErrors.rw && (
                    <p className="text-red-500 text-xs mt-1">{fieldErrors.rw}</p>
                  )}
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <Link
                  href={backHref}
                  className="flex-1 text-center py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  Batal
                </Link>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-300 text-white font-medium py-2.5 rounded-xl text-sm transition-colors flex items-center justify-center gap-2"
                >
                  {submitting ? (
                    <>
                      <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                      </svg>
                      Menyimpan...
                    </>
                  ) : 'Lanjut → Anggota Keluarga'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Step 2: Anggota Keluarga */}
        {step === 'members' && (
          <AddFamilyMemberForm
            householdId={householdId}
            initialMembers={[{
              nama: form.nama_kk,
              nik: form.nik_kk || '',
              jenis_kelamin: 'L',
              tgl_lahir: '',
              hubungan_kk: 'Kepala Keluarga',
              pendidikan: '',
              pekerjaan: ''
            }]}
            onDone={handleMembersDone}
            onSkip={() => setStep('done')}
          />
        )}

        {/* Step 3: Done */}
        {step === 'done' && (
          <div className="bg-white rounded-2xl border border-gray-100 p-10 shadow-sm text-center">
            <div className="text-6xl mb-4">✅</div>
            <h2 className="text-xl font-bold text-gray-800 mb-2">Data Berhasil Disimpan!</h2>
            <p className="text-gray-500 text-sm mb-6">
              Data rumah tangga dan anggota keluarga telah tersimpan.<br />
              Akan disinkronkan ke server saat online.
            </p>
            <div className="flex flex-col gap-3 items-center">
              <button
                onClick={() => router.push(`${backHref.replace('/households', '/survey')}/new?household_id=${householdId}`)}
                className="w-full max-w-xs bg-blue-600 hover:bg-blue-500 text-white px-5 py-2.5 rounded-xl text-sm font-medium transition-colors"
              >
                📋 Input Survei PHBS
              </button>
              <div className="flex gap-3 w-full max-w-xs">
                <button
                  onClick={() => router.push(`${backHref.replace('/households', '/households/new')}`)}
                  className="flex-1 border border-gray-200 text-gray-600 hover:bg-gray-50 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors"
                >
                  + KK Lagi
                </button>
                <button
                  onClick={() => router.push(backHref)}
                  className="flex-1 border border-emerald-200 text-emerald-700 hover:bg-emerald-50 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors"
                >
                  Daftar KK
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
