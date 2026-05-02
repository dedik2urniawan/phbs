'use client'

import { createClient } from '@/lib/supabase/client'
import { useRouter, usePathname } from 'next/navigation'
import { AppUser } from '@/lib/types'

interface Props {
  user: AppUser & { ref_puskesmas?: { nama: string; kecamatan: string } | null }
}

export default function DashboardSidebar({ user }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const supabase = createClient()

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login?mode=admin')
    router.refresh()
  }

  const roleLabel = {
    superadmin: 'Super Admin',
    admin_puskesmas: 'Admin Puskesmas',
    stakeholder: 'Stakeholder',
  }[user?.role || 'stakeholder']

  const isSuperAdmin = user?.role === 'superadmin'
  const puskesmasName = isSuperAdmin ? 'Dinkes Kab. Malang' : `Puskesmas ${user?.ref_puskesmas?.nama || ''}`.trim()

  const menuItems = [
    { icon: '📊', label: 'Dashboard', href: '/dashboard' },
    { icon: '🏠', label: 'Data Rumah Tangga', href: '/dashboard/households' },
    { icon: '📋', label: 'Input Survei', href: '/dashboard/survey/new' },
    { icon: '📈', label: 'Laporan & Analisis', href: '/dashboard/reports' },
    ...(isSuperAdmin ? [
      { icon: '👥', label: 'Manajemen User', href: '/dashboard/users' },
    ] : []),
  ]

  return (
    <div className="fixed inset-y-0 left-0 w-64 bg-gradient-to-b from-emerald-900 to-teal-800 shadow-xl z-50">
      <div className="p-6 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center text-xl">🏥</div>
          <div>
            <h1 className="text-white font-bold text-sm">SIM-PHBS</h1>
            <p className="text-emerald-300 text-xs">Kab. Malang</p>
          </div>
        </div>
      </div>

      <nav className="p-4 space-y-1">
        {menuItems.map((item) => {
          const isActive = item.href === '/dashboard' ? pathname === '/dashboard' : pathname?.startsWith(item.href)
          
          return (
            <a
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                isActive
                  ? 'bg-white/20 text-white'
                  : 'text-white/70 hover:bg-white/10 hover:text-white'
              }`}
            >
              <span>{item.icon}</span>
              {item.label}
            </a>
          )
        })}
      </nav>

      <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-white/10">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-8 h-8 bg-emerald-400 rounded-full flex items-center justify-center text-sm font-bold text-white">
            {user?.email?.charAt(0).toUpperCase() || 'U'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white text-xs font-medium truncate" title={puskesmasName}>{puskesmasName}</p>
            <p className="text-emerald-300 text-xs">{roleLabel}</p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="w-full text-white/70 hover:text-white text-xs py-2 rounded-lg hover:bg-white/10 transition-all flex items-center justify-center gap-2"
        >
          <span>🚪</span> Keluar
        </button>
      </div>
    </div>
  )
}
