'use client'

import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Lock, ArrowRight, ShieldCheck } from 'lucide-react'

function ViewerLoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const nextPath = searchParams.get('next') || '/dashboard/reports/analysis'

  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/viewer-auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      })
      const data = await res.json()
      if (!res.ok || !data.ok) {
        setError(data.message || 'Kode akses salah')
        setLoading(false)
        return
      }
      router.push(nextPath)
      router.refresh()
    } catch {
      setError('Gagal memverifikasi kode akses')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-950 via-teal-900 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl p-8 border border-emerald-100">
        <div className="flex items-center justify-center gap-3 mb-6">
          <img src="/KAB.png" alt="Kabupaten Malang" className="h-12 w-auto object-contain" />
          <img src="/GERMAS.png" alt="GERMAS" className="h-10 w-auto object-contain" />
          <img src="/promkes.png" alt="Promkes" className="h-11 w-auto object-contain" />
        </div>

        <div className="text-center mb-6">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-bold uppercase tracking-wider mb-3">
            <ShieldCheck className="w-3.5 h-3.5" /> Mode Paparan Terbatas
          </span>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard Analisis PHBS 2026</h1>
          <p className="text-sm text-gray-500 mt-1">
            Kabupaten Malang — Snapshot Data 28 September 2026
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="access-code" className="block text-sm font-semibold text-gray-700 mb-1.5">
              Kode Akses Paparan
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                id="access-code"
                type="password"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="Masukkan kode akses..."
                required
                autoFocus
                className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-300 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-200 outline-none text-gray-900 transition-all"
              />
            </div>
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm font-medium">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white font-semibold flex items-center justify-center gap-2 transition-colors shadow-lg shadow-emerald-600/20"
          >
            {loading ? 'Memverifikasi...' : 'Buka Dashboard Paparan'}
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        <div className="mt-6 pt-5 border-t border-gray-100 text-center text-xs text-gray-400">
          Dinas Kesehatan Kabupaten Malang • Read-Only Presentation Build
        </div>
      </div>
    </div>
  )
}

export default function ViewerLoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-emerald-950" />}>
      <ViewerLoginForm />
    </Suspense>
  )
}
