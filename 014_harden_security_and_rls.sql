-- =================================================================================
-- 🚀 FASE 14: RLS HARDENING, SECURITY DEFINER, & INDEX OPTIMIZATION
-- =================================================================================
-- Skrip ini akan melakukan:
-- 1. Pembersihan kebijakan RLS (Policy) lama dan tumpang tindih.
-- 2. Penerapan RLS initplan `(select auth.uid())` untuk performa kueri.
-- 3. Pengamanan fungsi SECURITY DEFINER (search_path, hak akses).
-- 4. Pembuatan Indeks B-Tree untuk Foreign Keys.

-- =================================================================================
-- 1. BERSIHKAN SEMUA KEBIJAKAN LAMA (Termasuk Hotfix)
-- =================================================================================

-- Households
DROP POLICY IF EXISTS "sync_insert_hotfix_households" ON households;
DROP POLICY IF EXISTS "Strict_Puskesmas_Access_Households" ON households;
DROP POLICY IF EXISTS "Atomic_Sync_Policy_Households" ON households;

-- Family Members
DROP POLICY IF EXISTS "sync_insert_hotfix_family_members" ON family_members;
DROP POLICY IF EXISTS "Strict_Puskesmas_Access_Family_Members" ON family_members;
DROP POLICY IF EXISTS "Atomic_Sync_Policy_Family_Members" ON family_members;

-- Surveys
DROP POLICY IF EXISTS "sync_insert_hotfix_surveys" ON surveys;
DROP POLICY IF EXISTS "Strict_Puskesmas_Access_Surveys" ON surveys;
DROP POLICY IF EXISTS "Atomic_Sync_Policy_Surveys" ON surveys;

-- Survey ART
DROP POLICY IF EXISTS "sync_insert_hotfix_survey_art" ON survey_art_responses;
DROP POLICY IF EXISTS "Strict_Puskesmas_Access_ART" ON survey_art_responses;
DROP POLICY IF EXISTS "Atomic_Sync_Policy_Survey_Art" ON survey_art_responses;

-- Kader PHBS
DROP POLICY IF EXISTS "sync_insert_hotfix_kader_phbs" ON kader_phbs;
DROP POLICY IF EXISTS "Strict_Puskesmas_Access_Kader" ON kader_phbs;

-- Sasaran KK
DROP POLICY IF EXISTS "allow_all_authenticated" ON sasaran_kk;
DROP POLICY IF EXISTS "Strict_Puskesmas_Access_Sasaran" ON sasaran_kk;


-- =================================================================================
-- 2. TERAPKAN KEBIJAKAN INITPLAN (Performa Tinggi)
-- =================================================================================

-- A. Tabel Households 
CREATE POLICY "Strict_Puskesmas_Access_Households" ON households
FOR ALL TO authenticated
USING (
  puskesmas_id = (SELECT puskesmas_id FROM app_users WHERE id = (select auth.uid()))
  OR EXISTS (SELECT 1 FROM app_users WHERE id = (select auth.uid()) AND role IN ('superadmin', 'stakeholder'))
)
WITH CHECK (
  puskesmas_id = (SELECT puskesmas_id FROM app_users WHERE id = (select auth.uid()))
  OR EXISTS (SELECT 1 FROM app_users WHERE id = (select auth.uid()) AND role IN ('superadmin', 'stakeholder'))
);

-- B. Tabel Family Members 
CREATE POLICY "Strict_Puskesmas_Access_Family_Members" ON family_members
FOR ALL TO authenticated
USING (
  household_id IN (
    SELECT id FROM households WHERE puskesmas_id = (SELECT puskesmas_id FROM app_users WHERE id = (select auth.uid()))
  )
  OR EXISTS (SELECT 1 FROM app_users WHERE id = (select auth.uid()) AND role IN ('superadmin', 'stakeholder'))
)
WITH CHECK (
  household_id IN (
    SELECT id FROM households WHERE puskesmas_id = (SELECT puskesmas_id FROM app_users WHERE id = (select auth.uid()))
  )
  OR EXISTS (SELECT 1 FROM app_users WHERE id = (select auth.uid()) AND role IN ('superadmin', 'stakeholder'))
);

-- C. Tabel Surveys 
CREATE POLICY "Strict_Puskesmas_Access_Surveys" ON surveys
FOR ALL TO authenticated
USING (
  household_id IN (
    SELECT id FROM households WHERE puskesmas_id = (SELECT puskesmas_id FROM app_users WHERE id = (select auth.uid()))
  )
  OR EXISTS (SELECT 1 FROM app_users WHERE id = (select auth.uid()) AND role IN ('superadmin', 'stakeholder'))
)
WITH CHECK (
  household_id IN (
    SELECT id FROM households WHERE puskesmas_id = (SELECT puskesmas_id FROM app_users WHERE id = (select auth.uid()))
  )
  OR EXISTS (SELECT 1 FROM app_users WHERE id = (select auth.uid()) AND role IN ('superadmin', 'stakeholder'))
);

