-- =========================================================
-- PATCH 021: Ultimate Kick-Off Performance & Cleanup
-- Tujuan:
-- 1. Membersihkan TOTAL seluruh RLS policies lawas 
--    (mengatasi "multiple_permissive_policies" dan "auth_rls_initplan").
-- 2. Membuat ulang HANYA policy Inline yang 100% optimal.
-- 3. Hardening Function Security (SET search_path = public).
-- 4. B-Tree Indexes untuk NIK dan No KK (PWA Search Optimization).
-- =========================================================

BEGIN;

-- =========================================================
-- 1. DROP ALL EXISTING POLICIES UNTUK MEMBERSIHKAN DEBT LAMA
-- =========================================================
DO $$ 
DECLARE 
    r RECORD;
BEGIN 
    -- Menghapus SEMUA policy di tabel-tabel utama kita
    FOR r IN (
        SELECT policyname, tablename 
        FROM pg_policies 
        WHERE schemaname = 'public' 
          AND tablename IN ('app_users', 'households', 'family_members', 'surveys', 'survey_art_responses', 'kader_phbs', 'sasaran_kk')
    ) 
    LOOP 
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.policyname, r.tablename); 
    END LOOP; 
END $$;


-- =========================================================
-- 2. CREATE INLINE POLICIES (BEBAS AUTH_RLS_INITPLAN)
-- =========================================================

-- APP_USERS
CREATE POLICY "app_users_select_inline"
ON public.app_users FOR SELECT TO authenticated
USING (
  id = (SELECT auth.uid()) 
  OR (SELECT role FROM public.app_users WHERE id = (SELECT auth.uid())) IN ('superadmin', 'stakeholder')
  OR puskesmas_id = (SELECT puskesmas_id FROM public.app_users WHERE id = (SELECT auth.uid()))
);

CREATE POLICY "app_users_update_inline"
ON public.app_users FOR UPDATE TO authenticated
USING (
  id = (SELECT auth.uid()) 
  OR (SELECT role FROM public.app_users WHERE id = (SELECT auth.uid())) = 'superadmin'
);

-- HOUSEHOLDS
CREATE POLICY "households_select_inline"
ON public.households FOR SELECT TO authenticated
USING (
  puskesmas_id = (SELECT puskesmas_id FROM public.app_users WHERE id = (SELECT auth.uid()))
  OR (SELECT role FROM public.app_users WHERE id = (SELECT auth.uid())) IN ('superadmin', 'stakeholder')
);

CREATE POLICY "households_insert_inline"
ON public.households FOR INSERT TO authenticated
WITH CHECK (
  puskesmas_id = (SELECT puskesmas_id FROM public.app_users WHERE id = (SELECT auth.uid()))
  OR (SELECT role FROM public.app_users WHERE id = (SELECT auth.uid())) IN ('superadmin', 'stakeholder')
);

CREATE POLICY "households_update_inline"
ON public.households FOR UPDATE TO authenticated
USING (
  puskesmas_id = (SELECT puskesmas_id FROM public.app_users WHERE id = (SELECT auth.uid()))
  OR (SELECT role FROM public.app_users WHERE id = (SELECT auth.uid())) IN ('superadmin', 'stakeholder')
);

CREATE POLICY "households_delete_inline"
ON public.households FOR DELETE TO authenticated
USING (
  puskesmas_id = (SELECT puskesmas_id FROM public.app_users WHERE id = (SELECT auth.uid()))
  OR (SELECT role FROM public.app_users WHERE id = (SELECT auth.uid())) IN ('superadmin', 'stakeholder')
);

-- FAMILY_MEMBERS
CREATE POLICY "family_members_select_inline"
ON public.family_members FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.households h
    WHERE h.id = family_members.household_id
      AND (
        h.puskesmas_id = (SELECT puskesmas_id FROM public.app_users WHERE id = (SELECT auth.uid())) 
        OR (SELECT role FROM public.app_users WHERE id = (SELECT auth.uid())) IN ('superadmin', 'stakeholder')
      )
  )
);

CREATE POLICY "family_members_insert_inline"
ON public.family_members FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.households h
    WHERE h.id = family_members.household_id
      AND (
        h.puskesmas_id = (SELECT puskesmas_id FROM public.app_users WHERE id = (SELECT auth.uid())) 
        OR (SELECT role FROM public.app_users WHERE id = (SELECT auth.uid())) IN ('superadmin', 'stakeholder')
      )
  )
);

