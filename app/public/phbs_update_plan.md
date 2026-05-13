# Rencana Implementasi Makro Update PHBS

## Status: DRAFT — Menunggu Konfirmasi

---

## Bagian 0: Gap Analysis — Logika Lama vs Baru

| Aspek | Logika Lama (Saat Ini) | Logika Baru (logic-phbs.md) |
|---|---|---|
| **Jumlah Indikator PHBS** | 10 wajib + 7 bersyarat (17 total) | **10 indikator inti** untuk klasifikasi RT Sehat |
| **Indikator Non-PHBS** | Masuk ke skor utama | Dipisah sebagai **Analisis GERMAS** (CKG, Posyandu, TTD) |
| **Logika Cuci Tangan (i5)** | Boolean tunggal per KK | **Role Modelling**: minimal 1 ART ≥ 5 th bernilai 1 |
| **Logika Makan Sayur (i8)** | Boolean tunggal per KK | **Role Modelling**: minimal 1 ART ≥ 10 th bernilai 1 |
| **Logika Aktivitas Fisik (i9)** | Boolean tunggal per KK | **Role Modelling**: minimal 1 ART ≥ 10 th bernilai 1 |
| **Logika Tidak Merokok (i10)** | Boolean tunggal per KK | **Collective Negative**: jika 1 ART merokok → RT = 0 |
| **Denominaor Skor** | Dinamis (hingga 17) | **Dinamis N** (8–10 tergantung ada bayi/balita) |
| **Threshold Sehat** | Skor ≥ 75% (Sehat Paripurna) | **Skor = N (100%)** = RT Sehat (Binary) |
| **Tampilan Skor PWA** | Persentase saja | **Format "X/N (Sehat/Tidak Sehat)"** |
| **Data ART per Indikator** | Tidak ada | **Pertanyaan per-ART** untuk i5, i8, i9, i10 |

---

## Bagian 1: Perubahan Database (Supabase)

### 1.1 Tabel Baru: `survey_art_responses`
Menyimpan jawaban individual per-ART untuk indikator Role Modelling dan Collective Negative.

```sql
CREATE TABLE survey_art_responses (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_id     UUID NOT NULL REFERENCES surveys(id) ON DELETE CASCADE,
  family_member_id UUID NOT NULL REFERENCES family_members(id) ON DELETE CASCADE,
  
  -- Indikator yang dijawab per-ART (NULL jika tidak applicable untuk ART ini)
  i5_cuci_tangan       BOOLEAN,  -- ART ≥ 5 tahun
  i8_makan_sayur_buah  BOOLEAN,  -- ART ≥ 10 tahun
  i9_aktivitas_fisik   BOOLEAN,  -- ART ≥ 10 tahun
  i10_tidak_merokok    BOOLEAN,  -- Semua ART (apakah ART ini MEROKOK?)
  
  -- GERMAS tambahan per-ART
  g_cek_kesehatan      BOOLEAN,  -- CKG: apakah ART ini cek kesehatan?
  g_posyandu_hadir     BOOLEAN,  -- Posyandu bulan lalu
  
  created_at    TIMESTAMPTZ DEFAULT timezone('utc', now()),
  
  UNIQUE(survey_id, family_member_id)
);
```

### 1.2 Tambahan Kolom di Tabel `surveys`
Kolom computed/cached untuk performa query analitik:

```sql
ALTER TABLE surveys 
ADD COLUMN skor_phbs        INTEGER,   -- numerator (X)
ADD COLUMN denominator_phbs INTEGER,   -- denominator (N)
ADD COLUMN is_rt_sehat      BOOLEAN,   -- X = N → TRUE
ADD COLUMN kategori_phbs    VARCHAR;   -- 'Sehat' / 'Tidak Sehat'
```

> **Catatan**: Kolom ini diisi oleh aplikasi saat submit survei, bukan trigger DB.

---

## Bagian 2: Logika Scoring Baru (TypeScript)

### 2.1 Algoritma Skor RT (10 Indikator PHBS)

