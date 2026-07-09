-- =========================================================
-- PATCH 016 (REVISI): HYGIENE INDEX & UNINDEXED FK
-- Tujuan:
-- 1. Menghapus index duplikat
-- 2. Menambah index pada Foreign Key yang belum memiliki index
-- Catatan: Kata "CONCURRENTLY" dihapus agar bisa dieksekusi 
-- sekaligus di dalam SQL Editor Supabase tanpa error "transaction block".
-- =========================================================

-- 1) DROP DUPLICATE INDEXES
DROP INDEX IF EXISTS public.idx_family_members_household;
DROP INDEX IF EXISTS public.idx_households_desa;
DROP INDEX IF EXISTS public.idx_households_puskesmas;
DROP INDEX IF EXISTS public.idx_kader_desa_id;
DROP INDEX IF EXISTS public.idx_kader_puskesmas_id;
DROP INDEX IF EXISTS public.idx_ref_desa_puskesmas;
DROP INDEX IF EXISTS public.idx_survey_art_member_id;
DROP INDEX IF EXISTS public.idx_survey_art_survey_id;
DROP INDEX IF EXISTS public.idx_surveys_household;

-- 2) ADD MISSING FOREIGN KEY INDEXES
CREATE INDEX IF NOT EXISTS idx_sasaran_kk_created_by ON public.sasaran_kk(created_by);
CREATE INDEX IF NOT EXISTS idx_surveys_created_by ON public.surveys(created_by);
