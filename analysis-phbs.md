Untuk menghasilkan menu analisis yang detail, ilmiah (*scientific*), dan memberikan wawasan yang mendalam (*insightful*), dashboard aplikasi PHBS & GERMAS ini harus dirancang dengan pendekatan **Epidemiologi Deskriptif dan Analitik**. 

Berikut adalah rancangan detail mengenai poin-poin analisis, rumus perhitungannya, serta model visualisasi terbaik yang dapat diimplementasikan.

---

## 1. Analisis Status Agregat & Profil Kesehatan (Overview Wilayah)

Bagian ini memberikan gambaran umum mengenai tingkat kesehatan masyarakat di suatu wilayah kerja (Puskesmas/Dinkes).

### A. Indeks Keluarga Sehat PHBS (IKS-PHBS)
* **Poin Analisis:** Menampilkan persentase Rumah Tangga (RT) yang masuk kategori **Sehat** vs **Tidak Sehat** di tingkat desa, kecamatan, atau kabupaten.
* **Metode Perhitungan:**
  $$\text{IKS-PHBS} = \left( \frac{\text{Jumlah RT Sehat}}{\text{Total RT yang Disurvei}} \right) \times 100\%$$
* **Model Visualisasi:** * **Gauge Chart:** Menampilkan jarum penunjuk nilai IKS-PHBS wilayah tersebut (misalnya, Merah: $< 50\%$, Kuning: $50-79\%$, Hijau: $\ge 80\%$).
  * **Donut Chart:** Menampilkan proporsi persentase RT Sehat vs Tidak Sehat untuk memberikan visualisasi perbandingan yang cepat.

### B. Pemetaan Spasial Capaian Wilayah (Geospatial Analysis)
* **Poin Analisis:** Distribusi cakupan wilayah RT Sehat berdasarkan hierarki administratif (Dinkes melihat sebaran per Puskesmas, Puskesmas melihat sebaran per Desa/Kelurahan).
* **Model Visualisasi:** * **Choropleth Map (Peta Tematik Warna):** Area geografis wilayah diwarnai berdasarkan gradasi warna (misalnya, dari merah pekat untuk wilayah dengan IKS rendah hingga hijau pekat untuk wilayah dengan IKS tinggi).

---

## 2. Analisis Komparatif & Komponen Indikator PHBS

Analisis ini bertujuan untuk mendeteksi secara spesifik indikator apa saja yang menjadi penghambat utama (*bottleneck*) sebuah rumah tangga untuk mencapai status Sehat.

### A. Analisis Capaian 10 Indikator PHBS
* **Poin Analisis:** Menilai persentase pemenuhan masing-masing dari 10 indikator dasar PHBS: persalinan nakes, ASI eksklusif, menimbang balita, air bersih, cuci tangan pakai sabun, jamban sehat, PSN, makan sayur & buah, aktivitas fisik, dan tidak merokok.
* **Model Visualisasi:**
  * **Radar Chart (Spider Chart):** Menampilkan 10 sumbu indikator dalam satu grafik lingkaran. Sumbu yang menciut ke dalam menandakan indikator tersebut memiliki capaian rendah dan membutuhkan intervensi segera.
  * **Horizontal Bar Chart (Sorted):** Menampilkan urutan 10 indikator dari yang persentase capaiannya paling tinggi hingga yang terendah.

### B. Analisis Indikator Kegagalan Terbanyak (*The Culprit Indicators*)
* **Poin Analisis:** Menampilkan indikator apa yang paling sering menyebabkan rumah tangga gagal menjadi Sehat.
* **Metode Perhitungan:** Menghitung jumlah kegagalan (skor 0) dari setiap indikator hanya pada rumah tangga yang berstatus **Tidak Sehat**.
* **Model Visualisasi:** **Pareto Chart.** Menampilkan batang jumlah kegagalan per indikator beserta garis akumulasi persentasenya. Berdasarkan hukum Pareto, Dinkes dapat melihat 20% indikator yang menyebabkan 80% masalah tidak sehat di wilayah tersebut.

---

## 3. Analisis Integrasi GERMAS & Pertanyaan Tambahan

Bagian ini menganalisis indikator tambahan yang diusulkan untuk mengukur partisipasi aktif masyarakat dalam GERMAS, Posyandu, serta pemenuhan gizi kelompok rentan.

