import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import UsersClient from './UsersClient'

export default async function UsersPage() {
  const supabase = await createClient()
  
  const { data: { session } } = await supabase.auth.getSession()
  const user = session?.user
  if (!user) redirect('/login?mode=admin')

  // Ambil profil caller
  const { data: appUser } = await supabase
    .from('app_users')
    .select('*, ref_puskesmas(nama, kecamatan)')
    .eq('id', user.id)
    .single()

  // Karena RLS aktif, query ini secara otomatis:
  // - Mengembalikan semua 39 baris jika superadmin
  // - Mengembalikan 1 baris (milik sendiri) jika admin_puskesmas
  const { data: usersData } = await supabase
    .from('app_users')
    .select('id, email, role, nama_lengkap, ref_puskesmas(nama)')
    .neq('role', 'stakeholder') // Opsional: Sembunyikan stakeholder jika tidak relevan
    .order('role', { ascending: false })

  const formattedUsers = (usersData || []).map((u: any) => ({
    ...u,
    puskesmas_nama: Array.isArray(u.ref_puskesmas) 
      ? u.ref_puskesmas[0]?.nama 
      : u.ref_puskesmas?.nama || 'Dinkes Kab. Malang'
  }))

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-black text-gray-800">Manajemen Akses & Password</h1>
        <p className="text-gray-500 text-sm mt-1">
          {appUser?.role === 'superadmin' 
            ? 'Kelola kredensial dan kata sandi untuk seluruh Puskesmas.' 
            : 'Kelola keamanan dan pembaruan kata sandi akun Puskesmas Anda.'}
        </p>
      </div>

      <UsersClient 
        users={formattedUsers} 
        isSuperAdmin={appUser?.role === 'superadmin'} 
      />
    </div>
  )
}
