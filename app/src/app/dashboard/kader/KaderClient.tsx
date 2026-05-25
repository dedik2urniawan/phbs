'use client'

import React, { useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Plus, Save, Trash2, X } from 'lucide-react'

interface Props {
  appUser: any
  refPuskesmas: any[]
  refDesa: any[]
  initialKader: any[]
}

export default function KaderClient({ appUser, refPuskesmas, refDesa, initialKader }: Props) {
  const isSuperAdmin = appUser.role === 'superadmin'
  const supabase = createClient()

  // State
  const [kaderList, setKaderList] = useState<any[]>(initialKader)
  
  // Filter state
  const [filterPuskesmas, setFilterPuskesmas] = useState<string>(isSuperAdmin ? 'all' : String(appUser.puskesmas_id))
  const [filterDesa, setFilterDesa] = useState<string>('all')
  const [search, setSearch] = useState('')

  // Form state
  const [showForm, setShowForm] = useState(false)
  const [formPuskesmas, setFormPuskesmas] = useState<string>(isSuperAdmin ? '' : String(appUser.puskesmas_id))
  const [formDesa, setFormDesa] = useState<string>('')
  const [kaderNames, setKaderNames] = useState<string[]>([''])
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState<{type: 'success' | 'error', text: string} | null>(null)

  // Computed
  const filterAvailableDesa = useMemo(() => {
    if (filterPuskesmas === 'all') return refDesa
    return refDesa.filter(d => String(d.puskesmas_id) === String(filterPuskesmas))
  }, [filterPuskesmas, refDesa])

  const formAvailableDesa = useMemo(() => {
    if (!formPuskesmas) return []
    return refDesa.filter(d => String(d.puskesmas_id) === String(formPuskesmas))
  }, [formPuskesmas, refDesa])

  const filteredKader = useMemo(() => {
    return kaderList.filter(k => {
      if (filterPuskesmas !== 'all' && String(k.puskesmas_id) !== filterPuskesmas) return false
      if (filterDesa !== 'all' && String(k.desa_id) !== filterDesa) return false
      if (search && !k.nama_kader.toLowerCase().includes(search.toLowerCase())) return false
      return true
    })
  }, [kaderList, filterPuskesmas, filterDesa, search])

  // Actions
  const handleAddRow = () => setKaderNames(prev => [...prev, ''])
  
  const handleRemoveRow = (index: number) => {
    setKaderNames(prev => prev.filter((_, i) => i !== index))
  }

  const handleNameChange = (index: number, value: string) => {
    setKaderNames(prev => {
      const newNames = [...prev]
      newNames[index] = value
      return newNames
    })
  }

  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault()
    const validNames = kaderNames.map(n => n.trim()).filter(n => n.length > 0)
    
    if (!formPuskesmas || !formDesa || validNames.length === 0) {
      setMessage({ type: 'error', text: 'Puskesmas, Desa, dan minimal 1 nama kader wajib diisi.' })
      return
    }

    setSubmitting(true)
    setMessage(null)

    const payload = validNames.map(nama => ({
      puskesmas_id: formPuskesmas,
      desa_id: formDesa,
      nama_kader: nama
    }))

    const { data, error } = await supabase
      .from('kader_phbs')
      .insert(payload)
      .select('*, ref_puskesmas(nama), ref_desa(desa_kel)')

    if (error) {
      setMessage({ type: 'error', text: `Gagal menyimpan: ${error.message}` })
    } else if (data) {
      setMessage({ type: 'success', text: `${data.length} Kader berhasil ditambahkan.` })
      setKaderList(prev => [...data, ...prev])
      setKaderNames([''])
      // Don't close form so they can add more if they want, but reset names
    }
    setSubmitting(false)
  }

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Hapus kader "${name}"?`)) return
    const { error } = await supabase.from('kader_phbs').delete().eq('id', id)
    if (!error) {
      setKaderList(prev => prev.filter(k => k.id !== id))
    } else {
      alert('Gagal menghapus: ' + error.message)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header Actions */}
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div className="flex flex-wrap gap-3">
          {isSuperAdmin && (
            <select 
              value={filterPuskesmas}
              onChange={e => { setFilterPuskesmas(e.target.value); setFilterDesa('all') }}
              className="border border-gray-200 rounded-xl px-4 py-2.5 text-sm bg-white min-w-[200px]"
            >
              <option value="all">Semua Puskesmas</option>
              {refPuskesmas.map(p => <option key={p.id} value={p.id}>{p.nama}</option>)}
            </select>
          )}
          <select 
            value={filterDesa}
            onChange={e => setFilterDesa(e.target.value)}
            className="border border-gray-200 rounded-xl px-4 py-2.5 text-sm bg-white min-w-[200px]"
          >
            <option value="all">Semua Desa/Kelurahan</option>
            {filterAvailableDesa.map(d => <option key={d.id} value={d.id}>{d.desa_kel}</option>)}
          </select>
          <input
            type="text"
            placeholder="Cari nama kader..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="border border-gray-200 rounded-xl px-4 py-2.5 text-sm bg-white w-full sm:w-64 text-gray-900 placeholder:text-gray-400"
          />
        </div>
        <button 
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-xl font-medium text-sm transition-colors"
        >
          {showForm ? <X size={18} /> : <Plus size={18} />}
          {showForm ? 'Tutup Form' : 'Tambah Kader Baru'}
        </button>
      </div>

      {/* Form Tambah Kader */}
      {showForm && (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-emerald-100 animate-in slide-in-from-top-4 duration-300">
          <h3 className="text-lg font-bold text-gray-800 mb-4">Input Data Kader</h3>
          {message && (
            <div className={`p-4 rounded-xl mb-6 text-sm flex items-start gap-3 ${
              message.type === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
            }`}>
              <span className="text-lg mt-0.5">{message.type === 'success' ? '✅' : '⚠️'}</span>
              <p>{message.text}</p>
            </div>
          )}
          <form onSubmit={handleSubmitForm} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {isSuperAdmin && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Puskesmas</label>
                  <select 
                    required
                    value={formPuskesmas}
                    onChange={e => { setFormPuskesmas(e.target.value); setFormDesa('') }}
                    className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm bg-gray-50 text-gray-900 focus:bg-white focus:ring-2 ring-emerald-500"
                  >
                    <option value="">-- Pilih Puskesmas --</option>
                    {refPuskesmas.map(p => <option key={p.id} value={p.id}>{p.nama}</option>)}
                  </select>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Desa/Kelurahan</label>
                <select 
                  required
                  value={formDesa}
                  onChange={e => setFormDesa(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm bg-gray-50 text-gray-900 focus:bg-white focus:ring-2 ring-emerald-500"
                >
                  <option value="">-- Pilih Desa --</option>
                  {formAvailableDesa.map(d => <option key={d.id} value={d.id}>{d.desa_kel}</option>)}
                </select>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-gray-700">Nama Kader (Bisa lebih dari 1)</label>
              </div>
              <div className="space-y-3 bg-gray-50 p-4 rounded-xl border border-gray-100">
                {kaderNames.map((name, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <span className="text-sm font-medium text-gray-400 w-6 text-center">{i + 1}.</span>
                    <input
                      type="text"
                      required
                      placeholder="Masukkan nama lengkap kader..."
                      value={name}
                      onChange={e => handleNameChange(i, e.target.value)}
                      className="flex-1 border border-gray-200 rounded-xl px-4 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:ring-2 ring-emerald-500"
                    />
                    {kaderNames.length > 1 && (
                      <button 
                        type="button" 
                        onClick={() => handleRemoveRow(i)}
                        className="text-red-400 hover:text-red-600 p-2 hover:bg-red-50 rounded-lg transition-colors"
                        title="Hapus baris ini"
                      >
                        <Trash2 size={18} />
                      </button>
                    )}
                  </div>
                ))}
                <button
                  type="button"
                  onClick={handleAddRow}
                  className="flex items-center gap-2 text-sm font-medium text-emerald-600 hover:text-emerald-700 py-2 pl-9"
                >
                  <Plus size={16} /> Tambah Baris Nama
                </button>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
              <button 
                type="button"
                onClick={() => setShowForm(false)}
                className="px-5 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-xl transition-colors"
              >
                Batal
              </button>
              <button 
                type="submit"
                disabled={submitting}
                className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-300 text-white px-6 py-2.5 rounded-xl font-medium text-sm transition-colors"
              >
                <Save size={18} />
                {submitting ? 'Menyimpan...' : 'Simpan Data Kader'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Tabel Kader */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50/50 border-b border-gray-100 text-gray-500">
              <tr>
                <th className="px-6 py-4 font-medium w-16">No</th>
                <th className="px-6 py-4 font-medium">Nama Kader</th>
                <th className="px-6 py-4 font-medium">Desa / Kelurahan</th>
                {isSuperAdmin && <th className="px-6 py-4 font-medium">Puskesmas</th>}
                <th className="px-6 py-4 font-medium w-24 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filteredKader.length === 0 ? (
                <tr>
                  <td colSpan={isSuperAdmin ? 5 : 4} className="px-6 py-12 text-center text-gray-500">
                    Belum ada data kader phbs yang sesuai.
                  </td>
                </tr>
              ) : (
                filteredKader.map((kader, i) => (
                  <tr key={kader.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-4 text-gray-500">{i + 1}</td>
                    <td className="px-6 py-4 font-medium text-gray-900">{kader.nama_kader}</td>
                    <td className="px-6 py-4 text-gray-600">{kader.ref_desa?.desa_kel || '-'}</td>
                    {isSuperAdmin && <td className="px-6 py-4 text-gray-600">{kader.ref_puskesmas?.nama || '-'}</td>}
                    <td className="px-6 py-4 text-center">
                      <button 
                        onClick={() => handleDelete(kader.id, kader.nama_kader)}
                        className="text-red-400 hover:text-red-600 p-2 hover:bg-red-50 rounded-lg transition-colors"
                        title="Hapus"
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