```typescript
function hitungSkorPHBS(survey: SurveyData, artResponses: ArtResponse[]): {
  skor: number; denominator: number; isSehat: boolean; display: string
} {
  let skor = 0;
  let N = 0;

  // === Indikator Bersyarat (applicable check) ===
  // I1: Persalinan Nakes — applicable jika ada ibu melahirkan < 5 th (dari family_members)
  if (survey.i1_persalinan_nakes !== null) {
    N++; if (survey.i1_persalinan_nakes) skor++;
  }
  // I2: ASI Eksklusif — applicable jika ada bayi 0-6 bulan
  if (survey.i2_asi_eksklusif !== null) {
    N++; if (survey.i2_asi_eksklusif) skor++;
  }
  // I3: Menimbang Balita — Role Modelling Khusus (min 1 balita ditimbang)
  if (survey.i3_menimbang_balita !== null) {
    N++; if (survey.i3_menimbang_balita) skor++;
  }

  // === Indikator Wajib (selalu applicable) ===
  // I4: Air Bersih — KK
  N++; if (survey.i4_air_bersih) skor++;

  // I5: Cuci Tangan — Role Modelling (min 1 ART ≥ 5 th = 1)
  const ctArt = artResponses.filter(a => a.i5_cuci_tangan !== null);
  N++;
  if (ctArt.some(a => a.i5_cuci_tangan === true)) skor++;

  // I6: Jamban Sehat — KK
  N++; if (survey.i6_jamban_sehat) skor++;

  // I7: PSN — KK
  N++; if (survey.i7_psn) skor++;

  // I8: Makan Sayur/Buah — Role Modelling (min 1 ART ≥ 10 th = 1)
  const msArt = artResponses.filter(a => a.i8_makan_sayur_buah !== null);
  N++;
  if (msArt.some(a => a.i8_makan_sayur_buah === true)) skor++;

  // I9: Aktivitas Fisik — Role Modelling (min 1 ART ≥ 10 th = 1)
  const afArt = artResponses.filter(a => a.i9_aktivitas_fisik !== null);
  N++;
  if (afArt.some(a => a.i9_aktivitas_fisik === true)) skor++;

  // I10: Tidak Merokok — Collective Negative (jika ADA 1 merokok → RT = 0)
  N++;
  const adaYangMerokok = artResponses.some(a => a.i10_tidak_merokok === false);
  if (!adaYangMerokok) skor++;

  const isSehat = (skor === N); // Harus 100%
  return {
    skor, denominator: N, isSehat,
    display: `${skor}/${N} (${isSehat ? 'Sehat' : 'Tidak Sehat'})`
  };
}
```

---

## Bagian 3: Perubahan UI PWA (SurveyWizard)

### 3.1 Alur Pengisian Survei Baru

```
Langkah 1: Pilih Rumah Tangga (KK)
    ↓
Langkah 2: Pertanyaan Level KK
  - Air Bersih (I4)
  - Jamban Sehat (I6)
  - PSN/3M (I7)
  - Persalinan Nakes (I1) [jika applicable]
  - ASI Eksklusif (I2) [jika applicable]
  - Menimbang Balita (I3) [jika applicable]
    ↓
Langkah 3..N+2: Pertanyaan per-ART (satu step per orang)
  ┌─────────────────────────────────┐
  │ ART: [Nama ART] (L/P, Umur)    │ ← dari family_members
  │ Apakah [Nama] cuci tangan? Y/N  │ (jika ≥ 5 th)
  │ Apakah [Nama] makan sayur? Y/N  │ (jika ≥ 10 th)
  │ Apakah [Nama] olahraga? Y/N     │ (jika ≥ 10 th)
  │ Apakah [Nama] merokok? Y/N      │ (semua ART)
  │ Apakah [Nama] cek kesehatan?    │ (GERMAS)
  │ Apakah [Nama] ke posyandu?      │ (GERMAS)
  └─────────────────────────────────┘
    ↓
Langkah Akhir: Review & Submit
  - Menampilkan skor: "9/10 (Tidak Sehat)"
  - Menampilkan indikator yang gagal
  - Tombol Submit
```

### 3.2 UI Card per-ART
Setiap ART ditampilkan dengan card yang bersih:
- Avatar inisial + nama + usia + jenis kelamin
- Chip role (KK/Istri/Anak/Lansia/dll)
- Pertanyaan yang relevan saja (filter by umur/jenis kelamin)
- Jawaban: toggle Ya/Tidak yang stylish
- Navigasi: Prev ART / Next ART

