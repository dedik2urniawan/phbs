'use client'

import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

interface AppUser {
  id: string; email: string; role: string; puskesmas_id: string
  ref_puskesmas: { id: string; nama: string; kecamatan: string } | null
}
interface Props { appUser: AppUser; totalKK: number; totalSurvey: number }

export default function ProfileClient({ appUser, totalKK, totalSurvey }: Props) {
  const router = useRouter()
  const supabase = createClient()

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut()
    } catch (err) {
      console.error('Logout error:', err)
    }
    window.location.href = '/login?mode=pwa'
  }

  const isSuperAdmin = appUser?.role === 'superadmin'
  const pkmName = isSuperAdmin ? 'Dinas Kesehatan' : `Puskesmas ${appUser?.ref_puskesmas?.nama || ''}`.trim()
  const roleLabel = isSuperAdmin ? 'Superadmin Dinkes' : 'Admin Puskesmas'
  const year = new Date().getFullYear()

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <h1 className="text-lg font-bold text-gray-800 mb-5">Profil</h1>

      {/* User Card */}
      <div className="bg-gradient-to-r from-emerald-600 to-teal-600 rounded-2xl p-5 text-white mb-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-white/20 rounded-full flex items-center justify-center text-2xl font-bold">
            {appUser?.email?.charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="font-bold text-lg">{pkmName}</p>
            <p className="text-emerald-200 text-sm">{appUser?.email}</p>
            <span className="bg-white/20 text-xs px-2 py-0.5 rounded-full mt-1 inline-block">
              {roleLabel}
            </span>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-white rounded-xl border border-gray-100 p-4 text-center">
          <p className="text-3xl font-bold text-emerald-600">{totalKK}</p>
          <p className="text-xs text-gray-500 mt-1">Total KK Terdaftar</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-4 text-center">
          <p className="text-3xl font-bold text-blue-600">{totalSurvey}</p>
          <p className="text-xs text-gray-500 mt-1">Survei {year}</p>
        </div>
      </div>

      {/* Actions */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <a href="/dashboard" target="_blank"
          className="flex items-center gap-3 px-4 py-3.5 border-b border-gray-100 hover:bg-gray-50 transition-colors">
          <span className="text-xl">🖥️</span>
          <div className="flex-1">
            <p className="text-sm font-medium text-gray-700">Buka Dashboard Admin</p>
            <p className="text-xs text-gray-400">Laporan & analisis lengkap</p>
          </div>
          <span className="text-gray-300">→</span>
        </a>
        <button onClick={handleLogout}
          className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-red-50 transition-colors text-left">
          <span className="text-xl">🚪</span>
          <p className="text-sm font-medium text-red-600">Keluar</p>
        </button>
      </div>

      <p className="text-center text-gray-300 text-xs mt-6">
        SIM-PHBS v2.0 · Dinkes Kab. Malang {year}
      </p>
    </div>
  )
}
