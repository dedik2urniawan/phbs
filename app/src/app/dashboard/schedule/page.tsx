import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import ScheduleClient from './ScheduleClient'

export const metadata = {
  title: 'Manajemen Jadwal | SIM-PHBS',
}

export default async function SchedulePage() {
  const supabase = await createClient()
  
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) {
    redirect('/login?mode=admin')
  }

  // Cek apakah user adalah superadmin
  const { data: appUser } = await supabase
    .from('app_users')
    .select('role')
    .eq('id', session.user.id)
    .single()

  if (appUser?.role !== 'superadmin') {
    redirect('/dashboard') // Tolak akses jika bukan superadmin
  }

  // Ambil semua data Puskesmas
  const { data: puskesmasList } = await supabase
    .from('ref_puskesmas')
    .select('id, nama, kecamatan, is_active')
    .order('nama', { ascending: true })

  return (
    <ScheduleClient initialData={puskesmasList || []} />
  )
}