---

## Bagian 4: Perubahan Dashboard — Laporan

### 4.1 Reorganisasi Menu
Menu **Laporan & Analisis** dipecah menjadi 2 submenu:

```
Dashboard
├── Rekap Laporan PHBS   ← BARU (Tabel)
└── Analisis Laporan     ← REFACTOR (Grafik + Filter RBAC)
```

### 4.2 Menu a1: Rekap Laporan PHBS

**Tampilan Tabel (sesuai SS1 & SS2):**

| No | Nama KK | Persalinan | ASI | Timbang | Air | CTPS | Jamban | PSN | Sayur | Aktifitas | Tdk Rokok | Skor | Klasifikasi |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Toha | 0 | - | 0 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 7 | Tidak S |

**Filter RBAC:**
- `admin_puskesmas`: filter **Desa** (dropdown desa dalam puskesmas)
- `superadmin`: filter **Puskesmas** + **Desa**

**Baris Agregasi Bawah:**
- `Jumlah`: misal `6/8` (6 sehat dari 8 yang applicable)
- `Persen`: `75%`

**Sub-tabel Rekapitulasi Desa/Puskesmas (SS2):**
- Aggregasi per Desa Wisma (atau per Desa)
- Baris total Desa/Puskesmas

### 4.3 Menu a2: Analisis Laporan (Grafik)
Sama dengan grafik saat ini + tambahan **filter RBAC**:
- `admin_puskesmas`: filter Desa
- `superadmin`: filter Puskesmas + Desa
- Radar Chart, Pareto, GERMAS, Donut

---

## Bagian 5: Urutan Implementasi

> **Catatan Penting**: Perubahan ini adalah BREAKING CHANGE pada logika scoring. Harus dikerjakan secara berurutan.

### Fase 1: Database (est. 1 sesi)
- [ ] Migrasi DB: tambah tabel `survey_art_responses`
- [ ] Migrasi DB: tambah kolom skor ke tabel `surveys`
- [ ] Update RLS policies untuk tabel baru

### Fase 2: Logika Scoring Core (est. 1 sesi)
- [ ] Buat file `lib/phbs/scoring.ts` — fungsi hitungSkorPHBS()
- [ ] Update SurveyWizard — alur baru per-ART
- [ ] Update EditSurveyClient — alur baru per-ART
- [ ] Update Done Screen — tampilan "X/N (Sehat/Tidak Sehat)"

### Fase 3: Dashboard Laporan (est. 1-2 sesi)
- [ ] Buat `/dashboard/rekap` — tabel rekap SS1 + SS2
- [ ] Refactor `/dashboard/reports` → `/dashboard/analysis`
- [ ] Tambah filter RBAC ke grafik

### Fase 4: Testing & Polish
- [ ] Verifikasi perhitungan skor dengan data dummy
- [ ] Uji RBAC (superadmin vs admin_puskesmas)
- [ ] Responsive mobile test

---

## Catatan Arsitektur

### Mengapa Jawaban per-ART Disimpan di Tabel Terpisah?
- Karena `family_members` sudah ada dan menyimpan profil ART
- Indikator Role Modelling membutuhkan data individual per-orang
- Memungkinkan analisis mendalam (siapa yang merokok? berapa % remaja putri olahraga?)
- Kompatibel dengan offline-first (Dexie.js)

### Kompatibilitas Backward
- Kolom lama di `surveys` (`i5_cuci_tangan`, `i8_makan_sayur_buah`, dll) tetap ada
- Nilai kolom tersebut akan diisi berdasarkan hasil agregasi ART (computed)
- Data lama masih bisa dibaca, hanya scoring-nya yang akan diupdate

---

## Konfirmasi yang Diperlukan dari User

1. **Apakah semua ART sudah terdaftar di `family_members`** sebelum survei dimulai? (Asumsi: Ya, karena KK diinput duluan)
2. **Apakah offline mode** tetap harus didukung untuk alur ART baru ini? (Asumsi: Ya)
3. **Apakah data survei lama** (yang memakai logika 17 indikator) perlu di-migrate atau cukup dibiarkan dengan logika lama?
4. **Nama menu baru**: "Rekap Laporan PHBS" dan "Analisis Laporan" — apakah sudah sesuai keinginan?
