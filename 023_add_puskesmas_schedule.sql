-- =========================================================
-- PATCH 023: PUSKESMAS SCHEDULE TOGGLE
-- Tujuan: 
-- Menambahkan fitur pengunci jadwal Puskesmas (aktif/nonaktif)
-- =========================================================

BEGIN;

-- 1. Tambahkan kolom is_active di tabel ref_puskesmas (default aktif semua)
ALTER TABLE public.ref_puskesmas 
ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;

-- 2. Nonaktifkan akses untuk Puskesmas Kelompok B (10 - 31 Agustus 2026)
--    Sesuai dengan gambar jadwal Kick Off yang diberikan.
UPDATE public.ref_puskesmas
SET is_active = false
WHERE nama IN (
  'DONOMULYO', 
  'KALIPARE', 
  'PAGAK', 
  'SUMBERMANJING KULON', 
  'BANTUR', 
  'WONOKERTO', 
  'GEDANGAN', 
  'SITIARJO', 
  'SUMBERMANJING WETAN', 
  'DAMPIT', 
  'PAMOTAN', 
  'TIRTOYUDO', 
  'AMPEL GADING', 
  'PONCOKUSUMO', 
  'KARANGPLOSO', 
  'DAU', 
  'PUJON', 
  'NGANTANG', 
  'KASEMBON'
);

-- Muat ulang schema postgREST agar kolom baru langsung dikenali oleh API
NOTIFY pgrst, 'reload schema';

COMMIT;
