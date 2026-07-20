'use client'

import { useState, Suspense } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, useSearchParams } from 'next/navigation'
import { Eye, EyeOff } from 'lucide-react'

function LoginForm() {
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const router       = useRouter()
  const searchParams = useSearchParams()
  const mode = searchParams.get('mode') || 'admin'
  const next = searchParams.get('next') || (mode === 'pwa' ? '/entry' : '/dashboard')
  const supabase = createClient()

  const isPWA = mode === 'pwa'

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true); setError('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError('Email atau password salah.')
      setLoading(false)
    } else {
      // Pengecekan Jadwal Puskesmas (Gatekeeper)
      const { data: userData } = await supabase
        .from('app_users')
        .select('role, ref_puskesmas(is_active)')
        .eq('id', (await supabase.auth.getSession()).data.session?.user.id)
        .single()

      const pkmData = Array.isArray(userData?.ref_puskesmas) ? userData?.ref_puskesmas[0] : userData?.ref_puskesmas

      // Jika bukan superadmin, dan puskesmas dalam status non-aktif (is_active = false)
      if (userData?.role !== 'superadmin' && pkmData?.is_active === false) {
        await supabase.auth.signOut()
        setError('Jadwal survei untuk Puskesmas Anda belum dimulai atau sedang ditutup.')
        setLoading(false)
        return
      }

      router.push(next)
      router.refresh()
    }
  }

  return (
    <div className={`min-h-screen flex items-center justify-center p-4 ${
      isPWA
        ? 'bg-gradient-to-br from-teal-600 via-emerald-700 to-green-800'
        : 'bg-gradient-to-br from-emerald-900 via-teal-800 to-cyan-900'
    }`}>
      {/* Blobs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-white/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-white/10 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-white/15 backdrop-blur rounded-2xl mb-4 border border-white/20 shadow-xl">
            <span className="text-3xl">{isPWA ? '📱' : '🖥️'}</span>
          </div>
          <h1 className="text-2xl font-bold text-white">SIM-PHBS</h1>
          <p className="text-white/70 text-sm mt-1">
            {isPWA ? 'Aplikasi Survei Mobile' : 'Dashboard Admin'}
          </p>
          <p className="text-white/50 text-xs mt-0.5">Kabupaten Malang</p>
        </div>

        <div className="bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 p-6 shadow-2xl">
          <h2 className="text-white text-base font-semibold mb-5">Masuk ke Akun</h2>

          {error && (
            <div className="bg-red-500/20 border border-red-400/40 rounded-xl p-3 mb-4 text-red-200 text-sm flex items-center gap-2">
              <span>⚠️</span> {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-white/80 text-xs font-medium mb-1.5">Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder={isPWA ? 'pkm...@dinkes.go.id' : 'admin@dinkes.go.id'}
                required
                className="w-full bg-white/10 border border-white/30 rounded-xl px-4 py-3 text-white placeholder-white/40 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-white/80 text-xs font-medium mb-1.5">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full bg-white/10 border border-white/30 rounded-xl pl-4 pr-10 py-3 text-white placeholder-white/40 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-transparent"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/50 hover:text-white/90 transition-colors"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-emerald-500 hover:bg-emerald-400 disabled:bg-emerald-500/50 text-white font-semibold py-3 rounded-xl transition-all shadow-lg shadow-emerald-500/30 flex items-center justify-center gap-2 mt-1"
            >
              {loading ? (
                <><svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                </svg> Memproses...</>
              ) : 'Masuk'}
            </button>
          </form>

          {/* Link ke mode lain */}
          <div className="mt-4 text-center">
            <a
              href={isPWA ? '/login?mode=admin' : '/login?mode=pwa'}
              className="text-white/50 hover:text-white/80 text-xs transition-colors"
            >
              {isPWA ? '→ Masuk ke Dashboard Admin' : '→ Masuk ke Aplikasi Survei'}
            </a>
          </div>
        </div>

        <p className="text-center text-white/30 text-xs mt-5">
          © 2026 Dinas Kesehatan Kabupaten Malang
        </p>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-emerald-900"/>}>
      <LoginForm />
    </Suspense>
  )
}
