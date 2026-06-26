'use client'

import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import SyncStatusBar from '@/components/SyncStatusBar'
import SopModal from '@/components/SopModal'

interface Household {
  id: string; no_kk: string; nama_kk: string; created_at: string
  ref_desa: { desa_kel: string } | null
}
interface AppUser {
  id: string; email: string; role: string; puskesmas_id: string
  ref_puskesmas: { id: string; nama: string; kecamatan: string } | null
}

interface Props {
  appUser: AppUser
  recentHouseholds: Household[]
  totalKK: number
  surveyCount: number
}

export default function EntryHomeClient({ appUser, recentHouseholds, totalKK, surveyCount }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const isSuperAdmin = appUser?.role === 'superadmin'
  const pkmName = isSuperAdmin ? 'Dinas Kesehatan' : `Puskesmas ${appUser?.ref_puskesmas?.nama || ''}`.trim()
  const year = new Date().getFullYear()

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login?mode=pwa')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <SopModal />
      {/* Header */}
      <div className="bg-gradient-to-r from-emerald-700 to-teal-700 px-4 pt-6 pb-10 text-white">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-emerald-200 text-xs">Survei PHBS {year}</p>
            <h1 className="text-lg font-bold truncate max-w-[200px]">{pkmName}</h1>
          </div>
          <div className="flex items-center gap-2">
            <SyncStatusBar />
            <button onClick={handleLogout} className="text-white/60 hover:text-white text-xs px-2 py-1 rounded-lg border border-white/20">
              Keluar
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: 'Total KK', value: totalKK.toLocaleString('id'), icon: '🏠' },
            { label: `Disurvei ${year}`, value: surveyCount.toLocaleString('id'), icon: '📋' },
          ].map(s => (
            <div key={s.label} className="bg-white/15 backdrop-blur rounded-xl p-3">
              <span className="text-2xl">{s.icon}</span>
              <p className="text-2xl font-bold mt-1">{s.value}</p>
              <p className="text-emerald-200 text-xs">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Content — overlap dengan header */}
      <div className="px-4 -mt-4">
        {/* Quick Actions */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 mb-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Aksi Cepat</p>
          <div className="grid grid-cols-2 gap-3">
            <Link href="/entry/households/new" prefetch={true}
              className="flex flex-col items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-xl p-4 hover:bg-emerald-100 active:scale-95 transition-all">
              <span className="text-3xl">🏠</span>
              <span className="text-sm font-medium text-emerald-800 text-center">Tambah KK Baru</span>
            </Link>
            <Link href="/entry/survey/new" prefetch={true}
              className="flex flex-col items-center gap-2 bg-blue-50 border border-blue-200 rounded-xl p-4 hover:bg-blue-100 active:scale-95 transition-all">
              <span className="text-3xl">📋</span>
              <span className="text-sm font-medium text-blue-800 text-center">Input Survei PHBS</span>
            </Link>
          </div>
        </div>

        {/* Recent Households */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">KK Terbaru</p>
            <Link href="/entry/households" prefetch={true} className="text-xs text-emerald-600 font-medium">Lihat Semua →</Link>
          </div>

          {recentHouseholds.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-400 text-sm">Belum ada data KK</p>
              <Link href="/entry/households/new" prefetch={true}
                className="mt-3 inline-block bg-emerald-600 text-white text-sm px-4 py-2 rounded-xl font-medium">
                + Tambah Sekarang
              </Link>
            </div>
          ) : (
            <div className="space-y-2">
              {recentHouseholds.map(h => (
                <div key={h.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-800 text-sm truncate">{h.nama_kk}</p>
                    <p className="text-gray-400 text-xs">{h.ref_desa?.desa_kel} · {h.no_kk}</p>
                  </div>
                  <Link href={`/entry/survey/new?household_id=${h.id}`}
                    className="shrink-0 text-xs bg-blue-100 text-blue-700 px-3 py-1.5 rounded-lg font-medium ml-2">
                    Survei
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer Credit */}
        <div className="mt-12 mb-8 text-center px-6">
          <p className="text-[10px] text-gray-400">© 2026 Dinas Kesehatan Kabupaten Malang</p>
          <p className="text-[10px] text-gray-400 mt-1">
            Crafted with <span className="text-red-400">♥</span> by{' '}
            <a href="https://dedik2urniawan.github.io/" target="_blank" rel="noopener noreferrer" className="text-emerald-600 font-bold">DK</a>
          </p>
        </div>
      </div>
    </div>
  )
}
