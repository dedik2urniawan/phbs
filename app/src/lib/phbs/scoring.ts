/**
 * PHBS Scoring Engine — logic-phbs.md v2
 * 10 Indikator Inti dengan Applicability, Role Modelling, dan Collective Negative
 */

export interface ArtResponse {
  id?: string
  family_member_id: string
  // Tambahan indikator
  i1_persalinan_nakes: boolean | null
  i2_asi_eksklusif: boolean | null
  i3_menimbang_balita: boolean | null
  // Role modelling dll
  i5_cuci_tangan: boolean | null
  i8_makan_sayur_buah: boolean | null
  i9_aktivitas_fisik: boolean | null
  i10_tidak_merokok: boolean | null   // false = ART ini merokok
  // GERMAS
  g_cek_kesehatan: boolean | null
  g_posyandu_hadir: boolean | null
  g_ibu_hamil: boolean | null
  g_ibu_hamil_ttd: boolean | null
  g_remaja_putri_ttd: boolean | null
}

export interface SurveyIndikator {
  // Wajib (KK)
  i4_air_bersih: boolean
  i6_jamban_sehat: boolean
  i7_psn: boolean
  // GERMAS (non-PHBS, tidak masuk skor utama)
  // i11 dan i12 ada di ART level (g_cek_kesehatan, g_posyandu_hadir)
  catatan?: string | null
}

export interface PHBSScore {
  skor: number           // Numerator — jumlah indikator terpenuhi
  denominator: number    // N — jumlah indikator yang berlaku
  is_rt_sehat: boolean   // skor === denominator (harus 100%)
  kategori: string       // 'Sehat' | 'Tidak Sehat'
  display: string        // '8/8 (Sehat)' atau '5/9 (Tidak Sehat)'
  failed_indicators: string[]  // Label indikator yang gagal
}

export const INDIKATOR_LABELS: Record<string, string> = {
  i1_persalinan_nakes: 'Persalinan Nakes',
  i2_asi_eksklusif: 'ASI Eksklusif',
  i3_menimbang_balita: 'Menimbang Balita',
  i4_air_bersih: 'Air Bersih',
  i5_cuci_tangan: 'Cuci Tangan Sabun',
  i6_jamban_sehat: 'Jamban Sehat',
  i7_psn: 'PSN/3M Plus',
  i8_makan_sayur_buah: 'Makan Sayur & Buah',
  i9_aktivitas_fisik: 'Aktivitas Fisik',
  i10_tidak_merokok: 'Tidak Merokok',
}

/**
 * Menghitung usia dalam tahun dari tanggal lahir
 */
export function hitungUsia(tgl_lahir: string): number {
  const today = new Date()
  const birth = new Date(tgl_lahir)
  let age = today.getFullYear() - birth.getFullYear()
  const m = today.getMonth() - birth.getMonth()
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--
  return age
}

/**
 * Menghitung usia dalam bulan dari tanggal lahir
 */
export function hitungUsiaBulan(tgl_lahir: string): number {
  const today = new Date()
  const birth = new Date(tgl_lahir)
  let months = (today.getFullYear() - birth.getFullYear()) * 12
  months -= birth.getMonth()
  months += today.getMonth()
  if (today.getDate() < birth.getDate()) {
    months--
  }
  return Math.max(0, months)
}

/**
 * Fungsi utama perhitungan skor PHBS Rumah Tangga
 * Berdasarkan logic-phbs.md:
 * - Applicability: I1, I2, I3 (NULL jika tidak berlaku)
 * - Role Modelling: I5, I8, I9 (dari data per-ART)
 * - Collective Negative: I10 (dari data per-ART)
 * - RT Sehat: HANYA jika skor = N (100%)
 */
