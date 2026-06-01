'use client'

import { useState } from 'react'
import { updateUserPassword } from '@/app/actions/user'

interface UserData {
  id: string
  email: string
  role: string
  nama_lengkap: string | null
  puskesmas_nama: string
}

export default function UsersClient({ users, isSuperAdmin }: { users: UserData[], isSuperAdmin: boolean }) {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selectedUser, setSelectedUser] = useState<UserData | null>(null)
  
  const [newPassword, setNewPassword] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [toast, setToast] = useState<{ message: string, type: 'success' | 'error' } | null>(null)

  // Password Validators
  const isValidLength = newPassword.length >= 8
  const hasUpperCase = /[A-Z]/.test(newPassword)
  const hasNumber = /[0-9]/.test(newPassword)
  const hasSpecialChar = /[^A-Za-z0-9]/.test(newPassword)
  const isPasswordValid = isValidLength && hasUpperCase && hasNumber && hasSpecialChar

  const openModal = (user: UserData) => {
    setSelectedUser(user)
    setNewPassword('')
    setIsModalOpen(true)
  }

  const closeModal = () => {
    setIsModalOpen(false)
    setSelectedUser(null)
  }

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedUser || !isPasswordValid) return

    setIsSubmitting(true)
    setToast(null)

    const result = await updateUserPassword(selectedUser.id, newPassword)

    if (result.success) {
      setToast({ message: result.message, type: 'success' })
      setTimeout(() => {
        setToast(null)
        closeModal()
      }, 2000)
    } else {
      setToast({ message: result.message, type: 'error' })
    }

    setIsSubmitting(false)
  }

  return (
    <>
      {/* Kartu Tabel Modern */}
      <div className="bg-white rounded-3xl border border-gray-100 shadow-xl shadow-emerald-900/5 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50/50 text-gray-500 text-xs uppercase tracking-wider font-semibold">
                <th className="p-5 font-bold">Role & Pengguna</th>
                <th className="p-5 font-bold">Email / Username</th>
                <th className="p-5 font-bold">Wilayah Puskesmas</th>
                <th className="p-5 text-right font-bold">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {users.map((user) => (
                <tr key={user.id} className="hover:bg-emerald-50/30 transition-colors group">
                  <td className="p-5">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm shrink-0 ${
                        user.role === 'superadmin' ? 'bg-purple-100 text-purple-700' : 'bg-emerald-100 text-emerald-700'
                      }`}>
                        {user.role === 'superadmin' ? '👑' : '🏥'}
                      </div>
                      <div>
                        <p className="font-bold text-gray-800 text-sm">
                          {user.role === 'superadmin' ? 'Super Administrator' : 'Admin Puskesmas'}
                        </p>
                        <p className="text-xs text-gray-400 font-medium">ID: {user.id.substring(0,8)}...</p>
                      </div>
                    </div>
                  </td>
                  <td className="p-5 text-sm font-medium text-gray-600">
                    {user.email}
                  </td>
                  <td className="p-5">
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-700">
                      {user.puskesmas_nama}
                    </span>
                  </td>
                  <td className="p-5 text-right">
                    <button 
                      onClick={() => openModal(user)}
                      className="opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-all bg-white border border-gray-200 hover:border-emerald-500 hover:text-emerald-600 text-gray-600 text-xs px-4 py-2 rounded-xl font-bold shadow-sm"
                    >
                      🔑 Ganti Password
                    </button>
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td colSpan={4} className="p-12 text-center text-gray-400">
                    Tidak ada data pengguna ditemukan.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Glassmorphism */}
      {isModalOpen && selectedUser && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm" onClick={closeModal}></div>
          <div className="relative bg-white rounded-[2rem] shadow-2xl w-full max-w-md p-8 transform transition-all animate-in zoom-in-95 duration-200">
            <button onClick={closeModal} className="absolute top-6 right-6 text-gray-400 hover:text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-full w-8 h-8 flex items-center justify-center transition-colors">
              ✕
            </button>
            
            <div className="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center text-2xl mb-5">
              🔐
            </div>
            
            <h3 className="text-xl font-black text-gray-800 mb-1">Ganti Password</h3>
            <p className="text-sm text-gray-500 mb-6">
              Mengubah kata sandi akses untuk <span className="font-bold text-gray-700">{selectedUser.email}</span>
            </p>

            {toast && (
              <div className={`mb-5 p-4 rounded-xl text-sm font-semibold flex items-center gap-2 ${
                toast.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'
              }`}>
                <span>{toast.type === 'success' ? '✅' : '⚠️'}</span>
                {toast.message}
              </div>
            )}

            <form onSubmit={handleUpdatePassword}>
              <div className="space-y-4 mb-8">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-2 uppercase tracking-wide">Kata Sandi Baru</label>
                  <input 
                    type="password" 
                    required 
                    minLength={8}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Masukkan kata sandi yang kuat..."
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-900 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all outline-none font-medium"
                  />
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <div className={`flex items-center gap-2 text-[11px] font-medium transition-colors ${isValidLength ? 'text-emerald-600' : 'text-gray-400'}`}>
                      <span className={`w-4 h-4 flex items-center justify-center rounded-full ${isValidLength ? 'bg-emerald-100' : 'bg-gray-100'}`}>{isValidLength ? '✓' : '○'}</span> 
                      Minimal 8 Karakter
                    </div>
                    <div className={`flex items-center gap-2 text-[11px] font-medium transition-colors ${hasUpperCase ? 'text-emerald-600' : 'text-gray-400'}`}>
                      <span className={`w-4 h-4 flex items-center justify-center rounded-full ${hasUpperCase ? 'bg-emerald-100' : 'bg-gray-100'}`}>{hasUpperCase ? '✓' : '○'}</span> 
                      Huruf Besar (A-Z)
                    </div>
                    <div className={`flex items-center gap-2 text-[11px] font-medium transition-colors ${hasNumber ? 'text-emerald-600' : 'text-gray-400'}`}>
                      <span className={`w-4 h-4 flex items-center justify-center rounded-full ${hasNumber ? 'bg-emerald-100' : 'bg-gray-100'}`}>{hasNumber ? '✓' : '○'}</span> 
                      Angka (0-9)
                    </div>
                    <div className={`flex items-center gap-2 text-[11px] font-medium transition-colors ${hasSpecialChar ? 'text-emerald-600' : 'text-gray-400'}`}>
                      <span className={`w-4 h-4 flex items-center justify-center rounded-full ${hasSpecialChar ? 'bg-emerald-100' : 'bg-gray-100'}`}>{hasSpecialChar ? '✓' : '○'}</span> 
                      Karakter Unik (@#$)
                    </div>
                  </div>
                </div>
              </div>

              <button 
                type="submit" 
                disabled={isSubmitting || !isPasswordValid}
                className="w-full bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 disabled:from-gray-300 disabled:to-gray-300 disabled:text-gray-500 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-emerald-500/30 disabled:shadow-none transition-all active:scale-[0.98]"
              >
                {isSubmitting ? 'Memproses...' : 'Simpan Password Baru'}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
