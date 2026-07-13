'use client'

import { useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const supabase = createClient()

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      // Jika session mati atau terhapus, pastikan kita tendang ke halaman login.
      if (event === 'SIGNED_OUT' || event === 'USER_DELETED') {
        // Jangan loop jika sudah di halaman login
        if (pathname && !pathname.startsWith('/login')) {
          router.push('/login?session=expired')
        }
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [supabase, router, pathname])

  return <>{children}</>
}
