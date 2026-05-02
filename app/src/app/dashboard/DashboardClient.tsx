'use client'

import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { AppUser } from '@/lib/types'

interface Props {
  user: AppUser & { ref_puskesmas?: { nama: string; kecamatan: string } | null }
  totalKK: number
  kkDisurvei: number
  persentaseDisurvei: number
  capaianPhbs: number
}

export default function DashboardClient({ user, totalKK, kkDisurvei, persentaseDisurvei, capaianPhbs }: Props) {
  const isSuperAdmin = user?.role === 'superadmin'
  const puskesmasName = isSuperAdmin ? 'Dinkes Kab. Malang' : `Puskesmas ${user?.ref_puskesmas?.nama || ''}`.trim()
  const year = new Date().getFullYear();

  return (
    <div className="p-8">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-800">Selamat Datang 👋</h2>
          <p className="text-gray-500 mt-1">{puskesmasName} — Tahun Survei {year}</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {[
            { label: 'Total KK Terdaftar', value: totalKK.toLocaleString('id'), icon: '🏠', color: 'from-emerald-500 to-teal-600', sub: 'Rumah tangga' },
            { label: `KK Disurvei ${year}`, value: kkDisurvei.toLocaleString('id'), icon: '📋', color: 'from-blue-500 to-indigo-600', sub: kkDisurvei === 0 ? 'Belum ada data' : 'Keluarga' },
            { label: 'Target Survei', value: `${persentaseDisurvei}%`, icon: '🎯', color: 'from-amber-500 to-orange-600', sub: 'Dari total KK' },
            { label: 'Capaian PHBS', value: `${capaianPhbs}%`, icon: '📈', color: 'from-purple-500 to-pink-600', sub: 'Rumah Sehat' },
          ].map((stat) => (
            <div key={stat.label} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className={`bg-gradient-to-r ${stat.color} p-4`}>
                <span className="text-3xl">{stat.icon}</span>
              </div>
              <div className="p-4">
                <p className="text-gray-500 text-xs font-medium uppercase tracking-wide">{stat.label}</p>
                <p className="text-2xl font-bold text-gray-800 mt-1">{stat.value}</p>
                <p className="text-gray-400 text-xs mt-1">{stat.sub}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Quick Actions */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h3 className="text-gray-800 font-semibold mb-4">Aksi Cepat</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { icon: '➕', label: 'Tambah Data KK', desc: 'Input rumah tangga baru', href: '/dashboard/households/new', color: 'emerald' },
              { icon: '📝', label: 'Input Survei PHBS', desc: 'Isi 17 indikator survei', href: '/dashboard/survey/new', color: 'blue' },
              { icon: '📊', label: 'Lihat Laporan', desc: 'Rekap & visualisasi data', href: '/dashboard/reports', color: 'purple' },
            ].map((action) => (
              <a
                key={action.href}
                href={action.href}
                className="flex items-center gap-4 p-4 rounded-xl border-2 border-dashed border-gray-200 hover:border-emerald-300 hover:bg-emerald-50 transition-all group"
              >
                <div className="w-10 h-10 bg-gray-100 group-hover:bg-emerald-100 rounded-xl flex items-center justify-center text-xl transition-all">
                  {action.icon}
                </div>
                <div>
                  <p className="font-medium text-gray-700 text-sm">{action.label}</p>
                  <p className="text-gray-400 text-xs">{action.desc}</p>
                </div>
              </a>
            ))}
          </div>
        </div>
    </div>
  )
}
