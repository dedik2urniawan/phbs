'use client'

import React, { useState, useMemo, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import * as XLSX from 'xlsx'
import { Upload, Download, Plus, Save, Trash2, CheckCircle, AlertCircle, XCircle, FileSpreadsheet } from 'lucide-react'

interface Props {
  appUser: any
  refPuskesmas: any[]
  refDesa: any[]
  initialSasaran: any[]
}

interface ImportRow {
  nama_puskesmas: string
  nama_desa: string
  jumlah_kk: number
  tahun: number
  status?: 'valid' | 'error' | 'duplicate'
  message?: string
  puskesmas_id?: string
  desa_id?: string
}

const currentYear = new Date().getFullYear()
const YEARS = Array.from({ length: 5 }, (_, i) => currentYear + 1 - i)

export default function SasaranClient({ appUser, refPuskesmas, refDesa, initialSasaran }: Props) {
  const isSuperAdmin = appUser.role === 'superadmin'
  const supabase = createClient()

  // --- State ---
  const [activeTab, setActiveTab] = useState<'input' | 'import'>('input')
  const [sasaranList, setSasaranList] = useState<any[]>(initialSasaran)

  // Filter states
  const [filterTahun, setFilterTahun] = useState<number>(currentYear)
  const [filterPuskesmas, setFilterPuskesmas] = useState<string>(
    isSuperAdmin ? 'all' : String(appUser.puskesmas_id)
  )
  const [filterDesa, setFilterDesa] = useState<string>('all')

  // Form states
  const [formTahun, setFormTahun] = useState<number>(currentYear)
  const [formPuskesmas, setFormPuskesmas] = useState<string>(
    isSuperAdmin ? '' : String(appUser.puskesmas_id)
  )
  const [formDesa, setFormDesa] = useState<string>('')
  const [formJumlah, setFormJumlah] = useState<string>('')
  const [formKeterangan, setFormKeterangan] = useState<string>('')
  const [formLoading, setFormLoading] = useState(false)
  const [formMessage, setFormMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Import states
  const [importRows, setImportRows] = useState<ImportRow[]>([])
  const [importLoading, setImportLoading] = useState(false)
  const [importResult, setImportResult] = useState<{ success: number; error: number } | null>(null)
  const [isDragOver, setIsDragOver] = useState(false)

  // --- Computed ---
  const availableDesa = useMemo(() => {
    if (!formPuskesmas) return []
    return refDesa.filter(d => String(d.puskesmas_id) === String(formPuskesmas))
  }, [formPuskesmas, refDesa])

  const filterAvailableDesa = useMemo(() => {
    if (filterPuskesmas === 'all') return refDesa
    return refDesa.filter(d => String(d.puskesmas_id) === String(filterPuskesmas))
  }, [filterPuskesmas, refDesa])

  const filteredSasaran = useMemo(() => {
    return sasaranList.filter(s => {
      if (filterTahun && s.tahun !== filterTahun) return false
      if (filterPuskesmas !== 'all' && String(s.puskesmas_id) !== filterPuskesmas) return false
      if (filterDesa !== 'all' && String(s.desa_id) !== filterDesa) return false
      if (!isSuperAdmin && String(s.puskesmas_id) !== String(appUser.puskesmas_id)) return false
      return true
    })
  }, [sasaranList, filterTahun, filterPuskesmas, filterDesa, isSuperAdmin, appUser.puskesmas_id])

  const totalSasaran = filteredSasaran.reduce((sum, s) => sum + (s.jumlah_kk || 0), 0)

  // --- Form Submit ---
  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formPuskesmas || !formDesa || !formJumlah) {
      setFormMessage({ type: 'error', text: 'Puskesmas, desa, dan jumlah KK wajib diisi.' })
      return
    }
    setFormLoading(true)
    setFormMessage(null)

    const payload = {
      puskesmas_id: formPuskesmas,
      desa_id: formDesa,
      tahun: formTahun,
      jumlah_kk: parseInt(formJumlah),
      keterangan: formKeterangan || null,
      created_by: appUser.id,
      updated_at: new Date().toISOString(),
    }

    const { data, error } = await supabase
      .from('sasaran_kk')
      .upsert(payload, { onConflict: 'puskesmas_id,desa_id,tahun' })
      .select('*, ref_puskesmas(nama), ref_desa(desa_kel)')
      .single()

    if (error) {
      setFormMessage({ type: 'error', text: `Gagal menyimpan: ${error.message}` })
    } else {
      setFormMessage({ type: 'success', text: 'Data sasaran KK berhasil disimpan!' })
      setSasaranList(prev => {
        const existing = prev.findIndex(s => s.puskesmas_id === formPuskesmas && s.desa_id === formDesa && s.tahun === formTahun)
        if (existing >= 0) {
          const updated = [...prev]
          updated[existing] = data
          return updated
        }
        return [data, ...prev]
      })
      setFormDesa('')
      setFormJumlah('')
      setFormKeterangan('')
    }
    setFormLoading(false)
  }

  // --- Delete ---
  const handleDelete = async (id: string) => {
    if (!confirm('Hapus data sasaran KK ini?')) return
    const { error } = await supabase.from('sasaran_kk').delete().eq('id', id)
    if (!error) {
      setSasaranList(prev => prev.filter(s => s.id !== id))
    }
  }

  // --- Download Template Excel ---
  const handleDownloadTemplate = () => {
    const wb = XLSX.utils.book_new()
    const templateData = [
      ['nama_puskesmas', 'nama_desa', 'jumlah_kk', 'tahun'],
      ['DAMPIT', 'DAMPIT', 500, currentYear],
      ['DAMPIT', 'SRIMULYO', 320, currentYear],
    ]
    const ws = XLSX.utils.aoa_to_sheet(templateData)
    ws['!cols'] = [{ wch: 25 }, { wch: 20 }, { wch: 12 }, { wch: 8 }]
    XLSX.utils.book_append_sheet(wb, ws, 'Sasaran KK')
    XLSX.writeFile(wb, `template_sasaran_kk_${currentYear}.xlsx`)
  }

  // --- Parse Excel File ---
  const parseExcelFile = useCallback((file: File) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const data = e.target?.result
      const wb = XLSX.read(data, { type: 'binary' })
      const ws = wb.Sheets[wb.SheetNames[0]]
      const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 })

      if (rows.length < 2) {
        setImportRows([])
        return
      }

      const parsed: ImportRow[] = rows.slice(1).filter(r => r.length >= 3 && r[0]).map(row => {
        const namaPuskesmas = String(row[0] || '').trim()
        const namaDesa = String(row[1] || '').trim()
        const jumlah = parseInt(String(row[2] || '0'))
        const tahun = parseInt(String(row[3] || currentYear)) || currentYear

        const puskesmas = refPuskesmas.find(p => p.nama.toLowerCase() === namaPuskesmas.toLowerCase())
        const desa = refDesa.find(d => d.desa_kel.toLowerCase() === namaDesa.toLowerCase())

        let status: ImportRow['status'] = 'valid'
        let message = ''

        if (!puskesmas) { status = 'error'; message = `Puskesmas "${namaPuskesmas}" tidak ditemukan` }
        else if (!desa) { status = 'error'; message = `Desa "${namaDesa}" tidak ditemukan` }
        else if (desa.puskesmas_id !== puskesmas.id) { status = 'error'; message = `Desa bukan wilayah Puskesmas` }
        else if (isNaN(jumlah) || jumlah <= 0) { status = 'error'; message = 'Jumlah KK tidak valid' }
        else if (tahun < 2020 || tahun > 2050) { status = 'error'; message = 'Tahun tidak valid' }

        return { nama_puskesmas: namaPuskesmas, nama_desa: namaDesa, jumlah_kk: jumlah, tahun, status, message, puskesmas_id: puskesmas?.id, desa_id: desa?.id }
      })

      setImportRows(parsed)
      setImportResult(null)
    }
    reader.readAsBinaryString(file)
  }, [refPuskesmas, refDesa])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) parseExcelFile(file)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file && (file.name.endsWith('.xlsx') || file.name.endsWith('.xls'))) {
      parseExcelFile(file)
    }
  }

  // --- Process Import ---
  const handleImport = async () => {
    const validRows = importRows.filter(r => r.status === 'valid')
    if (validRows.length === 0) return

    setImportLoading(true)
    let success = 0
    let errorCount = 0

    for (const row of validRows) {
      const { data, error } = await supabase
        .from('sasaran_kk')
        .upsert({
          puskesmas_id: row.puskesmas_id,
          desa_id: row.desa_id,
          tahun: row.tahun,
          jumlah_kk: row.jumlah_kk,
          created_by: appUser.id,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'puskesmas_id,desa_id,tahun' })
        .select('*, ref_puskesmas(nama), ref_desa(desa_kel)')
        .single()

      if (error) errorCount++
      else {
        success++
        setSasaranList(prev => {
          const existing = prev.findIndex(s => s.puskesmas_id === row.puskesmas_id && s.desa_id === row.desa_id && s.tahun === row.tahun)
          if (existing >= 0) {
            const updated = [...prev]; updated[existing] = data; return updated
          }
          return [data, ...prev]
        })
      }
    }

    setImportResult({ success, error: errorCount })
    setImportLoading(false)
  }

  const validCount = importRows.filter(r => r.status === 'valid').length
  const errorCount = importRows.filter(r => r.status === 'error').length

  return (
    <div className="space-y-6">
      {/* --- Tabs --- */}
      <div className="flex border-b border-gray-200 gap-6">
        {[
          { id: 'input', label: '✏️ Input Sasaran', icon: '✏️' },
          { id: 'import', label: '📥 Import Sasaran KK', icon: '📥' },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`pb-3 px-2 text-sm font-bold transition-all border-b-2 ${
              activeTab === tab.id
                ? 'border-emerald-500 text-emerald-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* --- Filter Panel --- */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 flex flex-wrap gap-4 items-end">
        <div className="flex-1 min-w-[140px]">
          <label className="block text-xs font-semibold text-gray-500 mb-1">Tahun</label>
          <select
            value={filterTahun}
            onChange={e => setFilterTahun(Number(e.target.value))}
            className="w-full bg-gray-50 border border-gray-200 text-gray-900 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
          >
            {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        {isSuperAdmin && (
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs font-semibold text-gray-500 mb-1">Puskesmas</label>
            <select
              value={filterPuskesmas}
              onChange={e => { setFilterPuskesmas(e.target.value); setFilterDesa('all') }}
              className="w-full bg-gray-50 border border-gray-200 text-gray-900 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="all">Semua Puskesmas</option>
              {refPuskesmas.map(p => <option key={p.id} value={p.id}>{p.nama}</option>)}
            </select>
          </div>
        )}
        <div className="flex-1 min-w-[180px]">
          <label className="block text-xs font-semibold text-gray-500 mb-1">Desa/Kelurahan</label>
          <select
            value={filterDesa}
            onChange={e => setFilterDesa(e.target.value)}
            className="w-full bg-gray-50 border border-gray-200 text-gray-900 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option value="all">Semua Desa</option>
            {filterAvailableDesa.map(d => <option key={d.id} value={d.id}>{d.desa_kel}</option>)}
          </select>
        </div>
        <div className="bg-emerald-50 border border-emerald-100 rounded-xl px-4 py-2 text-center min-w-[120px]">
          <p className="text-xs text-emerald-600 font-medium">Total Sasaran</p>
          <p className="text-2xl font-black text-emerald-700">{totalSasaran.toLocaleString('id')}</p>
          <p className="text-[10px] text-emerald-500">KK terdaftar</p>
        </div>
      </div>

      {/* ====== TAB INPUT ====== */}
      {activeTab === 'input' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Form */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                <span className="w-7 h-7 bg-emerald-100 rounded-lg flex items-center justify-center text-emerald-700"><Plus size={14} /></span>
                Input Sasaran KK
              </h3>
              <form onSubmit={handleFormSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Tahun</label>
                  <select value={formTahun} onChange={e => setFormTahun(Number(e.target.value))}
                    className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500">
                    {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                  </select>
                </div>
                {isSuperAdmin && (
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1">Puskesmas <span className="text-red-500">*</span></label>
                    <select value={formPuskesmas} onChange={e => { setFormPuskesmas(e.target.value); setFormDesa('') }}
                      className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500">
                      <option value="">-- Pilih Puskesmas --</option>
                      {refPuskesmas.map(p => <option key={p.id} value={p.id}>{p.nama}</option>)}
                    </select>
                  </div>
                )}
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Desa / Kelurahan <span className="text-red-500">*</span></label>
                  <select value={formDesa} onChange={e => setFormDesa(e.target.value)}
                    disabled={!formPuskesmas}
                    className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50">
                    <option value="">-- Pilih Desa --</option>
                    {availableDesa.map(d => <option key={d.id} value={d.id}>{d.desa_kel}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Jumlah KK Sasaran <span className="text-red-500">*</span></label>
                  <input type="number" min="0" value={formJumlah} onChange={e => setFormJumlah(e.target.value)}
                    placeholder="Contoh: 500"
                    className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Keterangan (opsional)</label>
                  <input type="text" value={formKeterangan} onChange={e => setFormKeterangan(e.target.value)}
                    placeholder="Sumber data, dll."
                    className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500" />
                </div>
                {formMessage && (
                  <div className={`p-3 rounded-xl text-xs font-medium flex items-center gap-2 ${
                    formMessage.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'
                  }`}>
                    {formMessage.type === 'success' ? <CheckCircle size={14} /> : <AlertCircle size={14} />}
                    {formMessage.text}
                  </div>
                )}
                <button type="submit" disabled={formLoading}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-2.5 rounded-xl text-sm flex items-center justify-center gap-2 transition-colors disabled:opacity-50">
                  <Save size={14} />
                  {formLoading ? 'Menyimpan...' : 'Simpan Sasaran KK'}
                </button>
              </form>
            </div>
          </div>

          {/* Table */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="p-4 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white flex justify-between items-center">
                <h3 className="font-bold text-gray-800">Data Sasaran KK Tersimpan</h3>
                <span className="text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded-full">{filteredSasaran.length} data</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead>
                    <tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider border-b border-gray-200">
                      <th className="px-4 py-3">Tahun</th>
                      {isSuperAdmin && <th className="px-4 py-3">Puskesmas</th>}
                      <th className="px-4 py-3">Desa / Kelurahan</th>
                      <th className="px-4 py-3 text-center">Jumlah KK</th>
                      <th className="px-4 py-3 text-center">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredSasaran.length > 0 ? filteredSasaran.map(s => (
                      <tr key={s.id} className="hover:bg-blue-50/30 transition-colors">
                        <td className="px-4 py-3 font-semibold text-gray-700">{s.tahun}</td>
                        {isSuperAdmin && <td className="px-4 py-3 text-gray-600 text-xs">{s.ref_puskesmas?.nama || '-'}</td>}
                        <td className="px-4 py-3 font-medium text-gray-800">{s.ref_desa?.desa_kel || '-'}</td>
                        <td className="px-4 py-3 text-center">
                          <span className="bg-emerald-50 text-emerald-700 font-bold px-3 py-1 rounded-full text-sm border border-emerald-100">
                            {(s.jumlah_kk || 0).toLocaleString('id')}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <button onClick={() => handleDelete(s.id)}
                            className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    )) : (
                      <tr>
                        <td colSpan={isSuperAdmin ? 5 : 4} className="px-4 py-12 text-center text-gray-400">
                          Belum ada data sasaran KK. Gunakan form di kiri untuk menambahkan.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ====== TAB IMPORT ====== */}
      {activeTab === 'import' && (
        <div className="space-y-6">
          {/* Step 1: Download Template */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center text-blue-600 font-bold text-sm">1</div>
              <h3 className="font-bold text-gray-800">Download Template Excel</h3>
            </div>
            <p className="text-sm text-gray-500 mb-4">
              Download template Excel di bawah ini, isi data sasaran KK sesuai format, lalu upload kembali di Langkah 2.
              Kolom: <code className="bg-gray-100 px-1 rounded text-xs">nama_puskesmas</code>, <code className="bg-gray-100 px-1 rounded text-xs">nama_desa</code>, <code className="bg-gray-100 px-1 rounded text-xs">jumlah_kk</code>, <code className="bg-gray-100 px-1 rounded text-xs">tahun</code>
            </p>
            <button onClick={handleDownloadTemplate}
              className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors shadow-sm">
              <FileSpreadsheet size={16} />
              Download Template Excel
            </button>
          </div>

          {/* Step 2: Upload */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center text-amber-600 font-bold text-sm">2</div>
              <h3 className="font-bold text-gray-800">Upload File Excel</h3>
            </div>
            <div
              className={`border-2 border-dashed rounded-2xl p-10 text-center transition-all cursor-pointer ${
                isDragOver ? 'border-emerald-400 bg-emerald-50' : 'border-gray-200 hover:border-emerald-300 hover:bg-gray-50'
              }`}
              onDragOver={e => { e.preventDefault(); setIsDragOver(true) }}
              onDragLeave={() => setIsDragOver(false)}
              onDrop={handleDrop}
              onClick={() => document.getElementById('excel-upload')?.click()}
            >
              <Upload className="mx-auto mb-3 text-gray-400" size={36} />
              <p className="text-gray-600 font-medium">Drag & drop file Excel di sini</p>
              <p className="text-gray-400 text-sm mt-1">atau klik untuk memilih file</p>
              <p className="text-gray-300 text-xs mt-2">.xlsx, .xls</p>
              <input id="excel-upload" type="file" accept=".xlsx,.xls" className="hidden" onChange={handleFileChange} />
            </div>
          </div>

          {/* Step 3: Verification Preview */}
          {importRows.length > 0 && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="p-4 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center text-emerald-600 font-bold text-sm">3</div>
                  <h3 className="font-bold text-gray-800">Verifikasi Data ({importRows.length} baris)</h3>
                </div>
                <div className="flex items-center gap-3 text-xs">
                  <span className="flex items-center gap-1 text-emerald-600 font-semibold">
                    <CheckCircle size={12} /> {validCount} valid
                  </span>
                  <span className="flex items-center gap-1 text-red-500 font-semibold">
                    <XCircle size={12} /> {errorCount} error
                  </span>
                </div>
              </div>
              <div className="overflow-x-auto max-h-64">
                <table className="w-full text-xs text-left">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr className="text-gray-500 uppercase tracking-wider border-b">
                      <th className="px-3 py-2">Status</th>
                      <th className="px-3 py-2">Puskesmas</th>
                      <th className="px-3 py-2">Desa</th>
                      <th className="px-3 py-2 text-center">Jumlah KK</th>
                      <th className="px-3 py-2 text-center">Tahun</th>
                      <th className="px-3 py-2">Keterangan</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {importRows.map((row, idx) => (
                      <tr key={idx} className={row.status === 'error' ? 'bg-red-50' : 'bg-white'}>
                        <td className="px-3 py-2">
                          {row.status === 'valid'
                            ? <span className="inline-flex items-center gap-1 text-emerald-600"><CheckCircle size={12} /> Valid</span>
                            : <span className="inline-flex items-center gap-1 text-red-500"><XCircle size={12} /> Error</span>
                          }
                        </td>
                        <td className="px-3 py-2 font-medium">{row.nama_puskesmas}</td>
                        <td className="px-3 py-2">{row.nama_desa}</td>
                        <td className="px-3 py-2 text-center font-bold">{row.jumlah_kk.toLocaleString('id')}</td>
                        <td className="px-3 py-2 text-center">{row.tahun}</td>
                        <td className="px-3 py-2 text-red-400 italic">{row.message}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {importResult && (
                <div className={`mx-4 my-3 p-3 rounded-xl text-sm font-medium flex items-center gap-2 ${
                  importResult.error === 0 ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-700 border border-amber-200'
                }`}>
                  <CheckCircle size={16} />
                  Import selesai: {importResult.success} berhasil, {importResult.error} gagal.
                </div>
              )}

              <div className="p-4 border-t border-gray-100 flex justify-end">
                <button
                  onClick={handleImport}
                  disabled={importLoading || validCount === 0}
                  className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2.5 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50 shadow-sm"
                >
                  <Download size={14} />
                  {importLoading ? 'Mengimpor...' : `Import ${validCount} Baris Valid`}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
