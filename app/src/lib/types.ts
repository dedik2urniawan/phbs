export type UserRole = 'superadmin' | 'admin_puskesmas' | 'stakeholder'

export interface AppUser {
  id: string
  email: string
  role: UserRole
  puskesmas_id: string | null
  nama_lengkap: string | null
  created_at: string
}

export interface RefPuskesmas {
  id: string
  kode_puskesmas: string
  nama_puskesmas: string
  kecamatan: string
}

export interface RefDesa {
  id: string
  puskesmas_id: string
  puskesmas: string
  desa_kel: string
}

export interface Household {
  id: string
  no_kk: string
  kepala_keluarga: string
  nik_kepala: string
  alamat: string
  desa_id: string
  puskesmas_id: string
  user_id: string
  created_at: string
  ref_desa?: RefDesa
}

export interface Survey {
  id: string
  household_id: string
  tahun: number
  // 17 Indikator PHBS
  ind_1_persalinan_nakes: boolean | null
  ind_2_asi_eksklusif: boolean | null
  ind_3_timbang_balita: boolean | null
  ind_4_cuci_tangan: boolean | null
  ind_5_air_bersih: boolean | null
  ind_6_jamban_sehat: boolean | null
  ind_7_buang_sampah: boolean | null
  ind_8_lantai_rumah: boolean | null
  ind_9_merokok: boolean | null
  ind_10_jpkm: boolean | null
  ind_11_olahraga: boolean | null
  ind_12_makan_buah_sayur: boolean | null
  ind_13_psn: boolean | null
  ind_14_tidak_miras: boolean | null
  ind_15_tidak_narkoba: boolean | null
  ind_16_tidak_perilaku_seks: boolean | null
  ind_17_pemberantasan_serangga: boolean | null
  total_indikator: number | null
  kategori: 'Sehat Pratama' | 'Sehat Madya' | 'Sehat Utama' | 'Sehat Paripurna' | null
  surveyor_id: string
  created_at: string
  updated_at: string
}
