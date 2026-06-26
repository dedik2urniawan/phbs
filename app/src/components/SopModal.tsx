'use client'

import React, { useEffect, useState } from 'react'
import { AlertTriangle, CheckCircle2 } from 'lucide-react'

export default function SopModal() {
  const [isVisible, setIsVisible] = useState(false)
  const [isAgreed, setIsAgreed] = useState(false)

  useEffect(() => {
    // Gunakan sessionStorage agar modal muncul setiap kali PWA dibuka baru
    const hasAgreed = sessionStorage.getItem('phbs_sop_agreed')
    if (!hasAgreed) {
      setIsVisible(true)
    }
  }, [])

  const handleAgree = () => {
    sessionStorage.setItem('phbs_sop_agreed', 'true')
    setIsVisible(false)
  }

  if (!isVisible) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm" />

      {/* Modal Card */}
      <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden transform transition-all">
        {/* Decorative blobs */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/10 rounded-bl-full pointer-events-none" />
        
        <div className="p-6 relative z-10">
          <div className="w-14 h-14 bg-red-100 text-red-600 rounded-2xl flex items-center justify-center mb-5 shadow-sm">
            <AlertTriangle size={28} />
          </div>

          <h2 className="text-xl font-black text-gray-800 mb-2">SOP Kepatuhan Survei</h2>
          <p className="text-gray-500 text-sm leading-relaxed mb-6">
            Demi menjaga validitas data base server, mohon Bapak/Ibu Kader mematuhi aturan pengisian survei berikut:
          </p>

          <div className="space-y-4 mb-6">
            <div className="flex gap-3 items-start bg-blue-50 border border-blue-100 p-3 rounded-xl">
              <CheckCircle2 className="text-blue-500 flex-shrink-0 mt-0.5" size={18} />
              <div>
                <h3 className="text-sm font-bold text-gray-800">1. Dilarang Asal Isi NIK / No KK</h3>
                <p className="text-xs text-gray-600 mt-1">Gunakan NIK dan No KK asli dari KTP/KK. Jika kader asal mengisi angka, data akan tertimpa dan error.</p>
              </div>
            </div>

            <div className="flex gap-3 items-start bg-amber-50 border border-amber-100 p-3 rounded-xl">
              <CheckCircle2 className="text-amber-500 flex-shrink-0 mt-0.5" size={18} />
              <div>
                <h3 className="text-sm font-bold text-gray-800">2. Satu KK Hanya Boleh 1 Kali Survei</h3>
                <p className="text-xs text-gray-600 mt-1">Tidak boleh membuat survei ganda pada rumah tangga yang sama di tahun yang sama. Gunakan fitur 'Update' jika ada kesalahan.</p>
              </div>
            </div>

            <div className="flex gap-3 items-start bg-emerald-50 border border-emerald-100 p-3 rounded-xl">
              <CheckCircle2 className="text-emerald-500 flex-shrink-0 mt-0.5" size={18} />
              <div>
                <h3 className="text-sm font-bold text-gray-800">3. Pastikan Sinkronisasi Sukses</h3>
                <p className="text-xs text-gray-600 mt-1">Jika Bapak/Ibu survei di daerah tanpa sinyal (offline), pastikan membuka aplikasi kembali saat mendapat sinyal agar data terkirim 100%.</p>
              </div>
            </div>
          </div>

          <label className="flex items-start gap-3 mb-6 cursor-pointer p-3 bg-gray-50 rounded-xl border border-gray-200">
            <input 
              type="checkbox" 
              className="mt-1 w-4 h-4 text-emerald-600 rounded border-gray-300 focus:ring-emerald-500"
              checked={isAgreed}
              onChange={(e) => setIsAgreed(e.target.checked)}
            />
            <span className="text-sm text-gray-700 font-medium">Saya telah membaca, memahami, dan akan mematuhi SOP ini.</span>
          </label>

          <button
            onClick={handleAgree}
            disabled={!isAgreed}
            className={`w-full py-3.5 rounded-xl font-bold text-white shadow-md transition-all ${
              isAgreed 
                ? 'bg-emerald-500 hover:bg-emerald-600 shadow-emerald-500/30' 
                : 'bg-gray-300 cursor-not-allowed opacity-70'
            }`}
          >
            Mulai Bertugas
          </button>
        </div>
      </div>
    </div>
  )
}
