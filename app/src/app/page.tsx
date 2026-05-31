import AnimatedCounter from './AnimatedCounter'

const INDICATORS = [
  { no: 1, icon: '🤱', title: 'Persalinan Nakes', desc: 'Persalinan ditolong tenaga kesehatan terlatih' },
  { no: 2, icon: '🍼', title: 'ASI Eksklusif', desc: 'Bayi 0-6 bulan mendapat ASI eksklusif' },
  { no: 3, icon: '⚖️', title: 'Timbang Balita', desc: 'Penimbangan balita minimal 8x per tahun' },
  { no: 4, icon: '💧', title: 'Air Bersih', desc: 'Menggunakan sumber air bersih yang aman' },
  { no: 5, icon: '🧼', title: 'Cuci Tangan', desc: 'Cuci tangan pakai sabun di air mengalir' },
  { no: 6, icon: '🚽', title: 'Jamban Sehat', desc: 'Menggunakan jamban leher angsa yang tertutup' },
  { no: 7, icon: '🦟', title: 'PSN 3M Plus', desc: 'Pemberantasan sarang nyamuk tiap minggu' },
  { no: 8, icon: '🥗', title: 'Sayur & Buah', desc: 'Konsumsi sayur dan buah setiap hari' },
  { no: 9, icon: '🏃', title: 'Aktivitas Fisik', desc: 'Olahraga minimal 30 menit per hari' },
  { no: 10, icon: '🚭', title: 'Tidak Merokok', desc: 'Tidak ada yang merokok di dalam rumah' },
  { no: 11, icon: '🩺', title: 'Cek Kesehatan', desc: 'Pemeriksaan kesehatan minimal 2x per tahun' },
  { no: 12, icon: '🏥', title: 'Kunjungan Posyandu', desc: 'Aktif mengunjungi Posyandu terdekat' },
  { no: 13, icon: '👶', title: 'Peserta Posyandu', desc: 'Balita terdaftar dan aktif di Posyandu' },
  { no: 14, icon: '🤰', title: 'Ibu Hamil', desc: 'Ibu hamil rutin periksa ke fasilitas kesehatan' },
  { no: 15, icon: '💊', title: 'TTD Ibu Hamil', desc: 'Ibu hamil konsumsi tablet tambah darah' },
  { no: 16, icon: '👧', title: 'Remaja Putri', desc: 'Remaja putri 12-18 tahun dalam keluarga' },
  { no: 17, icon: '💉', title: 'TTD Remaja Putri', desc: 'Remaja putri rutin konsumsi tablet Fe' },
]

