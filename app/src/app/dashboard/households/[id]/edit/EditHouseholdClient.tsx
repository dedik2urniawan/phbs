'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { offlineDB, nowISO } from '@/lib/db/offline'
import { enqueueCompositeSync } from '@/lib/db/sync'
import { validateNoKK } from '@/lib/validators/nik'
import SyncStatusBar from '@/components/SyncStatusBar'

export default function EditHouseholdClient({ household, appUser, desaList, allPuskesmas, basePath }: any) {
  const router = useRouter()
  const supabase = createClient()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const [form, setForm] = useState({
    puskesmas_id: household.puskesmas_id || '',
    no_kk: household.no_kk || '',
    nik_kk: household.nik_kk || '',
    nama_kk: household.nama_kk || '',
    desa_id: household.desa_id || '',
    alamat: household.alamat || '',
    rt: household.rt || '',
    rw: household.rw || '',
  })
  const [nikInfo, setNikInfo] = useState<{ tgl_lahir: Date | null; jenis_kelamin: 'L' | 'P' | null } | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  const isSuperAdmin = appUser.role === 'superadmin'
  const availableDesa = isSuperAdmin 
    ? desaList.filter((d: any) => d.puskesmas_id === form.puskesmas_id)
    : desaList

  function validateForm() {
    const errs: Record<string, string> = {}
    if (isSuperAdmin && !form.puskesmas_id) errs.puskesmas_id = 'Pilih Puskesmas'
    const kkResult = validateNoKK(form.no_kk)
    if (!kkResult.valid) errs.no_kk = kkResult.error!

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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validateForm()) return
    setSubmitting(true)
    setError('')

    const now = nowISO()
    const updateData = {
      puskesmas_id: form.puskesmas_id,
      desa_id: form.desa_id,
      no_kk: form.no_kk.replace(/\s/g, ''),
      nik_kk: form.nik_kk ? form.nik_kk.replace(/\s/g, '') : null,
      nama_kk: form.nama_kk.trim(),
      alamat: form.alamat.trim(),
      rt: form.rt.trim(),
      rw: form.rw.trim(),
      updated_at: now,
    }

    try {
      // Selalu masukkan ke antrean sinkronisasi (Offline-First Single Write Path)
      const exists = await offlineDB.households.get(household.id)
      if (exists) {
        await offlineDB.households.update(household.id, { ...updateData, sync_status: 'pending' })
        await enqueueSync('households', household.id, 'update', updateData)
      } else {
        setError('Data ini belum tersinkronisasi di lokal, tidak dapat diubah.')
        setSubmitting(false)
        return
      }

      // Segera jalankan sinkronisasi jika online
      if (navigator.onLine) {
        import('@/lib/db/sync').then(({ syncToServer }) => syncToServer());
      }

      router.push(`${basePath}/households`)
      router.refresh()
    } catch (err: any) {
      setError(err.message || 'Terjadi kesalahan')
    } finally {
      setSubmitting(false)
    }
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
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href={`${basePath}/households`} className="text-gray-400 hover:text-gray-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <h1 className="text-lg font-bold text-gray-800">Edit Data Rumah Tangga</h1>
        </div>
        <SyncStatusBar />
      </div>

      <div className="p-6 max-w-2xl mx-auto">
        <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-5 text-red-700 text-sm flex items-start gap-2">
              <span className="shrink-0">⚠️</span> {error}
            </div>
          )}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">No KK <span className="text-red-500">*</span></label>
              <input type="text" maxLength={16} inputMode="numeric" {...field('no_kk')} />
              {fieldErrors.no_kk && <p className="text-red-500 text-xs mt-1">{fieldErrors.no_kk}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">NIK Kepala Keluarga (Opsional)</label>
              <input
                type="text"
                placeholder="16 digit NIK"
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
                <p className="text-red-500 text-xs mt-1 flex items-center gap-1">⚠️ {fieldErrors.nik_kk}</p>
              )}
              {nikInfo && !fieldErrors.nik_kk && form.nik_kk.length === 16 && (
                <p className="text-emerald-600 text-xs mt-1 flex items-center gap-1">
                  ✅ NIK valid — {nikInfo.jenis_kelamin === 'L' ? 'Laki-laki' : 'Perempuan'}
                  {nikInfo.tgl_lahir && `, lahir ${nikInfo.tgl_lahir.toLocaleDateString('id-ID')}`}
                </p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Nama Kepala Keluarga <span className="text-red-500">*</span></label>
              <input type="text" {...field('nama_kk', true)} />
              {fieldErrors.nama_kk && <p className="text-red-500 text-xs mt-1">{fieldErrors.nama_kk}</p>}
            </div>
            {isSuperAdmin && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Puskesmas <span className="text-red-500">*</span></label>
                <select 
                  value={form.puskesmas_id}
                  onChange={e => setForm(p => ({ ...p, puskesmas_id: e.target.value, desa_id: '' }))}
                  className={`w-full border rounded-xl px-4 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-400 ${
                    fieldErrors.puskesmas_id ? 'border-red-400 bg-red-50' : 'border-gray-200 bg-white'
                  }`}
                >
                  <option value="">— Pilih Puskesmas —</option>
                  {allPuskesmas.map((p: any) => (
                    <option key={p.id} value={p.id}>{p.nama}</option>
                  ))}
                </select>
                {fieldErrors.puskesmas_id && <p className="text-red-500 text-xs mt-1">{fieldErrors.puskesmas_id}</p>}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Desa / Kelurahan <span className="text-red-500">*</span></label>
              <select 
                value={form.desa_id || ''}
                onChange={e => setForm(p => ({ ...p, desa_id: e.target.value }))}
                className={`w-full border rounded-xl px-4 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-400 ${
                  fieldErrors.desa_id ? 'border-red-400 bg-red-50' : 'border-gray-200 bg-white'
                }`}
              >
                <option value="">— Pilih Desa/Kelurahan —</option>
                {availableDesa.map((d: any) => (
                  <option key={d.id} value={d.id}>{d.desa_kel}</option>
                ))}
              </select>
              {fieldErrors.desa_id && <p className="text-red-500 text-xs mt-1">{fieldErrors.desa_id}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Alamat <span className="text-red-500">*</span></label>
              <textarea rows={2} {...field('alamat', true)} className={`w-full border rounded-xl px-4 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-400 resize-none ${fieldErrors.alamat ? 'border-red-400 bg-red-50' : 'border-gray-200'}`} />
              {fieldErrors.alamat && <p className="text-red-500 text-xs mt-1">{fieldErrors.alamat}</p>}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">RT <span className="text-red-500">*</span></label>
                <input type="text" maxLength={4} {...field('rt')} />
                {fieldErrors.rt && <p className="text-red-500 text-xs mt-1">{fieldErrors.rt}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">RW <span className="text-red-500">*</span></label>
                <input type="text" maxLength={4} {...field('rw')} />
                {fieldErrors.rw && <p className="text-red-500 text-xs mt-1">{fieldErrors.rw}</p>}
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <Link href={`${basePath}/households`} className="flex-1 text-center py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50 transition-colors">Batal</Link>
              <button type="submit" disabled={submitting} className="flex-1 bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-300 text-white font-medium py-2.5 rounded-xl text-sm transition-colors">
                {submitting ? 'Menyimpan...' : 'Simpan Perubahan'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
