'use client'

import React, { useEffect, useState } from 'react'
import { Target, X, ArrowRight } from 'lucide-react'
import Link from 'next/link'

interface Props {
  isOpen: boolean
  onClose: () => void
}

export default function WelcomeReminderModal({ isOpen, onClose }: Props) {
  const [isVisible, setIsVisible] = useState(false)
  const [shouldRender, setShouldRender] = useState(false)

  useEffect(() => {
    if (isOpen) {
      setShouldRender(true)
      const timer = setTimeout(() => setIsVisible(true), 10)
      return () => clearTimeout(timer)
    } else {
      setIsVisible(false)
      const timer = setTimeout(() => setShouldRender(false), 300)
      return () => clearTimeout(timer)
    }
  }, [isOpen])

  if (!shouldRender) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
      <div 
        className={`absolute inset-0 bg-gray-900/40 backdrop-blur-sm transition-opacity duration-300 ${isVisible ? 'opacity-100' : 'opacity-0'}`}
        onClick={onClose}
      />
      
      <div 
        className={`relative w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden transform transition-all duration-300 ${isVisible ? 'scale-100 opacity-100 translate-y-0' : 'scale-95 opacity-0 translate-y-4'}`}
      >
        <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-bl-full -mr-12 -mt-12"></div>
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-amber-500/10 rounded-tr-full -ml-12 -mb-12"></div>
        
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors z-10"
        >
          <X size={20} />
        </button>

        <div className="p-8 pb-6 relative z-10">
          <div className="w-16 h-16 bg-amber-100 text-amber-600 rounded-2xl flex items-center justify-center mb-6 shadow-sm">
            <Target size={32} />
          </div>
          
          <h2 className="text-2xl font-black text-gray-800 mb-3">Selamat Datang di SIM-PHBS! 👋</h2>
          <p className="text-gray-600 mb-6 leading-relaxed">
            Sebelum memulai pencatatan data survei rumah tangga, pastikan Anda telah mengisi <strong className="text-gray-900">Input Sasaran KK</strong> terlebih dahulu. Data sasaran ini sangat penting untuk menghitung persentase capaian target survei di wilayah Anda.
          </p>
          
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-8">
            <p className="text-sm text-amber-800 font-medium">
              ⚠️ Jika sasaran belum diisi, persentase kemajuan survei (Progress Survey) tidak dapat dihitung dan akan tampil sebagai <span className="font-bold">N/A</span>.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-3">
            <button 
              onClick={onClose}
              className="w-full sm:w-auto px-6 py-3 font-semibold text-gray-500 bg-gray-50 hover:bg-gray-100 hover:text-gray-700 rounded-xl transition-colors"
            >
              Nanti Saja
            </button>
            <Link 
              href="/dashboard/sasaran"
              onClick={onClose}
              className="w-full sm:w-auto flex-1 flex items-center justify-center gap-2 px-6 py-3 font-bold text-white bg-emerald-500 hover:bg-emerald-600 rounded-xl shadow-lg shadow-emerald-500/30 transition-all hover:-translate-y-0.5"
            >
              Isi Sasaran KK Sekarang
              <ArrowRight size={18} />
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
