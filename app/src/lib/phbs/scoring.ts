/**
 * PHBS Scoring Engine — logic-phbs.md v2
 * 10 Indikator Inti dengan Applicability, Role Modelling, dan Collective Negative
 */

export interface ArtResponse {
  id?: string
  family_member_id: string
  i5_cuci_tangan: boolean | null
  i8_makan_sayur_buah: boolean | null
  i9_aktivitas_fisik: boolean | null
  i10_tidak_merokok: boolean | null   // false = ART ini merokok
  g_cek_kesehatan: boolean | null
  g_posyandu_hadir: boolean | null
}

export interface SurveyIndikator {
  // Applicable jika ada bayi/balita
  i1_persalinan_nakes: boolean | null
  i2_asi_eksklusif: boolean | null
  i3_menimbang_balita: boolean | null
  // Wajib (KK)
  i4_air_bersih: boolean
  i6_jamban_sehat: boolean
  i7_psn: boolean
  // GERMAS (non-PHBS, tidak masuk skor utama)
  i11_cek_kesehatan?: boolean | null
  i12_kunjungan_posyandu?: boolean | null
  i14_ibu_hamil?: boolean | null
  i15_ibu_hamil_ttd?: boolean | null
  i16_remaja_putri?: boolean | null
  i17_remaja_putri_ttd?: boolean | null
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

  // ── I1: Persalinan Nakes (applicable jika ada ibu melahirkan < 5 th) ──
  if (survey.i1_persalinan_nakes !== null && survey.i1_persalinan_nakes !== undefined) {
    N++
    if (survey.i1_persalinan_nakes) skor++
    else failed.push(INDIKATOR_LABELS.i1_persalinan_nakes)
  }

  // ── I2: ASI Eksklusif (applicable jika ada bayi 0-6 bulan) ──
  if (survey.i2_asi_eksklusif !== null && survey.i2_asi_eksklusif !== undefined) {
    N++
    if (survey.i2_asi_eksklusif) skor++
    else failed.push(INDIKATOR_LABELS.i2_asi_eksklusif)
  }

  // ── I3: Menimbang Balita (Role Modelling Khusus: min 1 balita ditimbang) ──
  if (survey.i3_menimbang_balita !== null && survey.i3_menimbang_balita !== undefined) {
    N++
    if (survey.i3_menimbang_balita) skor++
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
 * berdasarkan usia dan jenis kelamin
 */
export function getARTQuestions(usia: number, jenis_kelamin: 'L' | 'P'): {
  show_i5: boolean   // Cuci Tangan (≥ 5 th)
  show_i8: boolean   // Makan Sayur (≥ 10 th)
  show_i9: boolean   // Aktivitas Fisik (≥ 10 th)
  show_i10: boolean  // Tidak Merokok (semua)
  show_ckg: boolean  // Cek Kesehatan GERMAS
  show_posyandu: boolean  // Posyandu GERMAS
} {
  return {
    show_i5: usia >= 5,
    show_i8: usia >= 10,
    show_i9: usia >= 10,
    show_i10: true,   // semua ART ditanya soal merokok
    show_ckg: usia >= 15,
    show_posyandu: usia < 5 || usia >= 60 || jenis_kelamin === 'P',
  }
}
