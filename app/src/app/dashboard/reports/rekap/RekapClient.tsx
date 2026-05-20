'use client'

import React, { useState, useMemo, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { AppUser } from '@/lib/types'
import { ClipboardList, Download, Printer, FileText } from 'lucide-react'
import * as XLSX from 'xlsx'

interface Props {
  appUser: AppUser & { ref_puskesmas?: { nama: string } }
  surveysData: any[]
  puskesmasList: any[]
  desaList: any[]
  sasaranData?: any[]
  selectedTahun?: number
  availableYears?: number[]
}

const PHBS_INDICATORS = [
  { key: 'i1_persalinan_nakes', label: '1. PER\nSALINAN' },
  { key: 'i2_asi_eksklusif', label: '2. ASI\nEKSKLUSI\nF' },
  { key: 'i3_menimbang_balita', label: '3. MEN\nIM\nBANG' },
  { key: 'i5_cuci_tangan', label: '4. CUCI\nTANGAN' },
  { key: 'i4_air_bersih', label: '5. AIR\nBERSIH' },
  { key: 'i6_jamban_sehat', label: '6.\nJAMBAN\nSEHAT' },
  { key: 'i7_psn', label: '7. PSN' },
  { key: 'i8_makan_sayur_buah', label: '8. DIET\nSAYUR\nDAN\nBUAH' },
  { key: 'i9_aktivitas_fisik', label: '9. AKTI\nVITAS\nFISIK' },
  { key: 'i10_tidak_merokok', label: '10.TIDAK\nMEROKOK' }
]

const NON_PHBS_INDICATORS = [
  { key: 'g_posyandu_hadir', label: 'POSYANDU' },
  { key: 'g_bumil_ttd', label: 'KONSUMSI\nTTD' },
  { key: 'g_remaja_ttd', label: 'KONSU\nMSI TTD' }
]

export default function RekapClient({ appUser, surveysData, puskesmasList, desaList, sasaranData = [], selectedTahun, availableYears = [] }: Props) {
  const router = useRouter()
  const isSuperAdmin = appUser.role === 'superadmin'
  const printRef = useRef<HTMLDivElement>(null)
  
  // Tabs
  const [activeMainTab, setActiveMainTab] = useState<'rekap' | 'laporan'>('rekap')

  // Filters
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

  // --- Aggregation logic for Table 1 (Detail Rekapitulasi Puskesmas / Desa) ---
  
  const detailRekapList = useMemo(() => {
    const groupByPuskesmas = isSuperAdmin && selectedPuskesmas === 'all'
    const entities = groupByPuskesmas ? puskesmasList.filter(p => !p.nama.toLowerCase().includes('dinkes')) : filteredDesa
    
    return entities.map(entity => {
      // Find surveys
      const entitySurveys = filteredSurveys.filter(s => 
        groupByPuskesmas 
          ? String(s.households?.puskesmas_id) === String(entity.id)
          : String(s.households?.desa_id) === String(entity.id)
      )
      
      // Find sasaran
      const entitySasaran = sasaranData.filter(s => 
        groupByPuskesmas
          ? String(s.puskesmas_id) === String(entity.id)
          : String(s.desa_id) === String(entity.id)
      )
      const totalKkTarget = entitySasaran.reduce((sum, s) => sum + (s.jumlah_kk || 0), 0)

      const phbsStats = PHBS_INDICATORS.map(ind => {
        let num = 0
        entitySurveys.forEach(s => {
          if (s[ind.key] === true) num++
        })
        return { key: ind.key, num, pct: totalKkTarget > 0 ? Math.round((num / totalKkTarget) * 10) / 10 : 0 }
      })

      const nonPhbsStats = NON_PHBS_INDICATORS.map(ind => {
        let num = 0
        entitySurveys.forEach(s => {
          // Check ART responses for non-phbs
          const hasPositif = s.survey_art_responses?.some((art: any) => art[ind.key] === true)
          if (hasPositif) num++
        })
        return { key: ind.key, num, pct: totalKkTarget > 0 ? Math.round((num / totalKkTarget) * 10) / 10 : 0 }
      })

      return {
        id: entity.id,
        name: groupByPuskesmas ? entity.nama : entity.desa_kel,
        totalKkTarget,
        phbsStats,
        nonPhbsStats
      }
    }).sort((a, b) => a.name.localeCompare(b.name))
  }, [filteredSurveys, isSuperAdmin, selectedPuskesmas, puskesmasList, filteredDesa, sasaranData])

  // --- Aggregation logic for Table 2 (Rumah Sehat) ---
  const rumahSehatList = useMemo(() => {
    const groupByPuskesmas = isSuperAdmin && selectedPuskesmas === 'all'
    const entities = groupByPuskesmas ? puskesmasList.filter(p => !p.nama.toLowerCase().includes('dinkes')) : filteredDesa
    
    return entities.map(entity => {
      const entitySurveys = filteredSurveys.filter(s => 
        groupByPuskesmas 
          ? String(s.households?.puskesmas_id) === String(entity.id)
          : String(s.households?.desa_id) === String(entity.id)
      )
      
      const totalDisurvei = entitySurveys.length
      const sehat = entitySurveys.filter(s => s.is_rt_sehat).length
      const tidakSehat = totalDisurvei - sehat
      const pct = totalDisurvei > 0 ? Math.round((sehat / totalDisurvei) * 100) : 0
      
      return {
        id: entity.id,
        name: groupByPuskesmas ? entity.nama : entity.desa_kel,
        totalDisurvei,
        sehat,
        tidakSehat,
        pct
      }
    }).filter(e => e.totalDisurvei > 0).sort((a, b) => a.name.localeCompare(b.name))
  }, [filteredSurveys, isSuperAdmin, selectedPuskesmas, puskesmasList, filteredDesa])

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

  // Export functions
  const handleExportExcel = () => {
    const wb = XLSX.utils.book_new()
    
    // Sheet 1: Detail Rekapitulasi (PHBS & Non PHBS)
    const groupByPuskesmas = isSuperAdmin && selectedPuskesmas === 'all'
    const headers = [
      'NO', groupByPuskesmas ? 'PUSKESMAS' : 'DESA/KELURAHAN', 'KETERANGAN',
      ...PHBS_INDICATORS.map(i => i.label.replace(/\n/g, ' ')),
      ...NON_PHBS_INDICATORS.map(i => i.label.replace(/\n/g, ' '))
    ]
    
    const rows1: any[][] = [headers]
    detailRekapList.forEach((r, idx) => {
      // Row 1: TOTAL
      rows1.push([
        idx + 1, r.name, 'TOTAL',
        ...r.phbsStats.map(() => r.totalKkTarget),
        ...r.nonPhbsStats.map(() => r.totalKkTarget)
      ])
      // Row 2: YG DI KAJI
      rows1.push([
        '', '', 'YG DI KAJI',
        ...r.phbsStats.map(s => s.num),
        ...r.nonPhbsStats.map(s => s.num)
      ])
      // Row 3: %
      rows1.push([
        '', '', '%',
        ...r.phbsStats.map(s => s.pct),
        ...r.nonPhbsStats.map(s => s.pct)
      ])
    })
    const ws1 = XLSX.utils.aoa_to_sheet(rows1)
    XLSX.utils.book_append_sheet(wb, ws1, 'Detail Indikator')

    // Sheet 2: Rumah Sehat
    const headers2 = ['NO', groupByPuskesmas ? 'PUSKESMAS' : 'DESA/KELURAHAN', 'TOTAL KK DISURVEI', 'RUMAH TANGGA SEHAT', 'RUMAH TANGGA TIDAK SEHAT', '% SEHAT (IKS)']
    const rows2: any[][] = [headers2, ...rumahSehatList.map((r, idx) => [
      idx + 1, r.name, r.totalDisurvei, r.sehat, r.tidakSehat, `${r.pct}%`
    ])]
    const ws2 = XLSX.utils.aoa_to_sheet(rows2)
    XLSX.utils.book_append_sheet(wb, ws2, 'Rumah Sehat')

    XLSX.writeFile(wb, `Laporan_PHBS_${selectedTahun}_${new Date().getTime()}.xlsx`)
  }

  const handlePrintPDF = () => {
    window.print()
  }

  // --- Table Rendering Components ---
  const renderDetailRekapTable = () => {
    const groupByPuskesmas = isSuperAdmin && selectedPuskesmas === 'all'
    
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden mb-8 print-section">
        <div className="p-4 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white hide-on-print">
          <h3 className="font-bold text-gray-800 flex items-center gap-2">
            <span className="w-1.5 h-4 bg-purple-500 rounded-full"></span>
            Detail Rekapitulasi {groupByPuskesmas ? 'Puskesmas' : 'Desa'}
          </h3>
        </div>
        <div className="overflow-x-auto print-overflow-visible">
          <table className="w-full text-left border-collapse border-y border-gray-200 print:border-black print:text-[10px]">
            <thead>
              <tr className="bg-gray-50 text-gray-800 text-center text-xs uppercase tracking-wider">
                <th rowSpan={2} className="border border-gray-200 print:border-black px-2 py-3 font-bold">NO</th>
                <th rowSpan={2} className="border border-gray-200 print:border-black px-4 py-3 min-w-[120px] font-bold">{groupByPuskesmas ? 'PUSKESMAS' : 'DESA'}</th>
                <th rowSpan={2} className="border border-gray-200 print:border-black px-4 py-3 font-bold">KETERANGAN</th>
                {PHBS_INDICATORS.map((ind, i) => (
                  <th key={i} rowSpan={2} className="border border-gray-200 print:border-black px-2 py-2 whitespace-pre-wrap leading-tight max-w-[80px] bg-blue-50/50 text-blue-900 font-bold">
                    {ind.label}
                  </th>
                ))}
                <th colSpan={NON_PHBS_INDICATORS.length} className="border border-gray-200 print:border-black px-2 py-2 bg-purple-50/50 text-purple-900 font-bold">NON PHBS</th>
              </tr>
              <tr className="bg-gray-50 text-gray-800 text-center text-xs uppercase tracking-wider">
                {NON_PHBS_INDICATORS.map((ind, i) => (
                  <th key={i} className="border border-gray-200 print:border-black px-2 py-2 whitespace-pre-wrap leading-tight max-w-[80px] bg-purple-50/50 text-purple-900 font-bold">
                    {ind.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="text-gray-800 text-sm print:text-black print:text-[10px]">
              {detailRekapList.length > 0 ? detailRekapList.map((row, idx) => (
                <React.Fragment key={idx}>
                  {/* Row TOTAL */}
                  <tr className="hover:bg-gray-50/50 transition-colors">
                    <td rowSpan={3} className="border border-gray-200 print:border-black px-2 text-center text-gray-500 font-medium">{idx + 1}</td>
                    <td rowSpan={3} className="border border-gray-200 print:border-black px-4 font-bold text-gray-900 uppercase">{row.name}</td>
                    <td className="border border-gray-200 print:border-black px-4 font-semibold text-center text-gray-600">TOTAL</td>
                    {row.phbsStats.map((s, i) => <td key={i} className="border border-gray-200 print:border-black px-2 text-center font-medium text-gray-700">{row.totalKkTarget}</td>)}
                    {row.nonPhbsStats.map((s, i) => <td key={i} className="border border-gray-200 print:border-black px-2 text-center font-medium text-gray-700">{row.totalKkTarget}</td>)}
                  </tr>
                  {/* Row YG DI KAJI */}
                  <tr className="hover:bg-gray-50/50 transition-colors">
                    <td className="border border-gray-200 print:border-black px-4 font-semibold text-center text-gray-600">YG DI KAJI</td>
                    {row.phbsStats.map((s, i) => <td key={i} className="border border-gray-200 print:border-black px-2 text-center font-medium text-gray-700">{s.num}</td>)}
                    {row.nonPhbsStats.map((s, i) => <td key={i} className="border border-gray-200 print:border-black px-2 text-center font-medium text-gray-700">{s.num}</td>)}
                  </tr>
                  {/* Row % */}
                  <tr className="bg-emerald-50/60 print:bg-transparent font-bold">
                    <td className="border border-gray-200 print:border-black px-4 text-center text-emerald-800 print:text-black">%</td>
                    {row.phbsStats.map((s, i) => <td key={i} className="border border-gray-200 print:border-black px-2 text-center text-emerald-700 print:text-black">{s.pct.toFixed(1).replace('.', ',')}</td>)}
                    {row.nonPhbsStats.map((s, i) => <td key={i} className="border border-gray-200 print:border-black px-2 text-center text-emerald-700 print:text-black">{s.pct.toFixed(1).replace('.', ',')}</td>)}
                  </tr>
                </React.Fragment>
              )) : (
                <tr>
                  <td colSpan={14} className="border border-black px-4 py-8 text-center text-gray-500">Belum ada data sasaran atau survei untuk ditampilkan.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  const renderRumahSehatTable = () => {
    const groupByPuskesmas = isSuperAdmin && selectedPuskesmas === 'all'
    
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden mt-8 print-section">
        <div className="p-4 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white hide-on-print">
          <h3 className="font-bold text-gray-800 flex items-center gap-2">
            <span className="w-1.5 h-4 bg-blue-500 rounded-full"></span>
            Rekapitulasi per {groupByPuskesmas ? 'Puskesmas' : 'Desa'}
          </h3>
        </div>
        <div className="overflow-x-auto print-overflow-visible">
          <table className="w-full text-left border-collapse border border-gray-200">
            <thead>
              <tr className="bg-gray-50/80 text-gray-500 text-xs uppercase tracking-wider print:text-black">
                <th className="px-6 py-4 font-bold border-b border-gray-100">{groupByPuskesmas ? 'Puskesmas' : 'Desa / Kelurahan'}</th>
                <th className="px-6 py-4 font-bold border-b border-gray-100 text-center">Total KK Disurvei</th>
                <th className="px-6 py-4 font-bold border-b border-gray-100 text-center">Rumah Tangga Sehat</th>
                <th className="px-6 py-4 font-bold border-b border-gray-100 text-center">Rumah Tangga Tidak Sehat</th>
                <th className="px-6 py-4 font-bold border-b border-gray-100 text-center">% Sehat (IKS)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-sm print:text-black">
              {rumahSehatList.length > 0 ? (
                rumahSehatList.map((row, idx) => {
                  return (
                    <tr key={idx} className="hover:bg-blue-50/40 transition-colors">
                      <td className="px-6 py-5 font-bold text-gray-800 print:text-black uppercase">{row.name}</td>
                      <td className="px-6 py-5 text-center font-bold text-gray-700 print:text-black">{row.totalDisurvei}</td>
                      <td className="px-6 py-5 text-center font-bold text-emerald-600 print:text-black">{row.sehat}</td>
                      <td className="px-6 py-5 text-center font-bold text-red-500 print:text-black">{row.tidakSehat}</td>
                      <td className="px-6 py-5 text-center">
                        <span className={`px-3 py-1.5 rounded-full text-xs font-bold shadow-sm print:shadow-none print:text-black ${
                          row.pct >= 80 ? 'bg-emerald-500 text-white shadow-emerald-500/20' :
                          row.pct >= 50 ? 'bg-amber-500 text-white shadow-amber-500/20' : 'bg-red-500 text-white shadow-red-500/20'
                        }`}>
                          {row.pct}%
                        </span>
                      </td>
                    </tr>
                  )
                })
              ) : (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-gray-400 font-medium">Belum ada data survei.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Tab Navigation */}
      <div className="flex border-b border-gray-200 gap-6 hide-on-print">
        {[
          { id: 'rekap', label: '📋 Daftar Rekap PHBS' },
          { id: 'laporan', label: '📊 Laporan PHBS' },
        ].map(tab => (
          <button
            key={tab.id}
            type="button"
            onClick={(e) => {
              e.preventDefault();
              setActiveMainTab(tab.id as any);
            }}
            className={`pb-3 px-2 text-sm font-bold transition-all border-b-2 cursor-pointer ${
              activeMainTab === tab.id
                ? 'border-emerald-500 text-emerald-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Filter Panel (Shared across tabs, except search is hidden on Laporan) */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col md:flex-row gap-4 hide-on-print">
        {isSuperAdmin && (
          <div className="flex-1">
            <label className="block text-xs font-semibold text-gray-500 mb-1">Puskesmas</label>
            <select
              value={selectedPuskesmas}
              onChange={(e) => {
                setSelectedPuskesmas(e.target.value)
                setSelectedDesa('all')
              }}
              className="w-full bg-gray-50 border border-gray-200 text-gray-900 text-sm rounded-lg focus:ring-emerald-500 focus:border-emerald-500 block p-2.5 transition-colors"
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
            className="w-full bg-gray-50 border border-gray-200 text-gray-900 text-sm rounded-lg focus:ring-emerald-500 focus:border-emerald-500 block p-2.5 transition-colors"
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
              className="w-full bg-gray-50 border border-gray-200 text-gray-900 text-sm rounded-lg focus:ring-emerald-500 focus:border-emerald-500 block p-2.5 transition-colors"
            >
              {availableYears.map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
        )}

        {activeMainTab === 'rekap' && (
          <div className="flex-1 md:flex-[1.5]">
            <label className="block text-xs font-semibold text-gray-500 mb-1">Cari KK / NIK / Nama</label>
            <input 
              type="text" 
              placeholder="Ketik NIK, No KK, atau Nama..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 text-gray-900 text-sm rounded-lg focus:ring-emerald-500 focus:border-emerald-500 block p-2.5 transition-colors"
            />
          </div>
        )}
      </div>

      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          body * {
            visibility: hidden;
          }
          .hide-on-print {
            display: none !important;
          }
          #print-area, #print-area * {
            visibility: visible;
          }
          #print-area {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
          }
          @page {
            size: landscape;
            margin: 1cm;
          }
          .print-section {
            break-inside: avoid;
            margin-bottom: 2cm;
            border: none !important;
            box-shadow: none !important;
          }
          table {
            page-break-inside: auto;
          }
          tr {
            page-break-inside: avoid;
            page-break-after: auto;
          }
          th {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
        }
      `}} />

      {activeMainTab === 'rekap' ? (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          
          {isSuperAdmin && renderDetailRekapTable()}
          {renderRumahSehatTable()}

          {/* Detail per Rumah Tangga */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden mt-8">
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
                        
                        {/* Expanded ART Rows - Changed text color to black/gray-900 here! */}
                        {expandedRows[s.id] && s.survey_art_responses && s.survey_art_responses.length > 0 && (
                          <tr className="bg-gray-50/50">
                            <td colSpan={18} className="px-8 py-4">
                              <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                                <table className="w-full text-xs text-left">
                                  <thead className="bg-gray-100/80 text-gray-800 font-bold border-b border-gray-200">
                                    <tr>
                                      <th className="px-4 py-2">Nama ART</th>
                                      <th className="px-4 py-2">NIK / Hub. KK</th>
                                      <th className="px-2 py-2 text-center" title="Persalinan Nakes">Persalinan</th>
                                      <th className="px-2 py-2 text-center" title="ASI Eksklusif">ASI</th>
                                      <th className="px-2 py-2 text-center" title="Menimbang Balita">Timbang</th>
                                      <th className="px-2 py-2 text-center" title="Cuci Tangan">CTPS</th>
                                      <th className="px-2 py-2 text-center" title="Makan Sayur Buah">Sayur</th>
                                      <th className="px-2 py-2 text-center" title="Aktivitas Fisik">Aktifitas</th>
                                      <th className="px-2 py-2 text-center" title="Tidak Merokok">Tdk Rokok</th>
                                      <th className="px-2 py-2 text-center" title="Cek Kesehatan">Cek Kes.</th>
                                      <th className="px-2 py-2 text-center" title="Posyandu">Posyandu</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-gray-100">
                                    {s.survey_art_responses.map((art: any) => (
                                      <tr key={art.id} className="hover:bg-gray-50 text-gray-900">
                                        <td className="px-4 py-2 font-bold">{art.family_members?.nama || '-'}</td>
                                        <td className="px-4 py-2 font-medium">{art.family_members?.nik || '-'}<br/><span className="text-[10px] text-gray-500 font-normal">{art.family_members?.hubungan_kk || ''}</span></td>
                                        <td className="px-2 py-2 text-center">{art.i1_persalinan_nakes !== null && art.i1_persalinan_nakes !== undefined ? formatBool(art.i1_persalinan_nakes) : <span className="text-gray-300 text-xs">N/A</span>}</td>
                                        <td className="px-2 py-2 text-center">{art.i2_asi_eksklusif !== null && art.i2_asi_eksklusif !== undefined ? formatBool(art.i2_asi_eksklusif) : <span className="text-gray-300 text-xs">N/A</span>}</td>
                                        <td className="px-2 py-2 text-center">{art.i3_menimbang_balita !== null && art.i3_menimbang_balita !== undefined ? formatBool(art.i3_menimbang_balita) : <span className="text-gray-300 text-xs">N/A</span>}</td>
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
        </div>
      ) : (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-bold text-gray-800">Laporan PHBS (Siap Unduh)</h3>
            <div className="flex gap-3">
              <button
                onClick={handleExportExcel}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-2 px-4 rounded-xl text-sm flex items-center justify-center gap-2 transition-colors shadow-sm"
              >
                <FileText size={16} />
                Unduh Excel
              </button>
              <button
                onClick={handlePrintPDF}
                className="bg-purple-600 hover:bg-purple-700 text-white font-semibold py-2 px-4 rounded-xl text-sm flex items-center justify-center gap-2 transition-colors shadow-sm"
              >
                <Printer size={16} />
                Unduh / Cetak PDF
              </button>
            </div>
          </div>
          
          {/* Printable Area Wrapper */}
          <div id="print-area">
            {/* Report Header for Print only */}
            <div className="hidden print:block text-center mb-8">
              <h1 className="text-2xl font-bold uppercase">Laporan Rekapitulasi PHBS</h1>
              <h2 className="text-lg font-semibold uppercase">Tahun {selectedTahun}</h2>
              <p className="text-sm mt-1">{isSuperAdmin && selectedPuskesmas === 'all' ? 'Tingkat Kabupaten Malang' : `Tingkat ${isSuperAdmin ? puskesmasList.find(p=>p.id===selectedPuskesmas)?.nama : appUser.ref_puskesmas?.nama}`}</p>
            </div>
            {renderDetailRekapTable()}
            {renderRumahSehatTable()}
          </div>

        </div>
      )}

    </div>
  )
}
