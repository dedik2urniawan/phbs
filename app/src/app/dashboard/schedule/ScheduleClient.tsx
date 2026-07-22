'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Check, X, ShieldAlert, Power, PowerOff } from 'lucide-react'

type Puskesmas = {
  id: string
  nama: string
  kecamatan: string
  is_active: boolean
}

export default function ScheduleClient({ initialData }: { initialData: Puskesmas[] }) {
  const [puskesmasList, setPuskesmasList] = useState<Puskesmas[]>(initialData)
  const [isUpdating, setIsUpdating] = useState<string | null>(null)
  const [bulkUpdating, setBulkUpdating] = useState(false)
  const supabase = createClient()

  // Sembunyikan Dinkes dari daftar toggle
  const filteredList = puskesmasList.filter(p => p.nama !== 'DINKES')

  const toggleStatus = async (id: string, currentStatus: boolean) => {
    setIsUpdating(id)
    const newStatus = !currentStatus
    const { data, error } = await supabase
      .from('ref_puskesmas')
      .update({ is_active: newStatus })
      .eq('id', id)
      .select('id, is_active')

    if (!error && data && data.length > 0) {
      setPuskesmasList(prev => prev.map(p => p.id === id ? { ...p, is_active: newStatus } : p))
    } else {
      const msg = error ? error.message : 'Perubahan ditolak oleh database (0 rows updated). Pastikan skrip SQL 024 sudah dieksekusi!'
      alert('Gagal mengupdate status: ' + msg)
    }
    setIsUpdating(null)
  }

  const setAllStatus = async (status: boolean) => {
    if (!confirm(`Apakah Anda yakin ingin ${status ? 'MENGAKTIFKAN' : 'MENONAKTIFKAN'} jadwal semua Puskesmas secara serentak?`)) return
    
    setBulkUpdating(true)
    const { data, error } = await supabase
      .from('ref_puskesmas')
      .update({ is_active: status })
      .neq('nama', 'DINKES')
      .select('id, is_active')

    if (!error && data && data.length > 0) {
      setPuskesmasList(prev => prev.map(p => p.nama !== 'DINKES' ? { ...p, is_active: status } : p))
    } else {
      const msg = error ? error.message : 'Perubahan massal ditolak oleh database. Pastikan skrip SQL 024 sudah dieksekusi!'
      alert('Gagal mengupdate massal: ' + msg)
    }
    setBulkUpdating(false)
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-20">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-gray-800">Manajemen Jadwal Survei</h1>
            <p className="text-sm text-gray-500 mt-1">
              Atur hak akses login Kader dan Admin berdasarkan wilayah Puskesmas. Puskesmas yang dinonaktifkan tidak akan bisa masuk ke dalam sistem.
            </p>
          </div>
          
          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={() => setAllStatus(true)}
              disabled={bulkUpdating}
              className="px-4 py-2 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 font-semibold rounded-xl text-sm transition flex items-center gap-2"
            >
              <Power size={16} /> Buka Semua
            </button>
            <button
              onClick={() => setAllStatus(false)}
              disabled={bulkUpdating}
              className="px-4 py-2 bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 font-semibold rounded-xl text-sm transition flex items-center gap-2"
            >
              <PowerOff size={16} /> Tutup Semua
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50/50 border-b border-gray-100">
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">No</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Puskesmas</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status Jadwal</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">Aksi (Toggle)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredList.map((p, index) => (
                <tr key={p.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-6 py-4 text-sm text-gray-500">{index + 1}</td>
                  <td className="px-6 py-4">
                    <div className="font-semibold text-gray-800">{p.nama}</div>
                    <div className="text-xs text-gray-500 mt-0.5">Kecamatan {p.kecamatan || '-'}</div>
                  </td>
                  <td className="px-6 py-4">
                    {p.is_active ? (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700 border border-emerald-200">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                        Jadwal Aktif
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600 border border-gray-200">
                        <span className="w-1.5 h-1.5 rounded-full bg-gray-400"></span>
                        Ditutup Sementara
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={() => toggleStatus(p.id, p.is_active)}
                      disabled={isUpdating === p.id}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                        p.is_active ? 'bg-emerald-500' : 'bg-gray-300'
                      } ${isUpdating === p.id ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:opacity-90'}`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          p.is_active ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </td>
                </tr>
              ))}
              
              {filteredList.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-gray-500">
                    Tidak ada data Puskesmas.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  )
}
