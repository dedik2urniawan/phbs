'use client'

import React, { useEffect, useState } from 'react'
import { Target, Users, X, ArrowRight, AlertTriangle, CheckCircle2 } from 'lucide-react'
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
      {/* Backdrop */}
      <div
        className={`absolute inset-0 bg-gray-900/50 backdrop-blur-sm transition-opacity duration-300 ${isVisible ? 'opacity-100' : 'opacity-0'}`}
        onClick={onClose}
      />

      {/* Modal Card */}
      <div
        className={`relative w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden transform transition-all duration-300 ${isVisible ? 'scale-100 opacity-100 translate-y-0' : 'scale-95 opacity-0 translate-y-4'}`}
      >
        {/* Decorative blobs */}
        <div className="absolute top-0 right-0 w-40 h-40 bg-emerald-500/10 rounded-bl-full -mr-16 -mt-16 pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-40 h-40 bg-amber-500/10 rounded-tr-full -ml-16 -mb-16 pointer-events-none" />

        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors z-10"
        >
          <X size={20} />
        </button>

        <div className="p-8 pb-7 relative z-10">
          {/* Header icon */}
          <div className="w-16 h-16 bg-amber-100 text-amber-600 rounded-2xl flex items-center justify-center mb-6 shadow-sm">
            <Target size={32} />
          </div>

          <h2 className="text-2xl font-black text-gray-800 mb-2">Selamat Datang di SIM-PHBS! 👋</h2>
          <p className="text-gray-500 text-sm leading-relaxed mb-6">
            Sebelum memulai pencatatan survei, pastikan dua data awal berikut sudah diisi agar sistem dapat bekerja secara optimal.
          </p>

          {/* Two action cards — Sasaran KK + Kader PHBS */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
            {/* Card 1: Sasaran KK */}
            <Link
              href="/dashboard/sasaran"
              onClick={onClose}
              className="group relative flex flex-col gap-3 p-4 rounded-2xl border-2 border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50 hover:border-amber-400 hover:shadow-md hover:shadow-amber-100 transition-all duration-200"
            >
              <div className="flex items-start justify-between">
                <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shadow-sm shadow-amber-300 flex-shrink-0">
                  <Target size={20} />
                </div>
                <ArrowRight size={16} className="text-amber-400 group-hover:translate-x-1 transition-transform mt-1" />
              </div>
              <div>
                <p className="text-sm font-bold text-gray-800 leading-snug">Input Sasaran KK</p>
                <p className="text-[11px] text-gray-500 mt-0.5 leading-relaxed">
                  Wajib diisi agar <span className="font-semibold text-amber-700">% capaian target</span> survei bisa dihitung.
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                <AlertTriangle size={11} className="text-amber-500 flex-shrink-0" />
                <span className="text-[10px] font-medium text-amber-700">Jika kosong, progress = N/A</span>
              </div>
            </Link>

            {/* Card 2: Kader PHBS */}
            <Link
              href="/dashboard/kader"
              onClick={onClose}
              className="group relative flex flex-col gap-3 p-4 rounded-2xl border-2 border-emerald-200 bg-gradient-to-br from-emerald-50 to-teal-50 hover:border-emerald-400 hover:shadow-md hover:shadow-emerald-100 transition-all duration-200"
            >
              <div className="flex items-start justify-between">
                <div className="w-10 h-10 rounded-xl bg-emerald-500 text-white flex items-center justify-center shadow-sm shadow-emerald-300 flex-shrink-0">
                  <Users size={20} />
                </div>
                <ArrowRight size={16} className="text-emerald-400 group-hover:translate-x-1 transition-transform mt-1" />
              </div>
              <div>
                <p className="text-sm font-bold text-gray-800 leading-snug">Input Kader PHBS</p>
                <p className="text-[11px] text-gray-500 mt-0.5 leading-relaxed">
                  Daftarkan <span className="font-semibold text-emerald-700">kader wilayah</span> sebelum memulai entri survei.
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 size={11} className="text-emerald-500 flex-shrink-0" />
                <span className="text-[10px] font-medium text-emerald-700">Kader wajib terdaftar sebelum survei</span>
              </div>
            </Link>
          </div>

          {/* Warning note */}
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 mb-6">
            <p className="text-xs text-amber-800 font-medium leading-relaxed">
              ⚠️ Jika kedua data di atas belum diisi, beberapa fitur dashboard (Progress Survey, penugasan kader) tidak dapat berfungsi dengan optimal.
            </p>
          </div>

          {/* Footer action */}
          <div className="flex items-center justify-between gap-3">
            <button
              onClick={onClose}
              className="px-5 py-2.5 font-semibold text-gray-500 bg-gray-100 hover:bg-gray-200 hover:text-gray-700 rounded-xl transition-colors text-sm"
            >
              Nanti Saja
            </button>
            <div className="flex items-center gap-2">
              <Link
                href="/dashboard/sasaran"
                onClick={onClose}
                className="flex items-center gap-1.5 px-4 py-2.5 text-sm font-bold text-amber-700 bg-amber-100 hover:bg-amber-200 rounded-xl transition-colors"
              >
                <Target size={15} />
                Sasaran KK
              </Link>
              <Link
                href="/dashboard/kader"
                onClick={onClose}
                className="flex items-center gap-1.5 px-4 py-2.5 text-sm font-bold text-white bg-emerald-500 hover:bg-emerald-600 rounded-xl shadow-md shadow-emerald-500/30 transition-all hover:-translate-y-0.5"
              >
                <Users size={15} />
                Kader PHBS
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
