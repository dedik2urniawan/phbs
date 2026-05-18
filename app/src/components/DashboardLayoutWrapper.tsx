'use client'

import React, { useState } from 'react'
import DashboardSidebar from '@/components/DashboardSidebar'
import { AppUser } from '@/lib/types'

export default function DashboardLayoutWrapper({
  children,
  user
}: {
  children: React.ReactNode
  user: AppUser & { ref_puskesmas?: { nama: string; kecamatan: string } | null }
}) {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <DashboardSidebar 
        user={user} 
        isCollapsed={isSidebarCollapsed} 
        onToggle={() => setIsSidebarCollapsed(!isSidebarCollapsed)} 
      />
      <div 
        className={`flex-1 flex flex-col min-h-screen transition-all duration-300 ${
          isSidebarCollapsed ? 'ml-20' : 'ml-64'
        }`}
      >
        <main className="flex-1 overflow-x-hidden">
          {children}
        </main>
        <footer className="px-8 py-6 border-t border-gray-100 bg-white text-gray-400 text-[10px] flex justify-between items-center">
          <p>© 2026 Dinas Kesehatan Kabupaten Malang</p>
          <p>
            Crafted with <span className="text-red-400">♥</span> by{' '}
            <a href="https://dedik2urniawan.github.io/" target="_blank" rel="noopener noreferrer" className="text-emerald-600 font-bold hover:underline">DK</a>
          </p>
        </footer>
      </div>
    </div>
  )
}
