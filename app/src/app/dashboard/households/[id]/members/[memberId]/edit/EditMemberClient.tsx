'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { offlineDB, nowISO } from '@/lib/db/offline'
import { enqueueCompositeSync } from '@/lib/db/sync'
import { validateNIK } from '@/lib/validators/nik'
import SyncStatusBar from '@/components/SyncStatusBar'

const HUBUNGAN_OPTIONS = [
  'Kepala Keluarga', 'Istri/Suami', 'Anak', 'Orang Tua',
  'Mertua', 'Cucu', 'Menantu', 'Saudara', 'Lainnya',
]

const PENDIDIKAN_OPTIONS = [
  '', 'Tidak Sekolah', 'SD/Sederajat', 'SMP/Sederajat',
  'SMA/Sederajat', 'D1/D2/D3', 'S1/D4', 'S2', 'S3',
]

const PEKERJAAN_OPTIONS = [
  '', 'Belum/Tidak Bekerja', 'Pelajar/Mahasiswa', 'Mengurus RT',
  'Wiraswasta', 'Karyawan Swasta', 'PNS/TNI/POLRI', 'ASN/TNI/POLRI', 
  'Pendidik', 'Petani/Peternak', 'Nelayan', 'Buruh', 'Pensiunan', 'Lainnya',
]