### A. Analisis Partisipasi Posyandu & GERMAS
* **Poin Analisis:** * Tingkat kepatuhan Cek Kesehatan Gratis (CKG) di masyarakat.
  * Tingkat kunjungan ke Posyandu pada bulan lalu.
* **Model Visualisasi:**
  * **Side-by-Side Bar Chart:** Membandingkan persentase keaktifan Posyandu vs CKG per desa.
  * **Stacked Bar Chart (Segmentasi Pengunjung):** Menampilkan siapa saja anggota keluarga yang datang ke Posyandu (Suami, Istri, Anak, Kakek, Nenek). Ini sangat *insightful* untuk melihat apakah Posyandu masih didominasi ibu dan anak saja, atau sudah mencakup lansia (Kakek/Nenek) sesuai transformasi layanan primer.

### B. Analisis Kelompok Rentan: Ibu Hamil & Remaja Putri (Tablet Tambah Darah / TTD)
* **Poin Analisis:** * Persentase Ibu Hamil yang patuh mengonsumsi TTD/Tablet Fe dari total keluarga yang memiliki Ibu Hamil.
  * Persentase Remaja Putri yang patuh mengonsumsi TTD dari total keluarga yang memiliki Remaja Putri.
* **Model Visualisasi:**
  * **Progress Bar / Bullet Chart:** Menampilkan capaian kepatuhan TTD dibandingkan dengan target nasional (misalnya target cakupan $90\%$).

---

## 4. Analisis Lanjutan & Korelatif (*Advanced Analytics*)

Untuk kebutuhan pembuat kebijakan di tingkat Dinas Kesehatan, dashboard harus mampu menampilkan korelasi antar variabel untuk analisis penyebab masalah kesehatan (*root cause analysis*).

### A. Matriks Korelasi Indikator
* **Poin Analisis:** Menilai apakah ada hubungan antara dua indikator tertentu. Contoh: Apakah keluarga yang tidak merokok cenderung memiliki kepatuhan yang lebih tinggi terhadap aktivitas fisik atau konsumsi sayur/buah?
* **Model Visualisasi:** **Heatmap Correlation Matrix.** Menggunakan gradasi warna (dari biru tua untuk korelasi negatif hingga merah tua untuk korelasi positif) untuk menunjukkan kekuatan hubungan antar indikator.

### B. Analisis Tren Waktu (*Time Series Analysis*)
* **Poin Analisis:** Melihat progres peningkatan IKS-PHBS dari bulan ke bulan atau tahun ke tahun untuk mengevaluasi efektivitas program intervensi Puskesmas.
* **Model Visualisasi:** **Multi-Line Chart.** Setiap garis mewakili satu desa/kelurahan, menunjukkan pergerakan nilai IKS-PHBS dalam rentang waktu tertentu.

---

## Ringkasan Struktur Menu Dashboard & Jenis Visualisasi

Untuk memudahkan implementasi di Next.js menggunakan pustaka grafik seperti **Recharts** atau **Chart.js**, berikut adalah ringkasan panduan komponen visualisasi dashboard:

| Kategori Menu | Poin Analisis Utama | Komponen / Tipe Chart | Manfaat bagi Pengguna (Dinkes/Puskesmas) |
| :--- | :--- | :--- | :--- |
| **Ringkasan Eksekutif** | Nilai IKS-PHBS Wilayah & Jumlah RT Sehat | Gauge Chart & Donut Chart | Melihat status kesehatan wilayah secara cepat. |
| **Analisis Spasial** | Pemetaan IKS per Desa/Puskesmas | Choropleth Map | Mengidentifikasi wilayah yang membutuhkan perhatian khusus. |
| **Analisis 10 Indikator** | Detail capaian 10 Indikator PHBS | Radar Chart & Pareto Chart | Mengetahui indikator spesifik yang paling bermasalah (*bottleneck*). |
| **Analisis GERMAS** | Partisipasi Posyandu & CKG | Stacked Bar Chart | Memantau keterlibatan berbagai segmen keluarga di masyarakat. |
| **Analisis Rentan** | Konsumsi TTD Ibu Hamil & Remaja Putri | Bullet Chart | Intervensi gizi spesifik untuk pencegahan *stunting* dan anemia. |