-- D. Tabel Survey ART Responses 
CREATE POLICY "Strict_Puskesmas_Access_ART" ON survey_art_responses
FOR ALL TO authenticated
USING (
  survey_id IN (
    SELECT s.id FROM surveys s
    JOIN households h ON s.household_id = h.id
    WHERE h.puskesmas_id = (SELECT puskesmas_id FROM app_users WHERE id = (select auth.uid()))
  )
  OR EXISTS (SELECT 1 FROM app_users WHERE id = (select auth.uid()) AND role IN ('superadmin', 'stakeholder'))
)
WITH CHECK (
  survey_id IN (
    SELECT s.id FROM surveys s
    JOIN households h ON s.household_id = h.id
    WHERE h.puskesmas_id = (SELECT puskesmas_id FROM app_users WHERE id = (select auth.uid()))
  )
  OR EXISTS (SELECT 1 FROM app_users WHERE id = (select auth.uid()) AND role IN ('superadmin', 'stakeholder'))
);

-- E. Sasaran KK
CREATE POLICY "Strict_Puskesmas_Access_Sasaran" ON sasaran_kk
FOR ALL TO authenticated
USING (
  puskesmas_id = (SELECT puskesmas_id FROM app_users WHERE id = (select auth.uid()))
  OR EXISTS (SELECT 1 FROM app_users WHERE id = (select auth.uid()) AND role IN ('superadmin', 'stakeholder'))
)
WITH CHECK (
  puskesmas_id = (SELECT puskesmas_id FROM app_users WHERE id = (select auth.uid()))
  OR EXISTS (SELECT 1 FROM app_users WHERE id = (select auth.uid()) AND role IN ('superadmin', 'stakeholder'))
);

-- F. Kader PHBS
CREATE POLICY "Strict_Puskesmas_Access_Kader" ON kader_phbs
FOR ALL TO authenticated
USING (
  puskesmas_id = (SELECT puskesmas_id FROM app_users WHERE id = (select auth.uid()))
  OR EXISTS (SELECT 1 FROM app_users WHERE id = (select auth.uid()) AND role IN ('superadmin', 'stakeholder'))
)
WITH CHECK (
  puskesmas_id = (SELECT puskesmas_id FROM app_users WHERE id = (select auth.uid()))
  OR EXISTS (SELECT 1 FROM app_users WHERE id = (select auth.uid()) AND role IN ('superadmin', 'stakeholder'))
);


-- =================================================================================
-- 3. PENGAMANAN FUNGSI SECURITY DEFINER
-- =================================================================================

-- Catatan: Abaikan error jika fungsi-fungsi di bawah ini tidak ada di database Anda
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'get_my_role') THEN
        ALTER FUNCTION get_my_role() SET search_path = public;
        REVOKE EXECUTE ON FUNCTION get_my_role() FROM public, anon;
        GRANT EXECUTE ON FUNCTION get_my_role() TO authenticated;
    END IF;

    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'get_my_puskesmas') THEN
        ALTER FUNCTION get_my_puskesmas() SET search_path = public;
        REVOKE EXECUTE ON FUNCTION get_my_puskesmas() FROM public, anon;
        GRANT EXECUTE ON FUNCTION get_my_puskesmas() TO authenticated;
    END IF;

    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'handle_new_user') THEN
        ALTER FUNCTION handle_new_user() SET search_path = public;
        REVOKE EXECUTE ON FUNCTION handle_new_user() FROM public, anon;
    END IF;
END $$;

ALTER FUNCTION sync_offline_composite(jsonb, jsonb, jsonb, jsonb) SET search_path = public;
REVOKE EXECUTE ON FUNCTION sync_offline_composite(jsonb, jsonb, jsonb, jsonb) FROM public, anon;
GRANT EXECUTE ON FUNCTION sync_offline_composite(jsonb, jsonb, jsonb, jsonb) TO authenticated;


-- =================================================================================
-- 4. INDEKS FOREIGN KEY (Mencegah lint 0001 dan mempercepat JOIN/DELETE)
-- =================================================================================

CREATE INDEX IF NOT EXISTS idx_family_members_household_id ON family_members(household_id);
CREATE INDEX IF NOT EXISTS idx_surveys_household_id ON surveys(household_id);
CREATE INDEX IF NOT EXISTS idx_survey_art_survey_id ON survey_art_responses(survey_id);
CREATE INDEX IF NOT EXISTS idx_survey_art_member_id ON survey_art_responses(family_member_id);
CREATE INDEX IF NOT EXISTS idx_kader_phbs_puskesmas_id ON kader_phbs(puskesmas_id);
CREATE INDEX IF NOT EXISTS idx_kader_phbs_desa_id ON kader_phbs(desa_id);
CREATE INDEX IF NOT EXISTS idx_sasaran_kk_puskesmas_id ON sasaran_kk(puskesmas_id);

-- SELESAI 🎉