CREATE POLICY "family_members_update_inline"
ON public.family_members FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.households h
    WHERE h.id = family_members.household_id
      AND (
        h.puskesmas_id = (SELECT puskesmas_id FROM public.app_users WHERE id = (SELECT auth.uid())) 
        OR (SELECT role FROM public.app_users WHERE id = (SELECT auth.uid())) IN ('superadmin', 'stakeholder')
      )
  )
);

CREATE POLICY "family_members_delete_inline"
ON public.family_members FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.households h
    WHERE h.id = family_members.household_id
      AND (
        h.puskesmas_id = (SELECT puskesmas_id FROM public.app_users WHERE id = (SELECT auth.uid())) 
        OR (SELECT role FROM public.app_users WHERE id = (SELECT auth.uid())) IN ('superadmin', 'stakeholder')
      )
  )
);

-- SURVEYS
CREATE POLICY "surveys_select_inline"
ON public.surveys FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.households h
    WHERE h.id = surveys.household_id
      AND (
        h.puskesmas_id = (SELECT puskesmas_id FROM public.app_users WHERE id = (SELECT auth.uid())) 
        OR (SELECT role FROM public.app_users WHERE id = (SELECT auth.uid())) IN ('superadmin', 'stakeholder')
      )
  )
);

CREATE POLICY "surveys_insert_inline"
ON public.surveys FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.households h
    WHERE h.id = surveys.household_id
      AND (
        h.puskesmas_id = (SELECT puskesmas_id FROM public.app_users WHERE id = (SELECT auth.uid())) 
        OR (SELECT role FROM public.app_users WHERE id = (SELECT auth.uid())) IN ('superadmin', 'stakeholder')
      )
  )
);

CREATE POLICY "surveys_update_inline"
ON public.surveys FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.households h
    WHERE h.id = surveys.household_id
      AND (
        h.puskesmas_id = (SELECT puskesmas_id FROM public.app_users WHERE id = (SELECT auth.uid())) 
        OR (SELECT role FROM public.app_users WHERE id = (SELECT auth.uid())) IN ('superadmin', 'stakeholder')
      )
  )
);

CREATE POLICY "surveys_delete_inline"
ON public.surveys FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.households h
    WHERE h.id = surveys.household_id
      AND (
        h.puskesmas_id = (SELECT puskesmas_id FROM public.app_users WHERE id = (SELECT auth.uid())) 
        OR (SELECT role FROM public.app_users WHERE id = (SELECT auth.uid())) IN ('superadmin', 'stakeholder')
      )
  )
);

-- SURVEY_ART_RESPONSES
CREATE POLICY "survey_art_select_inline"
ON public.survey_art_responses FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.surveys s
    JOIN public.households h ON h.id = s.household_id
    WHERE s.id = survey_art_responses.survey_id
      AND (
        h.puskesmas_id = (SELECT puskesmas_id FROM public.app_users WHERE id = (SELECT auth.uid())) 
        OR (SELECT role FROM public.app_users WHERE id = (SELECT auth.uid())) IN ('superadmin', 'stakeholder')
      )
  )
);

CREATE POLICY "survey_art_insert_inline"
ON public.survey_art_responses FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.surveys s
    JOIN public.households h ON h.id = s.household_id
    WHERE s.id = survey_art_responses.survey_id
      AND (
        h.puskesmas_id = (SELECT puskesmas_id FROM public.app_users WHERE id = (SELECT auth.uid())) 
        OR (SELECT role FROM public.app_users WHERE id = (SELECT auth.uid())) IN ('superadmin', 'stakeholder')
      )
  )
);

CREATE POLICY "survey_art_update_inline"
ON public.survey_art_responses FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.surveys s
    JOIN public.households h ON h.id = s.household_id
    WHERE s.id = survey_art_responses.survey_id
      AND (
        h.puskesmas_id = (SELECT puskesmas_id FROM public.app_users WHERE id = (SELECT auth.uid())) 
        OR (SELECT role FROM public.app_users WHERE id = (SELECT auth.uid())) IN ('superadmin', 'stakeholder')
      )
  )
);

CREATE POLICY "survey_art_delete_inline"
ON public.survey_art_responses FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.surveys s
    JOIN public.households h ON h.id = s.household_id
    WHERE s.id = survey_art_responses.survey_id
      AND (
        h.puskesmas_id = (SELECT puskesmas_id FROM public.app_users WHERE id = (SELECT auth.uid())) 
        OR (SELECT role FROM public.app_users WHERE id = (SELECT auth.uid())) IN ('superadmin', 'stakeholder')
      )
  )
);

