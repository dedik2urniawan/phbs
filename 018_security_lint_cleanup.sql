-- =========================================================
-- PATCH 018: Security Lint & RLS Consolidation
-- Tujuan:
-- 1. Membersihkan 'Multiple Permissive Policies' (Overlap)
-- 2. Mengganti referensi user_metadata menjadi Fungsi Security Definer
-- 3. Mengamankan fungsi dengan `SET search_path = public`
-- =========================================================

BEGIN;

-- =========================================================
-- 1. PERKUAT FUNGSI SECURITY DEFINER (MENGATASI REKURSIF RLS)
-- =========================================================
-- Menggunakan SECURITY DEFINER agar dapat membaca tabel app_users 
-- tanpa memicu infinite recursion pada RLS app_users itu sendiri.

CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.app_users WHERE id = (SELECT auth.uid());
$$;

CREATE OR REPLACE FUNCTION public.get_my_puskesmas()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT puskesmas_id FROM public.app_users WHERE id = (SELECT auth.uid());
$$;

-- Amankan hak akses eksekusi
REVOKE EXECUTE ON FUNCTION public.get_my_role() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_my_role() TO authenticated;

REVOKE EXECUTE ON FUNCTION public.get_my_puskesmas() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_my_puskesmas() TO authenticated;


-- Amankan fungsi composite sync dari injeksi search_path
ALTER FUNCTION public.sync_offline_composite SET search_path = public;
REVOKE EXECUTE ON FUNCTION public.sync_offline_composite FROM public, anon;
GRANT EXECUTE ON FUNCTION public.sync_offline_composite TO authenticated;


-- =========================================================
-- 2. KONSOLIDASI RLS APP_USERS
-- =========================================================
-- Hapus semua policy lama yang bertumpuk (overlap)
DROP POLICY IF EXISTS "app_users_read_own" ON public.app_users;
DROP POLICY IF EXISTS "Strict_Puskesmas_Access_App_Users" ON public.app_users;
DROP POLICY IF EXISTS "sync_insert_hotfix_app_users" ON public.app_users;

-- Buat 1 Policy Spesifik Menggunakan Fungsi Security Definer
CREATE POLICY "app_users_select_scoped"
ON public.app_users FOR SELECT TO authenticated
USING (
  id = (SELECT auth.uid()) 
  OR public.get_my_role() IN ('superadmin', 'stakeholder')
  OR puskesmas_id = public.get_my_puskesmas()
);

-- (User tidak boleh meng-insert/update user lain, hanya admin via dashboard)
CREATE POLICY "app_users_update_scoped"
ON public.app_users FOR UPDATE TO authenticated
USING (
  id = (SELECT auth.uid()) 
  OR public.get_my_role() = 'superadmin'
);


-- =========================================================
-- 3. KONSOLIDASI RLS HOUSEHOLDS
-- =========================================================
DROP POLICY IF EXISTS "Strict_Puskesmas_Access_Households" ON public.households;
DROP POLICY IF EXISTS "sync_insert_hotfix_households" ON public.households;
DROP POLICY IF EXISTS "households_select_scoped" ON public.households;
DROP POLICY IF EXISTS "households_insert_scoped" ON public.households;
DROP POLICY IF EXISTS "households_update_scoped" ON public.households;

CREATE POLICY "households_select_final"
ON public.households FOR SELECT TO authenticated
USING (
  puskesmas_id = public.get_my_puskesmas()
  OR public.get_my_role() IN ('superadmin', 'stakeholder')
);

CREATE POLICY "households_insert_final"
ON public.households FOR INSERT TO authenticated
WITH CHECK (
  puskesmas_id = public.get_my_puskesmas()
  OR public.get_my_role() IN ('superadmin', 'stakeholder')
);

CREATE POLICY "households_update_final"
ON public.households FOR UPDATE TO authenticated
USING (
  puskesmas_id = public.get_my_puskesmas()
  OR public.get_my_role() IN ('superadmin', 'stakeholder')
);