const STATS = [
  { value: '39', label: 'Puskesmas', icon: '🏥' },
  { value: '390', label: 'Desa/Kelurahan', icon: '🏘️' },
  { value: '902.127', label: 'Total KK', icon: '🏠' },
  { value: '20-28%', label: 'Target Survei/Tahun', icon: '🎯' },
]

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white font-sans">

      {/* ===== NAVBAR ===== */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3 md:gap-6">
            <div className="flex items-center gap-2 md:gap-4">
              <img src="/KAB.png" alt="Logo Kabupaten Malang" className="h-10 md:h-16 w-auto object-contain" />
              <img src="/GERMAS.png" alt="Logo Germas" className="h-8 md:h-14 w-auto object-contain" />
              <img src="/promkes.png" alt="Logo Promkes" className="h-9 md:h-15 w-auto object-contain" />
            </div>
            <div className="hidden sm:block border-l-2 border-gray-100 pl-4 md:pl-6 py-1">
              <span className="font-heading font-black text-gray-800 text-lg md:text-xl tracking-tight block leading-none">SIM-PHBS</span>
              <p className="text-[10px] md:text-xs text-gray-400 mt-1 md:mt-1.5 font-bold uppercase tracking-[0.2em]">Kabupaten Malang</p>
            </div>
          </div>
          <div className="hidden md:flex items-center gap-6 text-sm text-gray-600">
            <a href="#tentang" className="hover:text-emerald-600 transition-colors">Tentang PHBS</a>
            <a href="#indikator" className="hover:text-emerald-600 transition-colors">17 Indikator</a>
            <a href="#fitur" className="hover:text-emerald-600 transition-colors">Fitur Aplikasi</a>
          </div>
          <div className="flex items-center gap-1.5 md:gap-2">
            <a href="/login?mode=pwa"
              className="text-xs md:text-sm border border-emerald-600 text-emerald-600 px-2 md:px-3 py-1.5 rounded-xl hover:bg-emerald-50 transition-colors font-medium whitespace-nowrap">
              Surveyor
            </a>
            <a href="/login?mode=admin"
              className="text-xs md:text-sm bg-emerald-600 text-white px-2 md:px-3 py-1.5 rounded-xl hover:bg-emerald-500 transition-colors font-medium whitespace-nowrap">
              Dashboard
            </a>
          </div>
        </div>
      </nav>

      {/* ===== HERO ===== */}
      <section className="relative min-h-screen flex items-center bg-gradient-to-br from-emerald-900 via-teal-800 to-green-900 overflow-hidden pt-16">
        {/* BG blobs */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/4 -left-32 w-96 h-96 bg-emerald-400/20 rounded-full blur-3xl" />
          <div className="absolute bottom-1/4 -right-32 w-96 h-96 bg-teal-400/20 rounded-full blur-3xl" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-white/5 rounded-full blur-3xl" />
        </div>

        {/* Grid pattern */}
        <div className="absolute inset-0 opacity-10"
          style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)', backgroundSize: '50px 50px' }} />

        <div className="relative max-w-6xl mx-auto px-6 py-20 text-center">
          <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 rounded-full px-4 py-2 text-emerald-300 text-sm mb-8 backdrop-blur">
            <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
            Platform Survei Digital Resmi Dinkes Kab. Malang
          </div>

          <h1 className="text-5xl md:text-7xl font-heading font-black text-white leading-tight mb-6 tracking-tight">
            Perilaku Hidup<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-300 via-teal-300 to-emerald-200">
              Bersih & Sehat
            </span>
          </h1>

          <p className="text-lg text-white/70 max-w-2xl mx-auto mb-10">
            Sistem digital untuk memantau, mendata, dan menganalisis capaian PHBS di 390 desa/kelurahan Kabupaten Malang.
            Mendukung survei lapangan offline & online.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <a href="/login?mode=pwa"
              className="group flex items-center gap-3 bg-white text-emerald-800 px-7 py-4 rounded-2xl font-bold text-base shadow-[0_0_40px_rgba(16,185,129,0.3)] hover:shadow-[0_0_60px_rgba(16,185,129,0.5)] transition-all transform hover:-translate-y-1">
              <span className="text-2xl">📱</span>
              <div className="text-left">
                <p className="leading-none">Buka Aplikasi Survei</p>
                <p className="text-xs text-emerald-600 font-normal mt-0.5">Untuk petugas Puskesmas</p>
              </div>
            </a>
            <a href="/login?mode=admin"
              className="group flex items-center gap-3 bg-white/10 border border-white/30 text-white px-7 py-4 rounded-2xl font-bold text-base hover:bg-white/20 transition-all backdrop-blur">
              <span className="text-2xl">🖥️</span>
              <div className="text-left">
                <p className="leading-none">Dashboard Admin</p>
                <p className="text-xs text-white/60 font-normal mt-0.5">Laporan & analisis data</p>
              </div>
            </a>
          </div>

          {/* Stats band */}
          <div className="mt-20 grid grid-cols-2 md:grid-cols-4 gap-4">
            {STATS.map(s => (
              <div key={s.label} className="bg-white/10 backdrop-blur border border-white/20 rounded-2xl p-5 text-center">
                <span className="text-3xl">{s.icon}</span>
                <p className="text-2xl md:text-4xl font-heading font-black text-white mt-3">
                  <AnimatedCounter value={s.value} />
                </p>
                <p className="text-emerald-300 text-xs mt-1">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== TENTANG PHBS ===== */}
      <section id="tentang" className="py-20 bg-gray-50">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <span className="text-emerald-600 font-semibold text-sm tracking-wide uppercase">Tentang Program</span>
              <h2 className="text-3xl md:text-4xl font-heading font-black text-gray-900 mt-3 mb-5">
                Apa itu PHBS?
              </h2>
              <p className="text-gray-600 leading-relaxed mb-4">
                <strong>Perilaku Hidup Bersih dan Sehat (PHBS)</strong> adalah sekumpulan perilaku yang dipraktikkan atas dasar kesadaran sebagai hasil pembelajaran, yang menjadikan seseorang, keluarga, kelompok atau masyarakat mampu menolong dirinya sendiri di bidang kesehatan.
              </p>
              <p className="text-gray-600 leading-relaxed mb-4">
                Program ini merupakan bagian dari kebijakan <strong>Kementerian Kesehatan RI</strong> dalam upaya pencegahan penyakit berbasis perilaku. Di Kabupaten Malang, survei PHBS dilaksanakan oleh 39 Puskesmas dengan target 20-28% dari total Kepala Keluarga setiap tahunnya.
              </p>
              <div className="flex flex-wrap gap-3 mt-6">
                {['Berdasarkan Permenkes RI', 'WHO Global Standards', 'SDGs Goal 3'].map(tag => (
                  <span key={tag} className="bg-emerald-100 text-emerald-700 text-xs px-3 py-1.5 rounded-full font-medium">
                    ✓ {tag}
                  </span>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {[
                { icon: '🎯', title: 'Tujuan', desc: 'Meningkatkan derajat kesehatan masyarakat melalui perubahan perilaku hidup sehat' },
                { icon: '📊', title: 'Metodologi', desc: 'Survei rumah tangga dengan 17 indikator terstandar berbasis Kemenkes' },
                { icon: '🏘️', title: 'Sasaran', desc: '390 desa/kelurahan, mencakup seluruh wilayah Kabupaten Malang' },
                { icon: '📱', title: 'Teknologi', desc: 'Aplikasi mobile offline-first untuk kemudahan petugas di lapangan' },
              ].map(c => (
                <div key={c.title} className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
                  <span className="text-3xl">{c.icon}</span>
                  <h3 className="font-heading font-bold text-gray-800 mt-4 mb-2 text-base">{c.title}</h3>
                  <p className="text-gray-500 text-xs leading-relaxed">{c.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ===== 17 INDIKATOR ===== */}
      <section id="indikator" className="py-24 bg-gray-50/60">
        <div className="max-w-6xl mx-auto px-6">

          {/* Section header */}
          <div className="text-center mb-14">
            <span className="inline-flex items-center gap-2 px-4 py-1.5 bg-emerald-100 text-emerald-700 font-semibold text-xs tracking-widest uppercase rounded-full mb-4">
              📋 Parameter Penilaian
            </span>
            <h2 className="text-3xl md:text-4xl font-heading font-black text-gray-900 mt-2 mb-4">
              17 Indikator PHBS <span className="text-emerald-600">Tatanan Rumah Tangga</span>
            </h2>
            <p className="text-gray-500 max-w-2xl mx-auto leading-relaxed">
              Setiap rumah tangga dinilai berdasarkan <strong className="text-gray-700">17 indikator</strong> perilaku hidup bersih dan sehat sesuai pedoman <strong className="text-gray-700">Kementerian Kesehatan RI</strong>
            </p>
          </div>

          {/* Group 1: Indikator PHBS Inti */}
          <div className="mb-10">
            <div className="flex items-center gap-3 mb-5">
              <div className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-1.5 rounded-full text-xs font-bold tracking-wide shadow-sm">
                <span>🏠</span> Indikator PHBS Inti
              </div>
              <div className="flex-1 h-px bg-emerald-200" />
              <span className="text-xs text-gray-400 font-medium">No. 1–10</span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
              {INDICATORS.slice(0, 10).map(ind => (
                <div key={ind.no}
                  className="group relative bg-white/60 backdrop-blur-md border border-white/40 hover:border-emerald-400/50 rounded-2xl p-5 transition-all duration-500 hover:shadow-[0_8px_30px_rgb(16,185,129,0.12)] hover:-translate-y-1 cursor-default overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-br from-emerald-50/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                  <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-bl from-emerald-100/80 to-transparent rounded-bl-3xl opacity-50 group-hover:opacity-100 transition-all duration-500 -mr-2 -mt-2" />
                  <div className="relative z-10 flex items-center gap-3 mb-4">
                    <span className="text-[11px] font-black text-white bg-gradient-to-br from-emerald-400 to-emerald-600 w-6 h-6 rounded-full flex items-center justify-center shadow-md shadow-emerald-200 flex-shrink-0">{ind.no}</span>
                    <span className="text-2xl filter drop-shadow-sm group-hover:scale-110 transition-transform duration-300">{ind.icon}</span>
                  </div>
                  <h3 className="relative z-10 font-heading font-bold text-gray-800 text-sm mb-1.5 leading-snug group-hover:text-emerald-700 transition-colors">{ind.title}</h3>
                  <p className="relative z-10 text-gray-500 text-[11px] leading-relaxed group-hover:text-gray-600 transition-colors">{ind.desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Group 2: Kesehatan Ibu & Anak */}
          <div className="mb-10">
            <div className="flex items-center gap-3 mb-5">
              <div className="flex items-center gap-2 bg-rose-500 text-white px-4 py-1.5 rounded-full text-xs font-bold tracking-wide shadow-sm">
                <span>🤱</span> Kesehatan Ibu &amp; Anak
              </div>
              <div className="flex-1 h-px bg-rose-200" />
              <span className="text-xs text-gray-400 font-medium">No. 11–16</span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              {INDICATORS.slice(10, 16).map(ind => (
                <div key={ind.no}
                  className="group relative bg-white/60 backdrop-blur-md border border-white/40 hover:border-rose-400/50 rounded-2xl p-5 transition-all duration-500 hover:shadow-[0_8px_30px_rgb(244,63,94,0.12)] hover:-translate-y-1 cursor-default overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-br from-rose-50/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                  <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-bl from-rose-100/80 to-transparent rounded-bl-3xl opacity-50 group-hover:opacity-100 transition-all duration-500 -mr-2 -mt-2" />
                  <div className="relative z-10 flex items-center gap-3 mb-4">
                    <span className="text-[11px] font-black text-white bg-gradient-to-br from-rose-400 to-rose-600 w-6 h-6 rounded-full flex items-center justify-center shadow-md shadow-rose-200 flex-shrink-0">{ind.no}</span>
                    <span className="text-2xl filter drop-shadow-sm group-hover:scale-110 transition-transform duration-300">{ind.icon}</span>
                  </div>
                  <h3 className="relative z-10 font-heading font-bold text-gray-800 text-sm mb-1.5 leading-snug group-hover:text-rose-700 transition-colors">{ind.title}</h3>
                  <p className="relative z-10 text-gray-500 text-[11px] leading-relaxed group-hover:text-gray-600 transition-colors">{ind.desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Group 3: Kesehatan Remaja */}
          <div className="mb-12">
            <div className="flex items-center gap-3 mb-5">
              <div className="flex items-center gap-2 bg-violet-600 text-white px-4 py-1.5 rounded-full text-xs font-bold tracking-wide shadow-sm">
                <span>💊</span> Kesehatan Remaja
              </div>
              <div className="flex-1 h-px bg-violet-200" />
              <span className="text-xs text-gray-400 font-medium">No. 17</span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              {INDICATORS.slice(16).map(ind => (
                <div key={ind.no}
                  className="group relative bg-white/60 backdrop-blur-md border border-white/40 hover:border-violet-400/50 rounded-2xl p-5 transition-all duration-500 hover:shadow-[0_8px_30px_rgb(139,92,246,0.12)] hover:-translate-y-1 cursor-default overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-br from-violet-50/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                  <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-bl from-violet-100/80 to-transparent rounded-bl-3xl opacity-50 group-hover:opacity-100 transition-all duration-500 -mr-2 -mt-2" />
                  <div className="relative z-10 flex items-center gap-3 mb-4">
                    <span className="text-[11px] font-black text-white bg-gradient-to-br from-violet-400 to-violet-600 w-6 h-6 rounded-full flex items-center justify-center shadow-md shadow-violet-200 flex-shrink-0">{ind.no}</span>
                    <span className="text-2xl filter drop-shadow-sm group-hover:scale-110 transition-transform duration-300">{ind.icon}</span>
                  </div>
                  <h3 className="relative z-10 font-heading font-bold text-gray-800 text-sm mb-1.5 leading-snug group-hover:text-violet-700 transition-colors">{ind.title}</h3>
                  <p className="relative z-10 text-gray-500 text-[11px] leading-relaxed group-hover:text-gray-600 transition-colors">{ind.desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Kategori Capaian PHBS */}
          <div className="bg-white border border-gray-100 rounded-3xl p-8 shadow-sm">
            <div className="text-center mb-8">
              <h3 className="font-heading font-black text-gray-800 text-2xl">Kategori Capaian PHBS</h3>
              <p className="text-gray-500 text-sm mt-1">Klasifikasi status kesehatan rumah tangga berdasarkan pemenuhan indikator</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 max-w-3xl mx-auto">
              <div className="group relative overflow-hidden bg-gradient-to-br from-emerald-50 to-teal-50 border-2 border-emerald-200 hover:border-emerald-400 rounded-2xl p-6 text-center transition-all duration-300 hover:shadow-lg">
                <div className="absolute -top-6 -right-6 w-20 h-20 bg-emerald-200/40 rounded-full group-hover:scale-150 transition-transform duration-500" />
                <div className="w-14 h-14 mx-auto bg-emerald-500 text-white rounded-2xl flex items-center justify-center text-2xl mb-4 shadow-md shadow-emerald-200 relative z-10">
                  🏡
                </div>
                <h4 className="font-heading font-black text-xl text-emerald-800 mb-1">Rumah Tangga Sehat</h4>
                <p className="text-3xl font-heading font-black text-emerald-600 mb-3">100%</p>
                <p className="text-xs text-emerald-700/80 font-medium leading-relaxed">
                  Seluruh indikator PHBS yang relevan terpenuhi dengan baik di rumah tangga tersebut.
                </p>
              </div>

              <div className="group relative overflow-hidden bg-gradient-to-br from-red-50 to-rose-50 border-2 border-red-200 hover:border-red-400 rounded-2xl p-6 text-center transition-all duration-300 hover:shadow-lg">
                <div className="absolute -top-6 -left-6 w-20 h-20 bg-red-200/40 rounded-full group-hover:scale-150 transition-transform duration-500" />
                <div className="w-14 h-14 mx-auto bg-red-500 text-white rounded-2xl flex items-center justify-center text-2xl mb-4 shadow-md shadow-red-200 relative z-10">
                  🏚️
                </div>
                <h4 className="font-heading font-black text-xl text-red-800 mb-1">Rumah Tangga Tidak Sehat</h4>
                <p className="text-3xl font-heading font-black text-red-600 mb-3">&lt; 100%</p>
                <p className="text-xs text-red-700/80 font-medium leading-relaxed">
                  Masih terdapat satu atau lebih indikator PHBS yang belum terpenuhi di rumah tangga.
                </p>
              </div>
            </div>
          </div>

        </div>
      </section>

      {/* ===== FITUR APLIKASI ===== */}
      <section id="fitur" className="py-20 bg-gray-900 text-white">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-12">
            <span className="text-emerald-400 font-semibold text-sm tracking-wide uppercase">Platform Digital</span>
            <h2 className="text-3xl md:text-5xl font-heading font-black mt-3 mb-5">Dua Akses, Satu Ekosistem</h2>
            <p className="text-gray-400 max-w-xl mx-auto">
              Dirancang untuk kebutuhan petugas lapangan dan administrator Dinas Kesehatan
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {/* PWA Card */}
            <div className="bg-gradient-to-br from-emerald-700 to-teal-800 rounded-3xl p-8 border border-emerald-600/50">
              <div className="text-5xl mb-5">📱</div>
              <h3 className="text-3xl font-heading font-black mb-3">Aplikasi Survei</h3>
              <p className="text-emerald-200 text-sm mb-6 leading-relaxed">
                Dioptimalkan untuk petugas Puskesmas di lapangan. Bisa diinstal di HP dan bekerja tanpa sinyal internet.
              </p>
              <ul className="space-y-2 mb-8">
                {[
                  'Instalasi langsung ke home screen HP',
                  'Mode offline — survei tanpa sinyal',
                  'Auto-sync saat kembali online',
                  'Validasi NIK otomatis dari 16 digit',
                  'Wizard 17 indikator dengan skip logic',
                  'Notifikasi pending data',
                ].map(f => (
                  <li key={f} className="flex items-center gap-2 text-sm text-emerald-100">
                    <span className="text-emerald-400">✓</span> {f}
                  </li>
                ))}
              </ul>
              <a href="/login?mode=pwa"
                className="inline-flex items-center gap-2 bg-white text-emerald-800 px-5 py-3 rounded-xl font-bold text-sm hover:shadow-lg transition-all">
                Masuk sebagai Surveyor →
              </a>
            </div>

            {/* Dashboard Card */}
            <div className="bg-gray-800 rounded-3xl p-8 border border-gray-700">
              <div className="text-5xl mb-5">🖥️</div>
              <h3 className="text-3xl font-heading font-black mb-3">Dashboard Admin</h3>
              <p className="text-gray-400 text-sm mb-6 leading-relaxed">
                Untuk kepala Puskesmas dan administrator Dinas Kesehatan. Laporan lengkap dan analisis data agregat.
              </p>
              <ul className="space-y-2 mb-8">
                {[
                  'Peta capaian PHBS per desa/puskesmas',
                  'Rekap 17 indikator dengan grafik',
                  'Manajemen data KK & anggota keluarga',
                  'Export laporan PDF & Excel',
                  'Multi-level RBAC (Superadmin & PKM)',
                  'Monitor progress survei real-time',
                ].map(f => (
                  <li key={f} className="flex items-center gap-2 text-sm text-gray-300">
                    <span className="text-emerald-400">✓</span> {f}
                  </li>
                ))}
              </ul>
              <a href="/login?mode=admin"
                className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-5 py-3 rounded-xl font-bold text-sm transition-all">
                Masuk ke Dashboard →
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ===== FOOTER ===== */}
      <footer className="bg-gray-950 text-gray-400 py-10">
        <div className="max-w-6xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 opacity-80 hover:opacity-100 transition-opacity">
              <img src="/KAB.png" alt="Logo Kabupaten Malang" className="h-10 w-auto brightness-0 invert" />
              <img src="/GERMAS.png" alt="Logo Germas" className="h-8 w-auto" />
              <img src="/promkes.png" alt="Logo Promkes" className="h-9 w-auto" />
            </div>
            <div className="border-l border-gray-800 pl-4">
              <p className="text-white text-sm font-bold">SIM-PHBS</p>
              <p className="text-[10px] text-gray-500 uppercase tracking-widest">Dinas Kesehatan Kab. Malang</p>
            </div>
          </div>
          <p className="text-xs text-center">
            © 2026 Dinas Kesehatan Kabupaten Malang · Crafted with{' '}
            <span className="text-red-400">♥</span> by{' '}
            <a href="https://dedik2urniawan.github.io/" target="_blank" rel="noopener noreferrer"
              className="text-emerald-400 hover:text-emerald-300 transition-colors font-medium">
              DK
            </a>
          </p>
          <div className="flex gap-4 text-xs">
            <a href="/login?mode=pwa" className="hover:text-white transition-colors">Aplikasi Survei</a>
            <a href="/login?mode=admin" className="hover:text-white transition-colors">Dashboard</a>
          </div>
        </div>
      </footer>

    </div>
  )
}
