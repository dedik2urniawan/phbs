'use client'

import { useState } from 'react'
import { validateNIK } from '@/lib/validators/nik'

export interface FamilyMemberInput {
  nama: string
  nik: string
  jenis_kelamin: 'L' | 'P'
  tgl_lahir: string
  hubungan_kk: string
  pendidikan: string
  pekerjaan: string
}

const emptyMember = (): FamilyMemberInput => ({
  nama: '',
  nik: '',
  jenis_kelamin: 'L',
  tgl_lahir: '',
  hubungan_kk: 'Kepala Keluarga',
  pendidikan: '',
  pekerjaan: '',
})

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
  'PNS/TNI/Polri', 'Karyawan Swasta', 'Wiraswasta/Pedagang',
  'Petani/Peternak', 'Buruh', 'Pensiunan', 'Lainnya',
]

interface Props {
  householdId: string
  initialMembers?: FamilyMemberInput[]
  onDone: (members: FamilyMemberInput[]) => Promise<void>
  onSkip: () => void
}

export default function AddFamilyMemberForm({ householdId, initialMembers, onDone, onSkip }: Props) {
  const [members, setMembers] = useState<FamilyMemberInput[]>(initialMembers || [emptyMember()])
  const [nikErrors, setNikErrors] = useState<Record<number, string>>({})
  const [nikInfos, setNikInfos] = useState<Record<number, { tgl_lahir: Date | null; jenis_kelamin: 'L' | 'P' | null }>>({})
  const [submitting, setSubmitting] = useState(false)

  function updateMember(idx: number, field: keyof FamilyMemberInput, value: string) {
    setMembers(prev => prev.map((m, i) => i === idx ? { ...m, [field]: value } : m))

    // Validate NIK on-the-fly
    if (field === 'nik' && value.length === 16) {
      const result = validateNIK(value)
      if (!result.valid) {
        setNikErrors(prev => ({ ...prev, [idx]: result.error! }))
        setNikInfos(prev => { const n = {...prev}; delete n[idx]; return n })
      } else {
        setNikErrors(prev => { const n = {...prev}; delete n[idx]; return n })
        // Auto-fill jenis kelamin & tgl lahir dari NIK
        if (result.info) {
          setNikInfos(prev => ({ ...prev, [idx]: result.info! }))
          const info = result.info!
          const jk = info.jenis_kelamin
          if (jk) {
            setMembers(prev => prev.map((m, i) => i === idx ? { ...m, jenis_kelamin: jk } : m))
          }
          if (info.tgl_lahir) {
            const d = info.tgl_lahir
            const tgl = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
            setMembers(prev => prev.map((m, i) => i === idx ? { ...m, tgl_lahir: tgl } : m))
          }
        }
      }
    } else if (field === 'nik' && value.length < 16) {
      setNikErrors(prev => { const n = {...prev}; delete n[idx]; return n })
      setNikInfos(prev => { const n = {...prev}; delete n[idx]; return n })
    }
  }

  function addMember() {
    setMembers(prev => [...prev, { ...emptyMember(), hubungan_kk: 'Anak' }])
  }

  function removeMember(idx: number) {
    if (members.length === 1) return
    setMembers(prev => prev.filter((_, i) => i !== idx))
    setNikErrors(prev => { const n = {...prev}; delete n[idx]; return n })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (Object.keys(nikErrors).length > 0) return

    // Validate required fields
    const hasErrors = members.some(m => !m.nama.trim() || !m.tgl_lahir || !m.hubungan_kk)
    if (hasErrors) return

    setSubmitting(true)
    await onDone(members)
    setSubmitting(false)
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
      <div className="flex items-center justify-between mb-5">
        <h2 className="font-semibold text-gray-800 flex items-center gap-2">
          👨‍👩‍👧‍👦 Anggota Keluarga <span className="text-sm font-normal text-gray-400">({members.length} orang)</span>
        </h2>
        <button
          type="button"
          onClick={onSkip}
          className="text-sm text-gray-400 hover:text-gray-600 underline"
        >
          Lewati →
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {members.map((m, idx) => (
          <div key={idx} className="border border-gray-100 rounded-xl p-4 bg-gray-50 relative">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                Anggota #{idx + 1}
              </span>
              {members.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeMember(idx)}
                  className="text-red-400 hover:text-red-600 text-xs"
                >
                  ✕ Hapus
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              {/* Nama */}
              <div className="col-span-2">
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Nama Lengkap <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={m.nama}
                  onChange={e => updateMember(idx, 'nama', e.target.value)}
                  placeholder="Nama sesuai KTP"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-400 bg-white"
                  required
                />
              </div>

              {/* NIK */}
              <div className="col-span-2">
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  NIK (opsional)
                </label>
                <input
                  type="text"
                  value={m.nik}
                  onChange={e => updateMember(idx, 'nik', e.target.value.replace(/\D/g, ''))}
                  placeholder="16 digit NIK"
                  maxLength={16}
                  inputMode="numeric"
                  className={`w-full border rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-400 bg-white font-mono ${
                    nikErrors[idx] ? 'border-red-400 bg-red-50' : 
                    nikInfos[idx] ? 'border-emerald-400 bg-emerald-50' : 'border-gray-200'
                  }`}
                />
                {nikErrors[idx] && (
                  <p className="text-red-500 text-xs mt-1 flex items-center gap-1">
                    ⚠️ {nikErrors[idx]}
                  </p>
                )}
                {nikInfos[idx] && !nikErrors[idx] && m.nik.length === 16 && (
                  <p className="text-emerald-600 text-xs mt-1 flex items-center gap-1">
                    ✅ NIK valid — {nikInfos[idx].jenis_kelamin === 'L' ? 'Laki-laki' : 'Perempuan'}
                    {nikInfos[idx].tgl_lahir && `, lahir ${nikInfos[idx].tgl_lahir!.toLocaleDateString('id-ID')}`}
                  </p>
                )}
              </div>

              {/* Jenis Kelamin */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Jenis Kelamin <span className="text-red-500">*</span>
                </label>
                <div className="flex gap-2">
                  {(['L', 'P'] as const).map(jk => (
                    <button
                      key={jk}
                      type="button"
                      onClick={() => updateMember(idx, 'jenis_kelamin', jk)}
                      className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-all ${
                        m.jenis_kelamin === jk
                          ? 'bg-emerald-600 text-white border-emerald-600'
                          : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      {jk === 'L' ? '♂ Laki-laki' : '♀ Perempuan'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Tanggal Lahir */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Tanggal Lahir <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={m.tgl_lahir}
                  onChange={e => updateMember(idx, 'tgl_lahir', e.target.value)}
                  max={new Date().toISOString().split('T')[0]}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-400 bg-white"
                  required
                />
              </div>

              {/* Hubungan KK */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Hubungan dengan KK <span className="text-red-500">*</span>
                </label>
                <select
                  value={m.hubungan_kk}
                  onChange={e => updateMember(idx, 'hubungan_kk', e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-400 bg-white"
                >
                  {HUBUNGAN_OPTIONS.map(o => <option key={o}>{o}</option>)}
                </select>
              </div>

              {/* Pendidikan */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Pendidikan</label>
                <select
                  value={m.pendidikan}
                  onChange={e => updateMember(idx, 'pendidikan', e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-400 bg-white"
                >
                  {PENDIDIKAN_OPTIONS.map(o => <option key={o} value={o}>{o || '— Pilih —'}</option>)}
                </select>
              </div>

              {/* Pekerjaan */}
              <div className="col-span-2">
                <label className="block text-xs font-medium text-gray-600 mb-1">Pekerjaan</label>
                <select
                  value={m.pekerjaan}
                  onChange={e => updateMember(idx, 'pekerjaan', e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-400 bg-white"
                >
                  {PEKERJAAN_OPTIONS.map(o => <option key={o} value={o}>{o || '— Pilih —'}</option>)}
                </select>
              </div>
            </div>
          </div>
        ))}

        {/* Add Member Button */}
        <button
          type="button"
          onClick={addMember}
          className="w-full border-2 border-dashed border-gray-200 hover:border-emerald-300 text-gray-400 hover:text-emerald-600 py-3 rounded-xl text-sm font-medium transition-all flex items-center justify-center gap-2"
        >
          + Tambah Anggota Keluarga
        </button>

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={submitting || Object.keys(nikErrors).length > 0}
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
            ) : `Simpan ${members.length} Anggota →`}
          </button>
        </div>
      </form>
    </div>
  )
}