export function hitungSkorPHBS(
  survey: SurveyIndikator,
  artResponses: ArtResponse[]
): PHBSScore {
  let skor = 0
  let N = 0
  const failed: string[] = []

  // ── I1: Persalinan Nakes (applicable jika ada anak < 5 th) ──
  const artI1 = artResponses.filter(a => a.i1_persalinan_nakes !== null && a.i1_persalinan_nakes !== undefined)
  if (artI1.length > 0) {
    N++
    // Semua applicable harus true
    if (artI1.every(a => a.i1_persalinan_nakes === true)) skor++
    else failed.push(INDIKATOR_LABELS.i1_persalinan_nakes)
  }

  // ── I2: ASI Eksklusif (applicable jika ada bayi 0-6 bln) ──
  const artI2 = artResponses.filter(a => a.i2_asi_eksklusif !== null && a.i2_asi_eksklusif !== undefined)
  if (artI2.length > 0) {
    N++
    // Semua applicable harus true
    if (artI2.every(a => a.i2_asi_eksklusif === true)) skor++
    else failed.push(INDIKATOR_LABELS.i2_asi_eksklusif)
  }

  // ── I3: Menimbang Balita (Role Modelling Khusus: min 1 balita ditimbang) ──
  const artI3 = artResponses.filter(a => a.i3_menimbang_balita !== null && a.i3_menimbang_balita !== undefined)
  if (artI3.length > 0) {
    N++
    // Minimal 1 harus true
    if (artI3.some(a => a.i3_menimbang_balita === true)) skor++
    else failed.push(INDIKATOR_LABELS.i3_menimbang_balita)
  }

  // ── I4: Air Bersih (KK) ──
  N++
  if (survey.i4_air_bersih) skor++
  else failed.push(INDIKATOR_LABELS.i4_air_bersih)

  // ── I5: Cuci Tangan Sabun (Role Modelling: min 1 ART ≥ 5 th bernilai true) ──
  const artCuciTangan = artResponses.filter(a => a.i5_cuci_tangan !== null)
  N++
  if (artCuciTangan.length > 0 && artCuciTangan.some(a => a.i5_cuci_tangan === true)) {
    skor++
  } else {
    failed.push(INDIKATOR_LABELS.i5_cuci_tangan)
  }

  // ── I6: Jamban Sehat (KK) ──
  N++
  if (survey.i6_jamban_sehat) skor++
  else failed.push(INDIKATOR_LABELS.i6_jamban_sehat)

  // ── I7: PSN/3M (KK) ──
  N++
  if (survey.i7_psn) skor++
  else failed.push(INDIKATOR_LABELS.i7_psn)

  // ── I8: Makan Sayur/Buah (Role Modelling: min 1 ART ≥ 10 th bernilai true) ──
  const artMakanSayur = artResponses.filter(a => a.i8_makan_sayur_buah !== null)
  N++
  if (artMakanSayur.length > 0 && artMakanSayur.some(a => a.i8_makan_sayur_buah === true)) {
    skor++
  } else {
    failed.push(INDIKATOR_LABELS.i8_makan_sayur_buah)
  }

  // ── I9: Aktivitas Fisik (Role Modelling: min 1 ART ≥ 10 th bernilai true) ──
  const artAktivitas = artResponses.filter(a => a.i9_aktivitas_fisik !== null)
  N++
  if (artAktivitas.length > 0 && artAktivitas.some(a => a.i9_aktivitas_fisik === true)) {
    skor++
  } else {
    failed.push(INDIKATOR_LABELS.i9_aktivitas_fisik)
  }

  // ── I10: Tidak Merokok (Collective Negative: jika ADA 1 ART merokok → 0) ──
  N++
  const adaYangMerokok = artResponses.some(a => a.i10_tidak_merokok === false)
  if (!adaYangMerokok) skor++
  else failed.push(INDIKATOR_LABELS.i10_tidak_merokok)

  const is_rt_sehat = skor === N
  const kategori = is_rt_sehat ? 'Sehat' : 'Tidak Sehat'
  const display = `${skor}/${N} (${kategori})`

  return { skor, denominator: N, is_rt_sehat, kategori, display, failed_indicators: failed }
}

/**
 * Menentukan pertanyaan mana yang berlaku untuk setiap ART
 * berdasarkan tanggal lahir dan jenis kelamin
 */
export function getARTQuestions(
  tgl_lahir: string, 
  jenis_kelamin: 'L' | 'P',
  hubungan_kk: string,
  has_bayi_1_tahun: boolean = false
): {
  show_i1: boolean   // Persalinan Nakes (Khusus Istri yang memiliki bayi <= 1 th)
  show_i2: boolean   // ASI Eksklusif (bayi 0-6 bln)
  show_i3: boolean   // Menimbang Balita (< 5 th)
  show_i5: boolean   // Cuci Tangan (≥ 5 th)
  show_i8: boolean   // Makan Sayur (≥ 10 th)
  show_i9: boolean   // Aktivitas Fisik (≥ 10 th)
  show_i10: boolean  // Tidak Merokok (Semua Umur)
  show_ckg: boolean  // Cek Kesehatan GERMAS (semua usia)
  show_posyandu: boolean  // Posyandu GERMAS (semua usia)
  show_ibu_hamil: boolean // Pertanyaan apakah sedang hamil? (Perempuan 15-49 th)
  show_remaja_putri_ttd: boolean // TTD Remaja Putri (Perempuan 12-18 th)
} {
  const usia = hitungUsia(tgl_lahir)
  const usia_bulan = hitungUsiaBulan(tgl_lahir)

  return {
    show_i1: hubungan_kk.toLowerCase().includes('istri') && jenis_kelamin === 'P' && has_bayi_1_tahun, // Khusus Istri/Suami (Perempuan)
    show_i2: usia_bulan <= 6, // 0 sampai 6 bulan
    show_i3: usia < 5,
    show_i5: usia >= 5,
    show_i8: usia >= 10,
    show_i9: usia >= 10,
    show_i10: true, // Ditanyakan ke semua umur sesuai instruksi
    show_ckg: true,
    show_posyandu: true,
    show_ibu_hamil: jenis_kelamin === 'P' && usia >= 15 && usia <= 49,
    show_remaja_putri_ttd: jenis_kelamin === 'P' && usia >= 12 && usia <= 18,
  }
}
