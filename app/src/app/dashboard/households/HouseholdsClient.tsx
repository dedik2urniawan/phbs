'use client'

import { useState, useCallback } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import SyncStatusBar from '@/components/SyncStatusBar'

interface Household {
  id: string; no_kk: string; nama_kk: string; alamat: string; rt: string; rw: string
  created_at: string
  ref_desa: { desa_kel: string } | null
  ref_puskesmas: { nama: string } | null
}
interface Desa { id: string; desa_kel: string; puskesmas_id: string }
interface Puskesmas { id: string; nama: string; kecamatan: string }
interface AppUser {
  id: string; email: string; role: string; puskesmas_id: string
  ref_puskesmas: { id: string; nama: string; kecamatan: string } | null
}

interface Props {
  appUser: AppUser
  isSuperAdmin: boolean
  allPuskesmas: Puskesmas[]
  initialDesaList: Desa[]
  initialHouseholds: Household[]
  totalCount: number
  basePath?: string
}

export default function HouseholdsClient({
  appUser, isSuperAdmin, allPuskesmas, initialDesaList, initialHouseholds, totalCount, basePath = '/dashboard'
}: Props) {
  const supabase = createClient()
  const [search, setSearch]             = useState('')
  const [filterDesa, setFilterDesa]     = useState('')
  const [selectedPkm, setSelectedPkm]   = useState('')
  const [desaList, setDesaList]         = useState<Desa[]>(initialDesaList)
  const [households, setHouseholds]     = useState<Household[]>(initialHouseholds)
  const [total, setTotal]               = useState(totalCount)
  const [loading, setLoading]           = useState(false)
  const puskesmasName = appUser?.ref_puskesmas?.nama || 'Dinkes Kab. Malang'

  // Superadmin: saat pilih puskesmas → load desa + filter households
  const handlePkmChange = useCallback(async (pkmId: string) => {
    setSelectedPkm(pkmId)
    setFilterDesa('')
    setLoading(true)

    if (pkmId) {
      // Load desa for selected puskesmas
      const { data: desa } = await supabase
        .from('ref_desa')
        .select('id, desa_kel, puskesmas_id')
        .eq('puskesmas_id', pkmId)
        .order('desa_kel')
      setDesaList(desa || [])

      // Load households for selected puskesmas
      const { data: hh, count } = await supabase
        .from('households')
        .select('*, ref_desa(desa_kel), ref_puskesmas(nama)', { count: 'exact' })
        .eq('puskesmas_id', pkmId)
        .order('created_at', { ascending: false })
        .limit(20)
      setHouseholds(hh || [])
      setTotal(count || 0)
    } else {
      // Reset — show all
      setDesaList([])
      const { data: hh, count } = await supabase
        .from('households')
        .select('*, ref_desa(desa_kel), ref_puskesmas(nama)', { count: 'exact' })
        .order('created_at', { ascending: false })
        .limit(50)
      setHouseholds(hh || [])
      setTotal(count || 0)
    }
    setLoading(false)
  }, [supabase])

  const handleDelete = async (id: string) => {
    if (!confirm('Apakah Anda yakin ingin menghapus data KK ini? Data survei yang terkait juga mungkin akan terhapus.')) return;
    
    const { error } = await supabase.from('households').delete().eq('id', id);
    if (!error) {
      setHouseholds(prev => prev.filter(h => h.id !== id));
      setTotal(prev => prev - 1);
    } else {
      alert('Gagal menghapus data KK: ' + error.message);
    }
  }

  const filtered = households.filter(h => {
    const matchSearch = !search ||
      h.nama_kk.toLowerCase().includes(search.toLowerCase()) ||
      h.no_kk.includes(search)
    const matchDesa = !filterDesa || h.ref_desa?.desa_kel === filterDesa
    return matchSearch && matchDesa
  })

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top Navigation */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href={basePath} className="text-gray-400 hover:text-gray-600 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/>
            </svg>
          </Link>
          <div>
            <h1 className="text-lg font-bold text-gray-800">Data Rumah Tangga</h1>
            <p className="text-xs text-gray-500">
              {isSuperAdmin
                ? selectedPkm
                  ? allPuskesmas.find(p => p.id === selectedPkm)?.nama || 'Semua Puskesmas'
                  : 'Semua Puskesmas'
                : puskesmasName}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <SyncStatusBar />
          <Link
            href={`${basePath}/households/new${isSuperAdmin && selectedPkm ? `?pkm=${selectedPkm}` : ''}`}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium px-4 py-2 rounded-xl transition-colors shadow-sm"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/>
            </svg>
            Tambah KK
          </Link>
        </div>
      </div>

      <div className="p-6 max-w-5xl mx-auto">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          {[
            { label: 'Total KK', value: total.toLocaleString('id'), color: 'text-emerald-600' },
            { label: 'Desa Tersedia', value: desaList.length || (isSuperAdmin ? '-' : initialDesaList.length), color: 'text-blue-600' },
            { label: 'Ditampilkan', value: filtered.length, color: 'text-gray-600' },
          ].map(s => (
            <div key={s.label} className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Filter Row */}
        <div className="flex flex-wrap gap-3 mb-5">
          <div className="flex-1 min-w-48 relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
            </svg>
            <input
              type="text"
              placeholder="Cari nama KK atau No KK..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 bg-white"
            />
          </div>

          {/* Superadmin: Puskesmas picker */}
          {isSuperAdmin && (
            <select
              value={selectedPkm}
              onChange={e => handlePkmChange(e.target.value)}
              className="border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 bg-white min-w-48"
            >
              <option value="">🏥 Semua Puskesmas</option>
              {allPuskesmas.map(p => (
                <option key={p.id} value={p.id}>{p.nama}</option>
              ))}
            </select>
          )}

          {/* Desa filter — muncul jika ada desaList */}
          {desaList.length > 0 && (
            <select
              value={filterDesa}
              onChange={e => setFilterDesa(e.target.value)}
              className="border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 bg-white min-w-40"
            >
              <option value="">Semua Desa/Kel</option>
              {desaList.map(d => (
                <option key={d.id} value={d.desa_kel}>{d.desa_kel}</option>
              ))}
            </select>
          )}
        </div>

        {/* Content */}
        {loading ? (
          <div className="text-center py-16">
            <svg className="animate-spin h-8 w-8 text-emerald-500 mx-auto mb-3" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
            </svg>
            <p className="text-gray-400 text-sm">Memuat data...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
            <div className="text-5xl mb-4">🏠</div>
            <h3 className="text-gray-700 font-semibold mb-2">
              {isSuperAdmin && !selectedPkm ? 'Pilih Puskesmas untuk melihat data' : 'Belum ada data rumah tangga'}
            </h3>
            <p className="text-gray-400 text-sm mb-6">
              {isSuperAdmin && !selectedPkm
                ? 'Gunakan filter Puskesmas di atas untuk mulai'
                : 'Mulai tambahkan data KK untuk wilayah ini'}
            </p>
            {(selectedPkm || !isSuperAdmin) && (
              <Link
                href={`${basePath}/households/new${isSuperAdmin && selectedPkm ? `?pkm=${selectedPkm}` : ''}`}
                className="inline-flex items-center gap-2 bg-emerald-600 text-white px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-emerald-500 transition-colors"
              >
                + Tambah KK Pertama
              </Link>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(h => (
              <div key={h.id} className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm hover:shadow-md hover:border-emerald-200 transition-all">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-mono font-medium">{h.no_kk}</span>
                      {h.ref_desa && <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">{h.ref_desa.desa_kel}</span>}
                      {isSuperAdmin && h.ref_puskesmas && (
                        <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">{h.ref_puskesmas.nama}</span>
                      )}
                    </div>
                    <h3 className="font-semibold text-gray-800 text-sm">{h.nama_kk}</h3>
                    <p className="text-gray-400 text-xs mt-0.5">{h.alamat} RT {h.rt}/RW {h.rw}</p>
                  </div>
                  <div className="flex items-center gap-2 ml-4 shrink-0">
                    <Link href={`${basePath}/survey/new?household_id=${h.id}`}
                      className="text-xs bg-blue-50 text-blue-600 hover:bg-blue-100 px-3 py-1.5 rounded-lg font-medium transition-colors">
                      Input Survei
                    </Link>
                    <Link href={`${basePath}/households/${h.id}`}
                      className="text-xs bg-gray-50 text-gray-600 hover:bg-gray-100 px-3 py-1.5 rounded-lg font-medium transition-colors">
                      Detail
                    </Link>
                    <Link href={`${basePath}/households/${h.id}/edit`}
                      className="text-xs bg-amber-50 text-amber-600 hover:bg-amber-100 px-3 py-1.5 rounded-lg font-medium transition-colors">
                      Edit
                    </Link>
                    <button onClick={() => handleDelete(h.id)}
                      className="text-xs bg-red-50 text-red-600 hover:bg-red-100 px-3 py-1.5 rounded-lg font-medium transition-colors">
                      Delete
                    </button>
                  </div>
                </div>
                <p className="text-gray-300 text-xs mt-2">
                  {new Date(h.created_at).toLocaleDateString('id-ID', { dateStyle: 'medium' })}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