-- =========================================================
-- 4. KONSOLIDASI RLS FAMILY_MEMBERS
-- =========================================================
DROP POLICY IF EXISTS "Strict_Puskesmas_Access_Members" ON public.family_members;
DROP POLICY IF EXISTS "sync_insert_hotfix_family_members" ON public.family_members;
DROP POLICY IF EXISTS "Atomic_Sync_Policy_Members" ON public.family_members;
DROP POLICY IF EXISTS "family_members_select_scoped" ON public.family_members;
DROP POLICY IF EXISTS "family_members_insert_scoped" ON public.family_members;
DROP POLICY IF EXISTS "family_members_update_scoped" ON public.family_members;

CREATE POLICY "family_members_select_final"
ON public.family_members FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.households h
    WHERE h.id = family_members.household_id
      AND (h.puskesmas_id = public.get_my_puskesmas() OR public.get_my_role() IN ('superadmin', 'stakeholder'))
  )
);

CREATE POLICY "family_members_insert_final"
ON public.family_members FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.households h
    WHERE h.id = family_members.household_id
      AND (h.puskesmas_id = public.get_my_puskesmas() OR public.get_my_role() IN ('superadmin', 'stakeholder'))
  )
);

CREATE POLICY "family_members_update_final"
ON public.family_members FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.households h
    WHERE h.id = family_members.household_id
      AND (h.puskesmas_id = public.get_my_puskesmas() OR public.get_my_role() IN ('superadmin', 'stakeholder'))
  )
);


-- =========================================================
-- 5. KONSOLIDASI RLS SURVEYS
-- =========================================================
DROP POLICY IF EXISTS "surveys_select_scoped" ON public.surveys;
DROP POLICY IF EXISTS "surveys_insert_scoped" ON public.surveys;
DROP POLICY IF EXISTS "surveys_update_scoped" ON public.surveys;

CREATE POLICY "surveys_select_final"
ON public.surveys FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.households h
    WHERE h.id = surveys.household_id
      AND (h.puskesmas_id = public.get_my_puskesmas() OR public.get_my_role() IN ('superadmin', 'stakeholder'))
  )
);

CREATE POLICY "surveys_insert_final"
ON public.surveys FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.households h
    WHERE h.id = surveys.household_id
      AND (h.puskesmas_id = public.get_my_puskesmas() OR public.get_my_role() IN ('superadmin', 'stakeholder'))
  )
);

CREATE POLICY "surveys_update_final"
ON public.surveys FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.households h
    WHERE h.id = surveys.household_id
      AND (h.puskesmas_id = public.get_my_puskesmas() OR public.get_my_role() IN ('superadmin', 'stakeholder'))
  )
);


-- =========================================================
-- 6. KONSOLIDASI RLS SURVEY_ART_RESPONSES
-- =========================================================
DROP POLICY IF EXISTS "survey_art_select_scoped" ON public.survey_art_responses;
DROP POLICY IF EXISTS "survey_art_insert_scoped" ON public.survey_art_responses;
DROP POLICY IF EXISTS "survey_art_update_scoped" ON public.survey_art_responses;

CREATE POLICY "survey_art_select_final"
ON public.survey_art_responses FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.surveys s
    JOIN public.households h ON h.id = s.household_id
    WHERE s.id = survey_art_responses.survey_id
      AND (h.puskesmas_id = public.get_my_puskesmas() OR public.get_my_role() IN ('superadmin', 'stakeholder'))
  )
);

CREATE POLICY "survey_art_insert_final"
ON public.survey_art_responses FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.surveys s
    JOIN public.households h ON h.id = s.household_id
    WHERE s.id = survey_art_responses.survey_id
      AND (h.puskesmas_id = public.get_my_puskesmas() OR public.get_my_role() IN ('superadmin', 'stakeholder'))
  )
);

CREATE POLICY "survey_art_update_final"
ON public.survey_art_responses FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.surveys s
    JOIN public.households h ON h.id = s.household_id
    WHERE s.id = survey_art_responses.survey_id
      AND (h.puskesmas_id = public.get_my_puskesmas() OR public.get_my_role() IN ('superadmin', 'stakeholder'))
  )
);

COMMIT;