-- KADER_PHBS
CREATE POLICY "kader_phbs_select_inline"
ON public.kader_phbs FOR SELECT TO authenticated
USING (
  puskesmas_id = (SELECT puskesmas_id FROM public.app_users WHERE id = (SELECT auth.uid()))
  OR (SELECT role FROM public.app_users WHERE id = (SELECT auth.uid())) IN ('superadmin', 'stakeholder')
);

CREATE POLICY "kader_phbs_insert_inline"
ON public.kader_phbs FOR INSERT TO authenticated
WITH CHECK (
  puskesmas_id = (SELECT puskesmas_id FROM public.app_users WHERE id = (SELECT auth.uid()))
  OR (SELECT role FROM public.app_users WHERE id = (SELECT auth.uid())) IN ('superadmin', 'stakeholder')
);

CREATE POLICY "kader_phbs_update_inline"
ON public.kader_phbs FOR UPDATE TO authenticated
USING (
  puskesmas_id = (SELECT puskesmas_id FROM public.app_users WHERE id = (SELECT auth.uid()))
  OR (SELECT role FROM public.app_users WHERE id = (SELECT auth.uid())) IN ('superadmin', 'stakeholder')
);

CREATE POLICY "kader_phbs_delete_inline"
ON public.kader_phbs FOR DELETE TO authenticated
USING (
  puskesmas_id = (SELECT puskesmas_id FROM public.app_users WHERE id = (SELECT auth.uid()))
  OR (SELECT role FROM public.app_users WHERE id = (SELECT auth.uid())) IN ('superadmin', 'stakeholder')
);


-- SASARAN_KK
CREATE POLICY "sasaran_kk_select_inline"
ON public.sasaran_kk FOR SELECT TO authenticated
USING (
  puskesmas_id = (SELECT puskesmas_id FROM public.app_users WHERE id = (SELECT auth.uid()))
  OR (SELECT role FROM public.app_users WHERE id = (SELECT auth.uid())) IN ('superadmin', 'stakeholder')
);

CREATE POLICY "sasaran_kk_insert_inline"
ON public.sasaran_kk FOR INSERT TO authenticated
WITH CHECK (
  puskesmas_id = (SELECT puskesmas_id FROM public.app_users WHERE id = (SELECT auth.uid()))
  OR (SELECT role FROM public.app_users WHERE id = (SELECT auth.uid())) IN ('superadmin', 'stakeholder')
);

CREATE POLICY "sasaran_kk_update_inline"
ON public.sasaran_kk FOR UPDATE TO authenticated
USING (
  puskesmas_id = (SELECT puskesmas_id FROM public.app_users WHERE id = (SELECT auth.uid()))
  OR (SELECT role FROM public.app_users WHERE id = (SELECT auth.uid())) IN ('superadmin', 'stakeholder')
);

CREATE POLICY "sasaran_kk_delete_inline"
ON public.sasaran_kk FOR DELETE TO authenticated
USING (
  puskesmas_id = (SELECT puskesmas_id FROM public.app_users WHERE id = (SELECT auth.uid()))
  OR (SELECT role FROM public.app_users WHERE id = (SELECT auth.uid())) IN ('superadmin', 'stakeholder')
);

-- =========================================================
-- 3. HARDEN FUNCTION SECURITY (P3)
-- =========================================================
-- Set search_path pada fungsi sync_offline_composite sudah ada sebelumnya, tapi mari kita tegaskan ulang di fungsi lain jika ada
ALTER FUNCTION public.sync_offline_composite(jsonb, jsonb, jsonb, jsonb) SET search_path = public;

-- =========================================================
-- 4. B-TREE INDEXES UNTUK PENCARIAN NIK/NO_KK (PWA OPTIMIZATION)
-- =========================================================
-- Karena query kita akan menggunakan .like '3507%' di Supabase JS, 
-- standar B-Tree index PostgreSQL tidak langsung menggunakan index jika menggunakan default ops.
-- Supaya `LIKE` query bisa menggunakan index, kita harus menggunakan `varchar_pattern_ops`.
CREATE INDEX IF NOT EXISTS idx_households_no_kk_pattern ON public.households (no_kk varchar_pattern_ops);
CREATE INDEX IF NOT EXISTS idx_households_nik_kk_pattern ON public.households (nik_kk varchar_pattern_ops);

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';

COMMIT;
