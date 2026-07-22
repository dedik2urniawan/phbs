'use client'

import React, { useState, useEffect, useRef } from 'react'
import DashboardSidebar from '@/components/DashboardSidebar'
import { AppUser } from '@/lib/types'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function DashboardLayoutWrapper({
  children,
  user
}: {
  children: React.ReactNode
  user: any
}) {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)
  const router = useRouter()
  const supabase = createClient()
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)

  const resetTimeout = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    // 10 minutes timeout = 10 * 60 * 1000 = 600000 ms
    timeoutRef.current = setTimeout(async () => {
      await supabase.auth.signOut()
      router.push('/login?mode=admin&session=expired')
    }, 600000)
  }

  useEffect(() => {
    // Set initial timeout
    resetTimeout()

    const events = ['mousemove', 'keydown', 'scroll', 'touchstart', 'click']
    events.forEach(event => window.addEventListener(event, resetTimeout))

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
      events.forEach(event => window.removeEventListener(event, resetTimeout))
    }
  }, [router, supabase])

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
