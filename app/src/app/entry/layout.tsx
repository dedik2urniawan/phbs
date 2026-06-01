import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'

export default async function EntryLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?mode=pwa')

  return (
    <div className="min-h-screen bg-gray-50 pb-20 max-w-md mx-auto relative">
      {children}
      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md bg-white border-t border-gray-200 z-50 safe-bottom">
        <div className="flex">
          {[
            { href: '/entry', icon: '🏠', label: 'Beranda' },
            { href: '/entry/households/new', icon: '➕', label: 'Tambah KK' },
            { href: '/entry/survey/new', icon: '📋', label: 'Survei' },
            { href: '/entry/profile', icon: '👤', label: 'Profil' },
          ].map(item => (
            <Link key={item.href} href={item.href}
              className="flex-1 flex flex-col items-center justify-center py-3 gap-0.5 text-gray-400 hover:text-emerald-600 transition-colors active:scale-95">
              <span className="text-xl leading-none">{item.icon}</span>
              <span className="text-xs font-medium">{item.label}</span>
            </Link>
          ))}
        </div>
      </nav>
    </div>
  )
}
