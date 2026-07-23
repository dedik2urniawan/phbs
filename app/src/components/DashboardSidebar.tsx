'use client'

import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import { AppUser } from '@/lib/types'
import { ChevronLeft, ChevronRight, Menu } from 'lucide-react'
import LogoutModal from '@/components/LogoutModal'
import { useState } from 'react'

interface Props {
  user: any
  isCollapsed: boolean
  onToggle: () => void
}

export default function DashboardSidebar({ user, isCollapsed, onToggle }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const supabase = createClient()
  const [showLogoutModal, setShowLogoutModal] = useState(false)

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login?mode=admin')
    router.refresh()
  }

  const roles: Record<string, string> = {
    superadmin: 'Super Admin',
    admin_puskesmas: 'Admin Puskesmas',
    stakeholder: 'Stakeholder',
  }
  const roleLabel = roles[user?.role as string] || 'Stakeholder'

  const isSuperAdmin = user?.role === 'superadmin'
  const isPkmInactive = !isSuperAdmin && user?.ref_puskesmas?.is_active === false
  const puskesmasName = isSuperAdmin ? 'Dinkes Kab. Malang' : `Puskesmas ${user?.ref_puskesmas?.nama || ''}`.trim()

  const menuItems = [
    { icon: '📊', label: 'Dashboard', href: '/dashboard' },
    { icon: '🏠', label: 'Data Rumah Tangga', href: '/dashboard/households' },
    { icon: '📋', label: 'Input Survei', href: '/dashboard/survey/new' },
    { icon: '📑', label: 'Rekap Laporan PHBS', href: '/dashboard/reports/rekap' },
    { icon: '📈', label: 'Analisis Laporan', href: '/dashboard/reports/analysis' },
  ]

  if (isSuperAdmin || user?.role === 'admin_puskesmas') {
    menuItems.push({ icon: '🎯', label: 'Input Sasaran KK', href: '/dashboard/sasaran' })
    menuItems.push({ icon: '🏷️', label: 'Input Kader PHBS', href: '/dashboard/kader' })
  }

  if (isSuperAdmin || user?.role === 'admin_puskesmas') {
    menuItems.push({ icon: '👥', label: 'Manajemen User', href: '/dashboard/users' })
  }

  if (isSuperAdmin) {
    menuItems.push({ icon: '🗓️', label: 'Manajemen Jadwal', href: '/dashboard/schedule' })
  }

  return (
    <div className={`fixed inset-y-0 left-0 transition-all duration-300 bg-gradient-to-b from-emerald-900 to-teal-800 shadow-xl z-50 flex flex-col ${isCollapsed ? 'w-20' : 'w-64'}`}>
      <div className="p-4 border-b border-white/10 flex items-center justify-between">
        {!isCollapsed && (
          <div className="flex items-center gap-3 overflow-hidden whitespace-nowrap">
            <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center text-xl shrink-0">🏥</div>
            <div>
              <h1 className="text-white font-bold text-sm">SIM-PHBS</h1>
              <p className="text-emerald-300 text-[10px]">Kab. Malang</p>
            </div>
          </div>
        )}
        {isCollapsed && (
          <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center text-xl shrink-0 mx-auto">🏥</div>
        )}
        <button 
          onClick={onToggle}
          className={`text-white/70 hover:text-white p-1 rounded hover:bg-white/10 transition-colors ${isCollapsed ? 'absolute -right-3 top-6 bg-teal-800 rounded-full shadow border border-white/10' : ''}`}
        >
          {isCollapsed ? <ChevronRight size={16} /> : <Menu size={20} />}
        </button>
      </div>

      <nav className="p-3 flex-1 overflow-y-auto space-y-1">
        {menuItems.map((item) => {
          const isSurveyOrHousehold = item.href === '/dashboard/households' || item.href === '/dashboard/survey/new'
          const isDisabled = isPkmInactive && isSurveyOrHousehold
          const isActive = item.href === '/dashboard' ? pathname === '/dashboard' : pathname?.startsWith(item.href)

          if (isDisabled) {
            return (
              <div
                key={item.href}
                title={isCollapsed ? `${item.label} (Jadwal Ditutup)` : 'Jadwal survei sedang ditutup'}
                onClick={() => alert('Kegiatan survei PHBS untuk Puskesmas Anda sedang ditutup sementara oleh Dinas Kesehatan.')}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium opacity-50 cursor-not-allowed bg-black/10 text-white/50 ${
                  isCollapsed ? 'justify-center' : ''
                }`}
              >
                <span className="text-lg">🔒</span>
                {!isCollapsed && (
                  <span className="whitespace-nowrap flex items-center justify-between flex-1">
                    <span>{item.label}</span>
                    <span className="text-[10px] bg-red-500/30 text-red-200 px-1.5 py-0.5 rounded font-mono">TUTUP</span>
                  </span>
                )}
              </div>
            )
          }

          return (
            <Link
              key={item.href}
              href={item.href}
              title={isCollapsed ? item.label : undefined}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                isActive
                  ? 'bg-white/20 text-white'
                  : 'text-white/70 hover:bg-white/10 hover:text-white'
              } ${isCollapsed ? 'justify-center' : ''}`}
            >
              <span className="text-lg">{item.icon}</span>
              {!isCollapsed && <span className="whitespace-nowrap">{item.label}</span>}
            </Link>
          )
        })}

      </nav>

      <div className="p-4 border-t border-white/10">
        {!isCollapsed && (
          <div className="flex items-center gap-3 mb-3 overflow-hidden">
            <div className="w-8 h-8 bg-emerald-400 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0">
              {user?.email?.charAt(0).toUpperCase() || 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white text-xs font-medium truncate" title={puskesmasName}>{puskesmasName}</p>
              <p className="text-emerald-300 text-[10px]">{roleLabel}</p>
            </div>
          </div>
        )}
        {isCollapsed && (
           <div className="w-8 h-8 bg-emerald-400 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0 mx-auto mb-3" title={puskesmasName}>
             {user?.email?.charAt(0).toUpperCase() || 'U'}
           </div>
        )}
        <button
          onClick={() => setShowLogoutModal(true)}
          title={isCollapsed ? "Keluar" : undefined}
          className={`w-full text-white/70 hover:text-white text-xs py-2 rounded-lg hover:bg-white/10 transition-all flex items-center justify-center gap-2 ${isCollapsed ? 'px-0' : ''}`}
        >
          <span className="text-lg">🚪</span>
          {!isCollapsed && <span>Keluar</span>}
        </button>
      </div>

      <LogoutModal 
        isOpen={showLogoutModal} 
        onClose={() => setShowLogoutModal(false)} 
        onConfirm={() => {
          setShowLogoutModal(false)
          handleLogout()
        }}
      />
    </div>
  )
}