export default function EditMemberClient({ member, householdId, nama_kk, basePath }: any) {
  const router = useRouter()
  const supabase = createClient()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const [form, setForm] = useState({
    nama: member.nama || '',
    nik: member.nik || '',
    jenis_kelamin: member.jenis_kelamin || 'L',
    tgl_lahir: member.tgl_lahir || '',
    hubungan_kk: member.hubungan_kk || 'Anak',
    pendidikan: member.pendidikan || '',
    pekerjaan: member.pekerjaan || '',
  })
  
  const [nikError, setNikError] = useState('')
  const [nikInfo, setNikInfo] = useState<{ tgl_lahir: Date | null; jenis_kelamin: 'L' | 'P' | null } | null>(null)

  function updateField(field: keyof typeof form, value: string) {
    setForm(prev => ({ ...prev, [field]: value }))

    if (field === 'nik' && value.length === 16) {
      const result = validateNIK(value)
      if (!result.valid) {
        setNikError(result.error!)
        setNikInfo(null)
      } else {
        setNikError('')
        if (result.info) {
          setNikInfo(result.info)
          if (result.info.jenis_kelamin) setForm(prev => ({ ...prev, jenis_kelamin: result.info!.jenis_kelamin! }))
          if (result.info.tgl_lahir) {
            const d = result.info.tgl_lahir
            const tgl = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
            setForm(prev => ({ ...prev, tgl_lahir: tgl }))
          }
        }
      }
    } else if (field === 'nik' && value.length < 16) {
      setNikError('')
      setNikInfo(null)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (nikError) return
    if (!form.nama.trim() || !form.tgl_lahir || !form.hubungan_kk) {
      setError('Harap lengkapi semua field yang wajib (Nama, Jenis Kelamin, Tgl Lahir, Hubungan KK)')
      return
    }

    setSubmitting(true)
    setError('')

    const updateData = {
      nama: form.nama.trim(),
      nik: form.nik ? form.nik.replace(/\s/g, '') : null,
      jenis_kelamin: form.jenis_kelamin,
      tgl_lahir: form.tgl_lahir,
      hubungan_kk: form.hubungan_kk,
      pendidikan: form.pendidikan || null,
      pekerjaan: form.pekerjaan || null,
    }

    try {
      if (navigator.onLine) {
        const { error: sbError } = await supabase.from('family_members').update(updateData).eq('id', member.id)
        if (sbError) throw sbError
        // Update local if exists
        const exists = await offlineDB.family_members.get(member.id)
        if (exists) await offlineDB.family_members.update(member.id, updateData)
      } else {
        const exists = await offlineDB.family_members.get(member.id)
        if (exists) {
          await offlineDB.family_members.update(member.id, { ...updateData, sync_status: 'pending' })
          await enqueueCompositeSync({ members: [updateData] })
        } else {
          setError('Anda sedang offline dan data ini belum tersinkronisasi di lokal.')
          setSubmitting(false)
          return
        }
      }

      router.push(`${basePath}/households/${householdId}`)
      router.refresh()
    } catch (err: any) {
      setError(err.message || 'Terjadi kesalahan')
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href={`${basePath}/households/${householdId}`} className="text-gray-400 hover:text-gray-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <h1 className="text-lg font-bold text-gray-800">Edit Anggota Rumah Tangga</h1>
        </div>
        <SyncStatusBar />
      </div>

      <div className="p-6 max-w-2xl mx-auto">
        <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
          <div className="mb-6 pb-4 border-b border-gray-100">
            <p className="text-sm text-gray-500">Keluarga</p>
            <p className="font-semibold text-gray-800 text-lg">{nama_kk}</p>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-5 text-red-700 text-sm flex items-start gap-2">
              <span className="shrink-0">⚠️</span> {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Nama Lengkap <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={form.nama}
                  onChange={e => updateField('nama', e.target.value.toUpperCase())}
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-400"
                  required
                />
              </div>

              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1.5">NIK (Opsional)</label>
                <input
                  type="text"
                  maxLength={16}
                  inputMode="numeric"
                  value={form.nik}
                  onChange={e => updateField('nik', e.target.value.replace(/\D/g, ''))}
                  className={`w-full border rounded-xl px-4 py-2.5 text-sm text-gray-900 font-mono focus:outline-none focus:ring-2 focus:ring-emerald-400 ${
                    nikError ? 'border-red-400 bg-red-50' : 
                    nikInfo ? 'border-emerald-400 bg-emerald-50' : 'border-gray-200'
                  }`}
                />
                {nikError && <p className="text-red-500 text-xs mt-1">⚠️ {nikError}</p>}
                {nikInfo && !nikError && form.nik.length === 16 && (
                  <p className="text-emerald-600 text-xs mt-1 flex items-center gap-1">
                    ✅ NIK valid — {nikInfo.jenis_kelamin === 'L' ? 'Laki-laki' : 'Perempuan'}
                    {nikInfo.tgl_lahir && `, lahir ${nikInfo.tgl_lahir.toLocaleDateString('id-ID')}`}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Jenis Kelamin <span className="text-red-500">*</span></label>
                <div className="flex gap-2">
                  {(['L', 'P'] as const).map(jk => (
                    <button
                      key={jk}
                      type="button"
                      onClick={() => updateField('jenis_kelamin', jk)}
                      className={`flex-1 py-2 rounded-xl text-sm font-medium border transition-all ${
                        form.jenis_kelamin === jk
                          ? 'bg-emerald-600 text-white border-emerald-600'
                          : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      {jk === 'L' ? '♂ Laki-laki' : '♀ Perempuan'}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Tanggal Lahir <span className="text-red-500">*</span></label>
                <input
                  type="date"
                  value={form.tgl_lahir}
                  onChange={e => updateField('tgl_lahir', e.target.value)}
                  max={new Date().toISOString().split('T')[0]}
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-400"
                  required
                />
              </div>

              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Hubungan dengan KK <span className="text-red-500">*</span></label>
                <select
                  value={form.hubungan_kk}
                  onChange={e => updateField('hubungan_kk', e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-400"
                >
                  {HUBUNGAN_OPTIONS.map(o => <option key={o}>{o}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Pendidikan</label>
                <select
                  value={form.pendidikan}
                  onChange={e => updateField('pendidikan', e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-400"
                >
                  {PENDIDIKAN_OPTIONS.map(o => <option key={o} value={o}>{o || '— Pilih —'}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Pekerjaan</label>
                <select
                  value={form.pekerjaan}
                  onChange={e => updateField('pekerjaan', e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-400"
                >
                  {PEKERJAAN_OPTIONS.map(o => <option key={o} value={o}>{o || '— Pilih —'}</option>)}
                </select>
              </div>
            </div>

            <div className="flex gap-3 pt-4">
              <Link href={`${basePath}/households/${householdId}`} className="flex-1 text-center py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50 transition-colors">Batal</Link>
              <button type="submit" disabled={submitting || !!nikError} className="flex-1 bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-300 text-white font-medium py-2.5 rounded-xl text-sm transition-colors">
                {submitting ? 'Menyimpan...' : 'Simpan Perubahan'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
