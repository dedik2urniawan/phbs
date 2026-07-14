-- =========================================================
-- PATCH 020: Ultimate RLS Initplan Refactor & UUID Guard
-- Tujuan:
-- 1. Menghapus fungsi Security Definer get_my_puskesmas() 
--    dan get_my_role() yang masih dievaluasi per-baris.
-- 2. Menggunakan Subquery In-line murni agar Postgres 
--    100% menjadikannya sebagai Initplan (dieksekusi 1x).
-- =========================================================

BEGIN;

-- =========================================================
-- 1. DROP FUNGSI SECURITY DEFINER LAMA
-- =========================================================
DROP FUNCTION IF EXISTS public.get_my_puskesmas();
DROP FUNCTION IF EXISTS public.get_my_role();


-- =========================================================
-- 2. REFACTOR RLS: APP_USERS
-- =========================================================
DROP POLICY IF EXISTS "app_users_select_scoped" ON public.app_users;
DROP POLICY IF EXISTS "app_users_update_scoped" ON public.app_users;

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


-- =========================================================
-- 3. REFACTOR RLS: HOUSEHOLDS
-- =========================================================
DROP POLICY IF EXISTS "households_select_final" ON public.households;
DROP POLICY IF EXISTS "households_insert_final" ON public.households;
DROP POLICY IF EXISTS "households_update_final" ON public.households;

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


-- =========================================================
-- 4. REFACTOR RLS: FAMILY_MEMBERS
-- =========================================================
DROP POLICY IF EXISTS "family_members_select_final" ON public.family_members;
DROP POLICY IF EXISTS "family_members_insert_final" ON public.family_members;
DROP POLICY IF EXISTS "family_members_update_final" ON public.family_members;

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


-- =========================================================
-- 5. REFACTOR RLS: SURVEYS
-- =========================================================
DROP POLICY IF EXISTS "surveys_select_final" ON public.surveys;
DROP POLICY IF EXISTS "surveys_insert_final" ON public.surveys;
DROP POLICY IF EXISTS "surveys_update_final" ON public.surveys;

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


-- =========================================================
-- 6. REFACTOR RLS: SURVEY_ART_RESPONSES
-- =========================================================
DROP POLICY IF EXISTS "survey_art_select_final" ON public.survey_art_responses;
DROP POLICY IF EXISTS "survey_art_insert_final" ON public.survey_art_responses;
DROP POLICY IF EXISTS "survey_art_update_final" ON public.survey_art_responses;

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


-- =========================================================
-- 7. REFACTOR RLS: KADER_PHBS
-- =========================================================
DROP POLICY IF EXISTS "kader_phbs_select_final" ON public.kader_phbs;
DROP POLICY IF EXISTS "kader_phbs_insert_final" ON public.kader_phbs;
DROP POLICY IF EXISTS "kader_phbs_update_final" ON public.kader_phbs;

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


-- =========================================================
-- 8. REFACTOR RLS: SASARAN_KK
-- =========================================================
DROP POLICY IF EXISTS "sasaran_kk_select_final" ON public.sasaran_kk;
DROP POLICY IF EXISTS "sasaran_kk_insert_final" ON public.sasaran_kk;
DROP POLICY IF EXISTS "sasaran_kk_update_final" ON public.sasaran_kk;

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


-- Pastikan schema cache di-reload untuk PostgREST
NOTIFY pgrst, 'reload schema';

COMMIT;
