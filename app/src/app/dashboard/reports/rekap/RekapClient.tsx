'use client'

import React, { useState, useMemo, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { AppUser } from '@/lib/types'

interface Props {
  appUser: AppUser
  surveysData: any[]
  puskesmasList: any[]
  desaList: any[]
  selectedTahun?: number
  availableYears?: number[]
}

export default function RekapClient({ appUser, surveysData, puskesmasList, desaList, selectedTahun, availableYears = [] }: Props) {
  const router = useRouter()
  const isSuperAdmin = appUser.role === 'superadmin'
  const [selectedPuskesmas, setSelectedPuskesmas] = useState<string>(
    isSuperAdmin ? 'all' : String(appUser.puskesmas_id)
  )
  const [selectedDesa, setSelectedDesa] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({})
  const itemsPerPage = 50

  const filteredDesa = useMemo(() => {
    if (selectedPuskesmas === 'all') return desaList
    return desaList.filter(d => String(d.puskesmas_id) === String(selectedPuskesmas))
  }, [desaList, selectedPuskesmas])

  const filteredSurveys = useMemo(() => {
    return surveysData.filter(s => {
      const pId = String(s.households?.puskesmas_id)
      const dId = String(s.households?.desa_id)
      
      if (selectedPuskesmas !== 'all' && pId !== selectedPuskesmas) return false
      if (selectedDesa !== 'all' && dId !== selectedDesa) return false
      
      if (searchQuery) {
        const query = searchQuery.toLowerCase()
        const noKk = s.households?.no_kk?.toLowerCase() || ''
        const namaKk = s.households?.nama_kk?.toLowerCase() || ''
        const nikArtMatch = s.survey_art_responses?.some((art: any) => 
            art.family_members?.nik?.toLowerCase().includes(query) ||
            art.family_members?.nama?.toLowerCase().includes(query)
        )
        if (!noKk.includes(query) && !namaKk.includes(query) && !nikArtMatch) return false
      }
      return true
    })
  }, [surveysData, selectedPuskesmas, selectedDesa, searchQuery])

  useEffect(() => {
    setCurrentPage(1)
  }, [selectedPuskesmas, selectedDesa, searchQuery, selectedTahun])

  const paginatedSurveys = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage
    return filteredSurveys.slice(start, start + itemsPerPage)
  }, [filteredSurveys, currentPage])
  
  const totalPages = Math.ceil(filteredSurveys.length / itemsPerPage)

  const toggleRow = (id: string) => {
    setExpandedRows(prev => ({ ...prev, [id]: !prev[id] }))
  }

  // Aggregate by Desa
  const rekapList = useMemo(() => {
    const rekap: Record<string, any> = {}
    filteredSurveys.forEach((s: any) => {
      const desaId = s.households?.desa_id || 'unknown'
      const desaName = s.households?.ref_desa?.desa_kel || 'Unknown Desa'
      
      if (!rekap[desaId]) {
        rekap[desaId] = {
          desaName,
          total_kk: 0,
          total_sehat: 0,
          total_tidak_sehat: 0,
        }
      }
      
      rekap[desaId].total_kk++
      if (s.is_rt_sehat) {
        rekap[desaId].total_sehat++
      } else {
        rekap[desaId].total_tidak_sehat++
      }
    })
    return Object.values(rekap).sort((a, b) => a.desaName.localeCompare(b.desaName))
  }, [filteredSurveys])

  const formatBool = (val: boolean | null | undefined) => {
    if (val === null || val === undefined) {
      return <span className="text-gray-300 font-bold">-</span>
    }
    if (val) {
      return <span className="inline-flex items-center justify-center w-6 h-6 bg-emerald-100/60 text-emerald-700 rounded font-bold text-xs shadow-sm">1</span>
    }
    return <span className="inline-flex items-center justify-center w-6 h-6 bg-red-100/60 text-red-600 rounded font-bold text-xs shadow-sm">0</span>
  }

  const totalKKFiltered = filteredSurveys.length
  const totalSehatFiltered = filteredSurveys.filter(s => s.is_rt_sehat).length
  const percentSehat = totalKKFiltered > 0 ? Math.round((totalSehatFiltered / totalKKFiltered) * 100) : 0

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col md:flex-row gap-4">
        {isSuperAdmin && (
          <div className="flex-1">
            <label className="block text-xs font-semibold text-gray-500 mb-1">Puskesmas</label>
            <select
              value={selectedPuskesmas}
              onChange={(e) => {
                setSelectedPuskesmas(e.target.value)
                setSelectedDesa('all') // Reset desa on pkm change
              }}
              className="w-full bg-gray-50 border border-gray-200 text-gray-800 text-sm rounded-lg focus:ring-emerald-500 focus:border-emerald-500 block p-2.5 transition-colors"
            >
              <option value="all">Semua Puskesmas</option>
              {puskesmasList.map(p => (
                <option key={p.id} value={p.id}>{p.nama}</option>
              ))}
            </select>
          </div>
        )}
        
        <div className="flex-1">
          <label className="block text-xs font-semibold text-gray-500 mb-1">Desa / Kelurahan</label>
          <select
            value={selectedDesa}
            onChange={(e) => setSelectedDesa(e.target.value)}
            className="w-full bg-gray-50 border border-gray-200 text-gray-800 text-sm rounded-lg focus:ring-emerald-500 focus:border-emerald-500 block p-2.5 transition-colors"
          >
            <option value="all">Semua Desa</option>
            {filteredDesa.map(d => (
              <option key={d.id} value={d.id}>{d.desa_kel}</option>
            ))}
          </select>
        </div>
        
        {availableYears && availableYears.length > 0 && (
          <div className="flex-1">
            <label className="block text-xs font-semibold text-gray-500 mb-1">Tahun</label>
            <select
              value={selectedTahun || ''}
              onChange={(e) => router.push(`?tahun=${e.target.value}`)}
              className="w-full bg-gray-50 border border-gray-200 text-gray-800 text-sm rounded-lg focus:ring-emerald-500 focus:border-emerald-500 block p-2.5 transition-colors"
            >
              {availableYears.map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
        )}

        <div className="flex-1 md:flex-[1.5]">
          <label className="block text-xs font-semibold text-gray-500 mb-1">Cari KK / NIK / Nama</label>
          <input 
            type="text" 
            placeholder="Ketik NIK, No KK, atau Nama..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-gray-50 border border-gray-200 text-gray-800 text-sm rounded-lg focus:ring-emerald-500 focus:border-emerald-500 block p-2.5 transition-colors"
          />
        </div>
      </div>

      {/* Detail Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-4 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white">
          <h3 className="font-bold text-gray-800 flex items-center gap-2">
            <span className="w-1.5 h-4 bg-emerald-500 rounded-full"></span>
            Detail Rekapitulasi per Rumah Tangga
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-gray-50/80 text-gray-500 text-xs text-center border-b border-gray-200 uppercase tracking-wider">
                <th className="px-4 py-3 font-bold text-left">No</th>
                <th className="px-4 py-3 font-bold text-left min-w-[150px]">Nama KK</th>
                <th className="px-2 py-3 font-bold" title="Persalinan Nakes">Persalinan</th>
                <th className="px-2 py-3 font-bold" title="ASI Eksklusif">ASI</th>
                <th className="px-2 py-3 font-bold" title="Menimbang Balita">Timbang</th>
                <th className="px-2 py-3 font-bold" title="Air Bersih">Air</th>
                <th className="px-2 py-3 font-bold" title="Cuci Tangan Pakai Sabun">CTPS</th>
                <th className="px-2 py-3 font-bold" title="Jamban Sehat">Jamban</th>
                <th className="px-2 py-3 font-bold" title="Pemberantasan Sarang Nyamuk">PSN</th>
                <th className="px-2 py-3 font-bold" title="Makan Sayur Buah">Sayur</th>
                <th className="px-2 py-3 font-bold" title="Aktivitas Fisik">Aktifitas</th>
                <th className="px-2 py-3 font-bold" title="Tidak Merokok">Tdk Rokok</th>
                <th className="px-4 py-3 font-bold">Skor</th>
                <th className="px-4 py-3 font-bold">Klasifikasi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {paginatedSurveys.length > 0 ? (
                paginatedSurveys.map((s, idx) => (
                  <React.Fragment key={s.id}>
                    <tr className="hover:bg-blue-50/40 transition-colors text-center">
                      <td className="px-4 py-4 text-left text-gray-400 text-xs font-semibold">{(currentPage - 1) * itemsPerPage + idx + 1}</td>
                      <td className="px-4 py-4 text-left font-semibold text-gray-800">
                        <div className="flex flex-col">
                          <span className="whitespace-nowrap">{s.households?.nama_kk || 'Tidak Diketahui'}</span>
                          <span className="text-xs text-gray-400 font-normal">No KK: {s.households?.no_kk || '-'}</span>
                          <button 
                            onClick={() => toggleRow(s.id)}
                            className="text-xs text-blue-600 font-medium hover:text-blue-800 mt-1 flex items-center gap-1 w-fit"
                          >
                            {expandedRows[s.id] ? '▼ Sembunyikan ART' : '▶ Lihat Detail ART'}
                          </button>
                        </div>
                      </td>
                      <td className="px-2 py-4">{formatBool(s.i1_persalinan_nakes)}</td>
                      <td className="px-2 py-4">{formatBool(s.i2_asi_eksklusif)}</td>
                      <td className="px-2 py-4">{formatBool(s.i3_menimbang_balita)}</td>
                      <td className="px-2 py-4">{formatBool(s.i4_air_bersih)}</td>
                      <td className="px-2 py-4">{formatBool(s.i5_cuci_tangan)}</td>
                      <td className="px-2 py-4">{formatBool(s.i6_jamban_sehat)}</td>
                      <td className="px-2 py-4">{formatBool(s.i7_psn)}</td>
                      <td className="px-2 py-4">{formatBool(s.i8_makan_sayur_buah)}</td>
                      <td className="px-2 py-4">{formatBool(s.i9_aktivitas_fisik)}</td>
                      <td className="px-2 py-4">{formatBool(s.i10_tidak_merokok)}</td>
                      <td className="px-4 py-4">
                        <div className="flex items-center justify-center">
                          <span className="bg-blue-50 text-blue-700 px-2 py-1 rounded text-xs font-bold border border-blue-100/50">
                            {s.skor_phbs} <span className="text-blue-300 font-normal">/</span> {s.denominator_phbs}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center justify-center">
                          <span className={`px-2.5 py-1 rounded-full text-xs font-bold shadow-sm ${
                            s.is_rt_sehat ? 'bg-emerald-500 text-white shadow-emerald-500/20' : 'bg-red-500 text-white shadow-red-500/20'
                          }`}>
                            {s.kategori_phbs === 'Sehat' ? 'Sehat' : 'Tidak S'}
                          </span>
                        </div>
                      </td>
                    </tr>
                    
                    {/* Expanded ART Rows */}
                    {expandedRows[s.id] && s.survey_art_responses && s.survey_art_responses.length > 0 && (
                      <tr className="bg-gray-50/50">
                        <td colSpan={14} className="px-8 py-4">
                          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                            <table className="w-full text-xs text-left">
                              <thead className="bg-gray-100/80 text-gray-600">
                                <tr>
                                  <th className="px-4 py-2">Nama ART</th>
                                  <th className="px-4 py-2">NIK / Hub. KK</th>
                                  <th className="px-2 py-2 text-center" title="Cuci Tangan">CTPS</th>
                                  <th className="px-2 py-2 text-center" title="Makan Sayur Buah">Sayur</th>
                                  <th className="px-2 py-2 text-center" title="Aktivitas Fisik">Aktifitas</th>
                                  <th className="px-2 py-2 text-center" title="Tidak Merokok">Tdk Merokok</th>
                                  <th className="px-2 py-2 text-center" title="Cek Kesehatan">Cek Kes.</th>
                                  <th className="px-2 py-2 text-center" title="Posyandu">Posyandu</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-100">
                                {s.survey_art_responses.map((art: any) => (
                                  <tr key={art.id} className="hover:bg-gray-50">
                                    <td className="px-4 py-2 font-medium">{art.family_members?.nama || '-'}</td>
                                    <td className="px-4 py-2 text-gray-500">{art.family_members?.nik || '-'}<br/><span className="text-[10px] text-gray-400">{art.family_members?.hubungan_kk || ''}</span></td>
                                    <td className="px-2 py-2 text-center">{formatBool(art.i5_cuci_tangan)}</td>
                                    <td className="px-2 py-2 text-center">{formatBool(art.i8_makan_sayur_buah)}</td>
                                    <td className="px-2 py-2 text-center">{formatBool(art.i9_aktivitas_fisik)}</td>
                                    <td className="px-2 py-2 text-center">{formatBool(art.i10_tidak_merokok)}</td>
                                    <td className="px-2 py-2 text-center">{formatBool(art.g_cek_kesehatan)}</td>
                                    <td className="px-2 py-2 text-center">{formatBool(art.g_posyandu_hadir)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))
              ) : (
                <tr>
                  <td colSpan={14} className="px-6 py-12 text-center text-gray-400 font-medium">Belum ada data survei yang cocok dengan filter.</td>
                </tr>
              )}
            </tbody>
            {filteredSurveys.length > 0 && (
              <tfoot className="bg-gradient-to-r from-gray-50 to-gray-100 font-bold text-gray-800 text-center border-t-2 border-gray-200">
                <tr>
                  <td colSpan={2} className="px-4 py-4 text-right">Jumlah / Persen:</td>
                  <td colSpan={10} className="px-4 py-4 text-emerald-700">
                    {totalSehatFiltered} Sehat dari {totalKKFiltered} Applicable <span className="bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded ml-1">({percentSehat}%)</span>
                  </td>
                  <td colSpan={2}></td>
                </tr>
              </tfoot>
            )}
          </table>
          
          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 bg-gray-50/50">
              <span className="text-sm text-gray-500">
                Menampilkan {(currentPage - 1) * itemsPerPage + 1} - {Math.min(currentPage * itemsPerPage, filteredSurveys.length)} dari {filteredSurveys.length} data
              </span>
              <div className="flex gap-2">
                <button 
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1.5 rounded border border-gray-200 bg-white text-sm font-medium text-gray-600 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
                >
                  Sebelumnya
                </button>
                <button 
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1.5 rounded border border-gray-200 bg-white text-sm font-medium text-gray-600 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
                >
                  Selanjutnya
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Aggregation Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden mt-8">
        <div className="p-4 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white">
          <h3 className="font-bold text-gray-800 flex items-center gap-2">
            <span className="w-1.5 h-4 bg-blue-500 rounded-full"></span>
            Rekapitulasi per Desa
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50/80 text-gray-500 text-xs uppercase tracking-wider">
                <th className="px-6 py-4 font-bold border-b border-gray-100">Desa / Kelurahan</th>
                <th className="px-6 py-4 font-bold border-b border-gray-100 text-center">Total KK Disurvei</th>
                <th className="px-6 py-4 font-bold border-b border-gray-100 text-center">Rumah Tangga Sehat</th>
                <th className="px-6 py-4 font-bold border-b border-gray-100 text-center">Rumah Tangga Tidak Sehat</th>
                <th className="px-6 py-4 font-bold border-b border-gray-100 text-center">% Sehat (IKS)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-sm">
              {rekapList.length > 0 ? (
                rekapList.map((row, idx) => {
                  const pct = row.total_kk > 0 ? Math.round((row.total_sehat / row.total_kk) * 100) : 0
                  return (
                    <tr key={idx} className="hover:bg-blue-50/40 transition-colors">
                      <td className="px-6 py-5 font-semibold text-gray-800">{row.desaName}</td>
                      <td className="px-6 py-5 text-center font-bold text-gray-700">{row.total_kk}</td>
                      <td className="px-6 py-5 text-center font-bold text-emerald-600 bg-emerald-50/30">{row.total_sehat}</td>
                      <td className="px-6 py-5 text-center font-bold text-red-500 bg-red-50/30">{row.total_tidak_sehat}</td>
                      <td className="px-6 py-5 text-center">
                        <span className={`px-3 py-1.5 rounded-full text-xs font-bold shadow-sm ${
                          pct >= 80 ? 'bg-emerald-500 text-white shadow-emerald-500/20' :
                          pct >= 50 ? 'bg-amber-500 text-white shadow-amber-500/20' : 'bg-red-500 text-white shadow-red-500/20'
                        }`}>
                          {pct}%
                        </span>
                      </td>
                    </tr>
                  )
                })
              ) : (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-gray-400 font-medium">Belum ada data survei di desa ini.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  )
}
