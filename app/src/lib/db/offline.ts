import Dexie, { Table } from 'dexie'

// ===== LOCAL TYPES =====
export interface LocalHousehold {
  id: string               // UUID (generate client-side)
  puskesmas_id: string
  desa_id: string
  no_kk: string
  nama_kk: string
  alamat: string
  rt: string
  rw: string
  created_by: string
  created_at: string
  updated_at: string
  sync_status: 'synced' | 'pending' | 'error'
}

export interface LocalFamilyMember {
  id: string
  household_id: string
  nama: string
  nik: string | null
  jenis_kelamin: 'L' | 'P'
  tgl_lahir: string
  hubungan_kk: string
  pendidikan: string | null
  pekerjaan: string | null
  created_at: string
  sync_status: 'synced' | 'pending' | 'error'
}

export interface LocalSurvey {
  id: string
  household_id: string
  tahun: number
  survey_date: string
  // 17 Indikator (sesuai schema DB)
  i1_persalinan_nakes: boolean | null
  i2_asi_eksklusif: boolean | null
  i3_menimbang_balita: boolean | null
  i4_air_bersih: boolean
  i5_cuci_tangan: boolean
  i6_jamban_sehat: boolean
  i7_psn: boolean
  i8_makan_sayur_buah: boolean
  i9_aktivitas_fisik: boolean
  i10_tidak_merokok: boolean
  i11_cek_kesehatan: boolean
  i12_kunjungan_posyandu: boolean
  i13_pengunjung_posyandu: string[] | null
  i14_ibu_hamil: boolean
  i15_ibu_hamil_ttd: boolean | null
  i16_remaja_putri: boolean
  i17_remaja_putri_ttd: boolean | null
  catatan: string | null
  created_by: string
  created_at: string
  updated_at: string
  sync_status: 'synced' | 'pending' | 'error'
}

export interface SyncQueueItem {
  id?: number             // auto-increment
  table_name: string
  record_id: string
  operation: 'insert' | 'update' | 'delete'
  payload: string         // JSON.stringify(record)
  created_at: string
  retries: number
}

// ===== DEXIE DATABASE =====
class PHBSDatabase extends Dexie {
  households!: Table<LocalHousehold>
  family_members!: Table<LocalFamilyMember>
  surveys!: Table<LocalSurvey>
  sync_queue!: Table<SyncQueueItem>

  constructor() {
    super('PHBS_DB')
    this.version(1).stores({
      households:     'id, puskesmas_id, desa_id, no_kk, sync_status, created_at',
      family_members: 'id, household_id, nik, sync_status',
      surveys:        'id, household_id, tahun, sync_status',
      sync_queue:     '++id, table_name, record_id, operation, created_at',
    })
  }
}

export const offlineDB = new PHBSDatabase()

// ===== HELPERS =====
export function generateLocalId(): string {
  return crypto.randomUUID()
}

export function nowISO(): string {
  return new Date().toISOString()
}
