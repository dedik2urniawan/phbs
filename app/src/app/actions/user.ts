'use server'

import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

export async function updateUserPassword(targetUserId: string, newPassword: string) {
  try {
    // 1. Verifikasi Sesi Pemanggil (Siapa yang sedang login?)
    const supabaseClient = await createClient()
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser()
    
    if (authError || !user) {
      throw new Error('Tidak memiliki akses (Sesi tidak valid)')
    }

    // 2. Cek Role Pemanggil
    const { data: callerProfile } = await supabaseClient
      .from('app_users')
      .select('role')
      .eq('id', user.id)
      .single()

    const isSuperAdmin = callerProfile?.role === 'superadmin'
    const isAdminPuskesmas = callerProfile?.role === 'admin_puskesmas'

    // 3. Validasi Otorisasi
    // Superadmin boleh ganti siapapun. Admin Puskesmas HANYA boleh ganti miliknya sendiri.
    if (!isSuperAdmin) {
      if (!isAdminPuskesmas || user.id !== targetUserId) {
         throw new Error('Akses Ditolak: Anda hanya dapat mengganti password akun Anda sendiri.')
      }
    }

    // 4. Inisialisasi Supabase Admin API (Bypass RLS, Khusus Server)
    const supabaseAdmin = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // 5. Eksekusi Perubahan Password
    const { data, error } = await supabaseAdmin.auth.admin.updateUserById(
      targetUserId,
      { password: newPassword }
    )

    if (error) {
      throw new Error(`Gagal mengubah password: ${error.message}`)
    }

    return { success: true, message: 'Password berhasil diperbarui!' }

  } catch (error: any) {
    console.error('Error updating password:', error)
    return { success: false, message: error.message || 'Terjadi kesalahan sistem.' }
  }
}
