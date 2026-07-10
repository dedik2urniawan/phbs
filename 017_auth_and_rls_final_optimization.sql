-- =========================================================
-- PATCH 017: Optimasi RLS Lanjutan & Pembersihan Index
-- Tujuan:
-- 1. Menghapus index duplikat di tabel surveys.
-- 2. Memecah RLS tabel `surveys` menjadi terpisah per-aksi (SELECT, INSERT, UPDATE).
-- 3. Memecah RLS tabel `survey_art_responses` menjadi terpisah per-aksi (SELECT, INSERT, UPDATE).
-- =========================================================

BEGIN;

-- 1) DROP DUPLICATE INDEX
-- Menghapus index duplikat yang tumpang tindih dengan idx_surveys_tahun
DROP INDEX IF EXISTS public.idx_surveys_puskesmas_tahun;


-- =========================================================
-- 2) OPTIMASI RLS TABEL SURVEYS
-- =========================================================

ALTER TABLE public.surveys ENABLE ROW LEVEL SECURITY;

-- Hapus policy lama
DROP POLICY IF EXISTS "Strict_Puskesmas_Access_Surveys" ON public.surveys;
DROP POLICY IF EXISTS "sync_insert_hotfix_surveys" ON public.surveys;
DROP POLICY IF EXISTS "Atomic_Sync_Policy_Surveys" ON public.surveys;

-- Buat policy terpisah agar deterministik dan cepat
CREATE POLICY "surveys_select_scoped"
ON public.surveys FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.households h
    JOIN public.app_users au ON au.id = (SELECT auth.uid())
    WHERE h.id = surveys.household_id
      AND (au.role IN ('superadmin', 'stakeholder') OR h.puskesmas_id = au.puskesmas_id)
  )
);

CREATE POLICY "surveys_insert_scoped"
ON public.surveys FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.households h
    JOIN public.app_users au ON au.id = (SELECT auth.uid())
    WHERE h.id = surveys.household_id
      AND (au.role IN ('superadmin', 'stakeholder') OR h.puskesmas_id = au.puskesmas_id)
  )
);

CREATE POLICY "surveys_update_scoped"
ON public.surveys FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.households h
    JOIN public.app_users au ON au.id = (SELECT auth.uid())
    WHERE h.id = surveys.household_id
      AND (au.role IN ('superadmin', 'stakeholder') OR h.puskesmas_id = au.puskesmas_id)
  )
);


-- =========================================================
-- 3) OPTIMASI RLS TABEL SURVEY_ART_RESPONSES
-- =========================================================

ALTER TABLE public.survey_art_responses ENABLE ROW LEVEL SECURITY;

-- Hapus policy lama
DROP POLICY IF EXISTS "Strict_Puskesmas_Access_ART" ON public.survey_art_responses;
DROP POLICY IF EXISTS "sync_insert_hotfix_survey_art" ON public.survey_art_responses;
DROP POLICY IF EXISTS "Atomic_Sync_Policy_Survey_Art" ON public.survey_art_responses;

-- Buat policy terpisah
CREATE POLICY "survey_art_select_scoped"
ON public.survey_art_responses FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.surveys s
    JOIN public.households h ON h.id = s.household_id
    JOIN public.app_users au ON au.id = (SELECT auth.uid())
    WHERE s.id = survey_art_responses.survey_id
      AND (au.role IN ('superadmin', 'stakeholder') OR h.puskesmas_id = au.puskesmas_id)
  )
);

CREATE POLICY "survey_art_insert_scoped"
ON public.survey_art_responses FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.surveys s
    JOIN public.households h ON h.id = s.household_id
    JOIN public.app_users au ON au.id = (SELECT auth.uid())
    WHERE s.id = survey_art_responses.survey_id
      AND (au.role IN ('superadmin', 'stakeholder') OR h.puskesmas_id = au.puskesmas_id)
  )
);

CREATE POLICY "survey_art_update_scoped"
ON public.survey_art_responses FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.surveys s
    JOIN public.households h ON h.id = s.household_id
    JOIN public.app_users au ON au.id = (SELECT auth.uid())
    WHERE s.id = survey_art_responses.survey_id
      AND (au.role IN ('superadmin', 'stakeholder') OR h.puskesmas_id = au.puskesmas_id)
  )
);

COMMIT;
