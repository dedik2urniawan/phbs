// ===== NIK VALIDATOR =====
// Format NIK Indonesia: 16 digit
// - Digit 1-2: Kode Provinsi
// - Digit 3-4: Kode Kab/Kota
// - Digit 5-6: Kode Kecamatan
// - Digit 7-12: Tanggal lahir (DDMMYY), perempuan digit ke-7 ditambah 40
// - Digit 13-16: Nomor urut pendaftaran

export interface NIKValidationResult {
  valid: boolean
  error?: string
  info?: {
    provinsi_kode: string
    kab_kota_kode: string
    kecamatan_kode: string
    tgl_lahir: Date | null
    jenis_kelamin: 'L' | 'P' | null
    urut: string
  }
}

export function validateNIK(nik: string): NIKValidationResult {
  // Bersihkan spasi
  const clean = nik.replace(/\s/g, '')

  if (!clean) {
    return { valid: false, error: 'NIK tidak boleh kosong' }
  }

  if (!/^\d+$/.test(clean)) {
    return { valid: false, error: 'NIK hanya boleh berisi angka' }
  }

  if (clean.length !== 16) {
    return { valid: false, error: `NIK harus 16 digit (saat ini ${clean.length} digit)` }
  }

  // Parse komponen
  const provinsiKode = clean.substring(0, 2)
  const kabKotaKode  = clean.substring(2, 4)
  const kecamatanKode = clean.substring(4, 6)
  const tglStr       = clean.substring(6, 12)   // DDMMYY
  const urut         = clean.substring(12, 16)

  // Validasi kode provinsi (01-38 valid per 2024)
  const prov = parseInt(provinsiKode)
  if (prov < 1 || prov > 99) {
    return { valid: false, error: 'Kode provinsi tidak valid' }
  }

  // Parse tanggal lahir
  let dd = parseInt(tglStr.substring(0, 2))
  const mm = parseInt(tglStr.substring(2, 4))
  const yy = parseInt(tglStr.substring(4, 6))

  let jenisKelamin: 'L' | 'P' | null = null
  if (dd > 40) {
    jenisKelamin = 'P'
    dd -= 40
  } else {
    jenisKelamin = 'L'
  }

  // Validasi bulan
  if (mm < 1 || mm > 12) {
    return { valid: false, error: 'Komponen bulan lahir pada NIK tidak valid' }
  }

  // Validasi tanggal
  if (dd < 1 || dd > 31) {
    return { valid: false, error: 'Komponen tanggal lahir pada NIK tidak valid' }
  }

  // Hitung tahun (asumsi: yy < 30 → 2000-an, yy >= 30 → 1900-an)
  const currentYear = new Date().getFullYear() % 100
  const century = yy <= currentYear ? 2000 : 1900
  const fullYear = century + yy

  let tglLahir: Date | null = null
  try {
    tglLahir = new Date(fullYear, mm - 1, dd)
    if (isNaN(tglLahir.getTime())) tglLahir = null
  } catch {
    tglLahir = null
  }

  return {
    valid: true,
    info: {
      provinsi_kode: provinsiKode,
      kab_kota_kode: kabKotaKode,
      kecamatan_kode: kecamatanKode,
      tgl_lahir: tglLahir,
      jenis_kelamin: jenisKelamin,
      urut,
    }
  }
}

export function formatNIK(nik: string): string {
  return nik.replace(/\s/g, '')
}

// Validasi No KK: 16 digit
export function validateNoKK(noKK: string): { valid: boolean; error?: string } {
  const clean = noKK.replace(/\s/g, '')
  if (!clean) return { valid: false, error: 'No KK tidak boleh kosong' }
  if (!/^\d+$/.test(clean)) return { valid: false, error: 'No KK hanya boleh berisi angka' }
  if (clean.length !== 16) return { valid: false, error: `No KK harus 16 digit (saat ini ${clean.length})` }
  return { valid: true }
}
