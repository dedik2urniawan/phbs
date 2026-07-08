-- =========================================================
-- PATCH 016: HYGIENE INDEX & UNINDEXED FK
-- Tujuan:
-- 1. Menghapus index duplikat secara aman (CONCURRENTLY)
-- 2. Menambah index pada Foreign Key yang belum memiliki index
-- =========================================================

-- PERINGATAN: Jalankan script ini di SQL Editor Supabase.
-- Karena perintah DROP/CREATE INDEX CONCURRENTLY tidak boleh 
-- dijalankan di dalam blok transaksi (BEGIN/COMMIT), jalankan langsung!

-- 1) DROP DUPLICATE INDEXES (Untuk meringankan beban Write/Insert)
DROP INDEX CONCURRENTLY IF EXISTS public.idx_family_members_household;
DROP INDEX CONCURRENTLY IF EXISTS public.idx_households_desa;
DROP INDEX CONCURRENTLY IF EXISTS public.idx_households_puskesmas;
DROP INDEX CONCURRENTLY IF EXISTS public.idx_kader_desa_id;
DROP INDEX CONCURRENTLY IF EXISTS public.idx_kader_puskesmas_id;
DROP INDEX CONCURRENTLY IF EXISTS public.idx_ref_desa_puskesmas;
DROP INDEX CONCURRENTLY IF EXISTS public.idx_survey_art_member_id;
DROP INDEX CONCURRENTLY IF EXISTS public.idx_survey_art_survey_id;
DROP INDEX CONCURRENTLY IF EXISTS public.idx_surveys_household;

-- 2) ADD MISSING FOREIGN KEY INDEXES (Meningkatkan performa relasi)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sasaran_kk_created_by ON public.sasaran_kk(created_by);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_surveys_created_by ON public.surveys(created_by);
