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
  surveys?: { id: string; kader_phbs?: { nama_kader: string } }[] | null
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
  const [currentPage, setCurrentPage]   = useState(1)
  const itemsPerPage = 10
  const puskesmasName = appUser?.ref_puskesmas?.nama || 'Dinkes Kab. Malang'

  // Superadmin: saat pilih puskesmas → load desa + filter households
  const handlePkmChange = useCallback(async (pkmId: string) => {
    setSelectedPkm(pkmId)
    setFilterDesa('')
    setCurrentPage(1)
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
        .select('*, ref_desa(desa_kel), ref_puskesmas(nama), surveys(id, kader_phbs(nama_kader))', { count: 'exact' })
        .eq('puskesmas_id', pkmId)
        .order('created_at', { ascending: false })
        .limit(1000)
      setHouseholds(hh || [])
      setTotal(count || 0)
    } else {
      // Reset — show all
      setDesaList([])
      const { data: hh, count } = await supabase
        .from('households')
        .select('*, ref_desa(desa_kel), ref_puskesmas(nama), surveys(id, kader_phbs(nama_kader))', { count: 'exact' })
        .order('created_at', { ascending: false })
        .limit(1000)
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

  const totalPages = Math.ceil(filtered.length / itemsPerPage)
  const paginatedHouseholds = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)

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
              onChange={e => {
                setSearch(e.target.value)
                setCurrentPage(1)
              }}
              className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 bg-white text-gray-900 placeholder-gray-400 font-medium"
            />
          </div>

          {/* Superadmin: Puskesmas picker */}
          {isSuperAdmin && (
            <select
              value={selectedPkm}
              onChange={e => handlePkmChange(e.target.value)}
              className="border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 bg-white min-w-48 text-gray-900 font-medium"
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
              onChange={e => {
                setFilterDesa(e.target.value)
                setCurrentPage(1)
              }}
              className="border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 bg-white min-w-40 text-gray-900 font-medium"
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
          <div className="space-y-4">
            <div className="space-y-3">
              {paginatedHouseholds.map(h => (
              <div key={h.id} className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm hover:shadow-md hover:border-emerald-200 transition-all">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-mono font-medium">{h.no_kk}</span>
                      {h.ref_desa && <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">{h.ref_desa.desa_kel}</span>}
                      {isSuperAdmin && h.ref_puskesmas && (
                        <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">{h.ref_puskesmas.nama}</span>
                      )}
                      {h.surveys && h.surveys.length > 0 ? (
                        <div className="flex items-center gap-1.5 ml-1">
                          <span className="text-[10px] bg-emerald-500 text-white px-2 py-0.5 rounded-full font-medium shadow-sm flex items-center gap-1">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7"/></svg>
                            Disurvei
                          </span>
                          {h.surveys[0].kader_phbs?.nama_kader && (
                            <span className="text-[10px] text-gray-500 flex items-center gap-1 bg-gray-100 px-2 py-0.5 rounded-full">
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>
                              {h.surveys[0].kader_phbs.nama_kader}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium ml-1 flex items-center gap-1 border border-amber-200">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                          Belum Disurvei
                        </span>
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
                <p className="text-gray-400 text-xs mt-2">
                  {new Date(h.created_at).toLocaleDateString('id-ID', { dateStyle: 'medium' })}
                </p>
              </div>
            ))}
            </div>

            {totalPages > 0 && (
              <div className="flex flex-col sm:flex-row justify-between items-center mt-6 bg-white p-4 rounded-xl border border-gray-100 shadow-sm gap-4">
                <p className="text-sm text-gray-500">
                  Menampilkan <span className="font-semibold text-gray-900">{(currentPage - 1) * itemsPerPage + 1}</span> hingga <span className="font-semibold text-gray-900">{Math.min(currentPage * itemsPerPage, filtered.length)}</span> dari <span className="font-semibold text-gray-900">{filtered.length}</span> data
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Sebelumnya
                  </button>
                  <div className="hidden sm:flex items-center gap-1">
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      let pageNum = currentPage;
                      if (totalPages <= 5) pageNum = i + 1;
                      else if (currentPage <= 3) pageNum = i + 1;
                      else if (currentPage >= totalPages - 2) pageNum = totalPages - 4 + i;
                      else pageNum = currentPage - 2 + i;
                      
                      if (pageNum < 1 || pageNum > totalPages) return null;
                      
                      return (
                        <button
                          key={pageNum}
                          onClick={() => setCurrentPage(pageNum)}
                          className={`w-10 h-10 rounded-lg text-sm font-medium transition-all ${
                            currentPage === pageNum 
                              ? 'bg-emerald-600 text-white shadow-md' 
                              : 'text-gray-700 hover:bg-emerald-50 border border-transparent'
                          }`}
                        >
                          {pageNum}
                        </button>
                      )
                    })}
                  </div>
                  <button
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Selanjutnya
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
