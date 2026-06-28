import React from 'react';
import Link from 'next/link';
import { ShieldCheck, WifiOff, FileText, Activity, Users, AlertTriangle, ArrowLeft, CheckCircle2 } from 'lucide-react';

export const metadata = {
  title: 'SOP SIM-PHBS | Dinkes Kabupaten Malang',
  description: 'Standar Operasional Prosedur SIM-PHBS Kabupaten Malang',
};

export default function SOPPage() {
  return (
    <div className="min-h-screen bg-slate-50 font-sans selection:bg-emerald-200">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-slate-600 hover:text-emerald-600 transition-colors group">
            <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
            <span className="font-medium text-sm">Kembali ke Beranda</span>
          </Link>
          <div className="flex items-center gap-2">
            <img src="/KAB.png" alt="Logo" className="h-8 w-auto opacity-80" />
            <span className="text-sm font-bold text-slate-800 tracking-tight hidden sm:block">SIM-PHBS</span>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-10 sm:py-16">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <div className="inline-flex items-center gap-2 bg-emerald-100/50 border border-emerald-200 text-emerald-700 px-4 py-1.5 rounded-full text-xs font-semibold uppercase tracking-wider mb-6">
            <ShieldCheck className="w-4 h-4" />
            Pedoman Resmi
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 mb-4 tracking-tight">
            Standar Operasional Prosedur <br className="hidden sm:block" />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-600 to-teal-500">
              Penggunaan SIM-PHBS
            </span>
          </h1>
          <p className="text-slate-600 text-lg leading-relaxed">
            Demi menjaga keakuratan, integritas, dan kelancaran sinkronisasi data survei se-Kabupaten Malang, seluruh Kader dan Admin Puskesmas wajib mematuhi panduan berikut.
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-8 lg:gap-12">
          
          {/* Kader Section */}
          <section className="space-y-6">
            <div className="flex items-center gap-3 pb-2 border-b-2 border-emerald-100">
              <div className="bg-emerald-500 p-2.5 rounded-xl text-white shadow-sm shadow-emerald-500/20">
                <FileText className="w-6 h-6" />
              </div>
              <h2 className="text-2xl font-bold text-slate-800">SOP Kader Surveyor</h2>
            </div>

            <div className="grid gap-4">
              <SopCard 
                icon={<CheckCircle2 className="w-5 h-5 text-emerald-500" />}
                title="1. Validitas NIK & No KK"
                desc="Pastikan NIK (Nomor Induk Kependudukan) dan Nomor KK yang diinput berjumlah tepat 16 digit sesuai KTP/KK fisik. NIK yang salah akan menyebabkan data ganda atau error pada server."
              />
              <SopCard 
                icon={<WifiOff className="w-5 h-5 text-amber-500" />}
                title="2. Aturan Mode Offline & Sinkronisasi"
                desc="Aplikasi dapat digunakan tanpa sinyal internet (Mode Pesawat). Namun, setelah selesai mendata, Anda WAJIB kembali ke area bersinyal internet, membuka aplikasi, dan menunggu hingga ada notifikasi 'Sinkronisasi Selesai' agar data terkirim ke dinas."
              />
              <SopCard 
                icon={<Activity className="w-5 h-5 text-blue-500" />}
                title="3. Integritas Indikator Survei"
                desc="Wajib menanyakan langsung ke-17 indikator PHBS kepada responden dengan jujur. Jangan mengisi data secara sembarangan, karena data ini menjadi acuan kebijakan kesehatan Bupati Malang."
              />
            </div>
          </section>

          {/* Admin Section */}
          <section className="space-y-6">
            <div className="flex items-center gap-3 pb-2 border-b-2 border-teal-100">
              <div className="bg-teal-600 p-2.5 rounded-xl text-white shadow-sm shadow-teal-600/20">
                <Users className="w-6 h-6" />
              </div>
              <h2 className="text-2xl font-bold text-slate-800">SOP Admin Puskesmas</h2>
            </div>

            <div className="grid gap-4">
              <SopCard 
                icon={<Activity className="w-5 h-5 text-teal-500" />}
                title="1. Monitoring & Validasi Harian"
                desc="Wajib memantau progres survei desa melalui Dashboard Pimpinan secara berkala. Jika menemukan anomali data (statistik tiba-tiba melonjak / anjlok), segera hubungi kader yang bersangkutan."
              />
              <SopCard 
                icon={<ShieldCheck className="w-5 h-5 text-indigo-500" />}
                title="2. Manajemen Akun Kader"
                desc="Setiap kader harus memiliki akun masing-masing. Dilarang keras saling meminjamkan akun antar kader apalagi antar Puskesmas untuk menghindari data masuk ke desa yang salah (cross-linked)."
              />
              <SopCard 
                icon={<AlertTriangle className="w-5 h-5 text-rose-500" />}
                title="3. Hati-hati Hapus Data (Delete)"
                desc="Sangat tidak disarankan menggunakan fitur Hapus Data KK kecuali benar-benar salah input. Menghapus KK akan menghapus seluruh data anggota keluarga dan riwayat indikator mereka dari database provinsi."
              />
            </div>
          </section>

        </div>

        {/* Footer info */}
        <div className="mt-16 bg-slate-800 text-white rounded-2xl p-6 sm:p-8 text-center shadow-xl">
          <h3 className="font-semibold text-lg mb-2">Punya Kendala Teknis?</h3>
          <p className="text-slate-300 text-sm mb-6 max-w-xl mx-auto">
            Jika Anda mengalami kendala aplikasi yang tidak tercantum dalam SOP ini, silakan hubungi tim IT Dinas Kesehatan melalui grup WhatsApp resmi.
          </p>
          <Link href="/login?mode=pwa" className="inline-block bg-emerald-500 hover:bg-emerald-400 text-white font-medium px-6 py-3 rounded-xl transition-colors shadow-lg shadow-emerald-500/30">
            Masuk ke Aplikasi Survei
          </Link>
        </div>
      </main>
    </div>
  );
}

function SopCard({ icon, title, desc }: { icon: React.ReactNode, title: string, desc: string }) {
  return (
    <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-sm hover:shadow-md transition-shadow group">
      <div className="flex items-start gap-4">
        <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100 group-hover:bg-slate-100 transition-colors shrink-0">
          {icon}
        </div>
        <div>
          <h3 className="font-bold text-slate-800 mb-1.5 text-base">{title}</h3>
          <p className="text-slate-600 text-sm leading-relaxed">{desc}</p>
        </div>
      </div>
    </div>
  )
}
