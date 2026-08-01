'use client'

import { useEffect, useState } from 'react'
import { getDeadLetterCount, retryDeadLetterQueue, getPendingSyncCount, syncToServer, syncReferenceData } from '@/lib/db/sync'
import { AlertTriangle, RefreshCw, CheckCircle } from 'lucide-react'

/**
 * DLQBanner — Banner notifikasi di PWA kader.
 * Tampil di atas halaman Beranda saat ada data di Dead Letter Queue (gagal sync ≥ 5x).
 * Kader bisa tekan "Coba Ulang" untuk reset retries dan kirim ulang ke server.
 */
export default function DLQBanner() {
  const [dlqCount, setDlqCount] = useState(0)
  const [pendingCount, setPendingCount] = useState(0)
  const [isRetrying, setIsRetrying] = useState(false)
  const [retryResult, setRetryResult] = useState<'success' | 'failed' | null>(null)
  const [dismissed, setDismissed] = useState(false)

  // Check DLQ count saat komponen mount
  useEffect(() => {
    const check = async () => {
      const [dlq, pending] = await Promise.all([
        getDeadLetterCount(),
        getPendingSyncCount(),
      ])
      setDlqCount(dlq)
      setPendingCount(pending)
    }
    check()
    // Periksa ulang setiap 60 detik
    const interval = setInterval(check, 60000)
    return () => clearInterval(interval)
  }, [])

  // Sembunyikan banner jika tidak ada DLQ atau sudah di-dismiss
  if (dismissed || dlqCount === 0) return null

  const handleRetry = async () => {
    if (!navigator.onLine) {
      alert('Anda sedang offline. Hubungkan ke internet terlebih dahulu.')
      return
    }

    setIsRetrying(true)
    setRetryResult(null)

    try {
      // Reset semua item DLQ → retries = 0
      const resetCount = await retryDeadLetterQueue()

      // Langsung trigger sync
      const result = await syncToServer()
      await syncReferenceData()

      // Re-check DLQ count setelah retry
      const [newDlq, newPending] = await Promise.all([
        getDeadLetterCount(),
        getPendingSyncCount(),
      ])
      setDlqCount(newDlq)
      setPendingCount(newPending)

      if (result.synced > 0) {
        setRetryResult('success')
        // Auto-dismiss banner jika semua berhasil
        if (newDlq === 0) {
          setTimeout(() => setDismissed(true), 3000)
        }
      } else {
        setRetryResult('failed')
      }
    } catch {
      setRetryResult('failed')
    } finally {
      setIsRetrying(false)
    }
  }

  return (
    <div className="mx-4 mb-3">
      <div className="bg-red-50 border border-red-200 rounded-2xl p-4 shadow-sm">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2 flex-1">
            <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-4 h-4 text-red-600" />
            </div>
            <div>
              <p className="text-sm font-bold text-red-800">
                {dlqCount} Data Gagal Terkirim
              </p>
              <p className="text-xs text-red-600 mt-0.5">
                Data survei/KK sudah disimpan di perangkat, namun gagal dikirim ke server setelah beberapa percobaan.
              </p>
            </div>
          </div>
          {/* Dismiss button */}
          <button
            onClick={() => setDismissed(true)}
            className="text-red-400 hover:text-red-600 text-xs shrink-0 mt-0.5"
            aria-label="Tutup"
          >
            ✕
          </button>
        </div>

        {/* Detail info */}
        <div className="mt-3 bg-white/60 rounded-xl px-3 py-2 text-xs text-red-700 space-y-1">
          <div className="flex justify-between">
            <span>Data gagal kirim:</span>
            <span className="font-bold">{dlqCount} item</span>
          </div>
          {pendingCount > 0 && (
            <div className="flex justify-between">
              <span>Data menunggu kirim:</span>
              <span className="font-bold">{pendingCount} item</span>
            </div>
          )}
          <div className="flex justify-between text-red-500">
            <span>Status koneksi:</span>
            <span className="font-bold">{navigator.onLine ? '🟢 Online' : '🔴 Offline'}</span>
          </div>
        </div>

        {/* Retry result feedback */}
        {retryResult === 'success' && (
          <div className="mt-2 flex items-center gap-2 text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2">
            <CheckCircle className="w-4 h-4 shrink-0" />
            <p className="text-xs font-medium">
              {dlqCount === 0
                ? 'Semua data berhasil terkirim! ✅'
                : `Sebagian data berhasil. Masih ada ${dlqCount} item yang belum terkirim.`}
            </p>
          </div>
        )}
        {retryResult === 'failed' && (
          <div className="mt-2 flex items-center gap-2 text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <p className="text-xs font-medium">
              Pengiriman ulang gagal. Pastikan koneksi internet stabil, lalu coba lagi.
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="mt-3 flex gap-2">
          <button
            onClick={handleRetry}
            disabled={isRetrying || !navigator.onLine}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all ${
              isRetrying || !navigator.onLine
                ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                : 'bg-red-600 text-white hover:bg-red-700 active:scale-95'
            }`}
          >
            <RefreshCw className={`w-4 h-4 ${isRetrying ? 'animate-spin' : ''}`} />
            {isRetrying ? 'Mengirim ulang...' : 'Coba Kirim Ulang'}
          </button>
          <button
            onClick={() => setDismissed(true)}
            className="px-4 py-2.5 rounded-xl text-sm font-medium text-red-600 bg-white border border-red-200 hover:bg-red-50 active:scale-95 transition-all"
          >
            Nanti
          </button>
        </div>

        {/* Help text */}
        <p className="mt-2 text-[10px] text-red-500 text-center">
          Jika masalah terus terjadi, hubungi Admin Puskesmas atau Dinkes untuk bantuan teknis.
        </p>
      </div>
    </div>
  )
}
