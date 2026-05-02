import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import DashboardSidebar from '@/components/DashboardSidebar'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?mode=admin')

  const { data: appUser } = await supabase
    .from('app_users')
    .select('*, ref_puskesmas(id, nama, kecamatan)')
    .eq('id', user.id)
    .single()

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <DashboardSidebar user={appUser as any} />
      <div className="flex-1 ml-64 flex flex-col min-h-screen">
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
