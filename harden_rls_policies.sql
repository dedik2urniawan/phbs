-- =================================================================================
-- 🚀 FASE 8: RLS HARDENING (Puskesmas-Scoped Strict Access)
-- =================================================================================
-- Script ini akan menyapu bersih semua kebijakan (Policy) lama yang tumpang tindih
-- dan memasang 1 Set Kebijakan Tunggal yang sangat ketat (Puskesmas-Scoped).

-- 1. BERSIHKAN SEMUA KEBIJAKAN LAMA
-- Households
DROP POLICY IF EXISTS "Atomic_Sync_Policy_Households" ON households;
DROP POLICY IF EXISTS "households_puskesmas_access" ON households;
DROP POLICY IF EXISTS "RLS_households" ON households;
DROP POLICY IF EXISTS "Enable read access for all users" ON households;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON households;
DROP POLICY IF EXISTS "Enable update for users based on email" ON households;
DROP POLICY IF EXISTS "Enable delete for users based on user_id" ON households;

-- Family Members
DROP POLICY IF EXISTS "Atomic_Sync_Policy_Family_Members" ON family_members;
DROP POLICY IF EXISTS "family_members_puskesmas_access" ON family_members;
DROP POLICY IF EXISTS "RLS_family_members" ON family_members;
DROP POLICY IF EXISTS "Enable read access for all users" ON family_members;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON family_members;
DROP POLICY IF EXISTS "Enable update for users based on email" ON family_members;
DROP POLICY IF EXISTS "Enable delete for users based on user_id" ON family_members;

-- Surveys
DROP POLICY IF EXISTS "Atomic_Sync_Policy_Surveys" ON surveys;
DROP POLICY IF EXISTS "surveys_puskesmas_access" ON surveys;
DROP POLICY IF EXISTS "RLS_surveys" ON surveys;
DROP POLICY IF EXISTS "Enable read access for all users" ON surveys;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON surveys;
DROP POLICY IF EXISTS "Enable update for users based on email" ON surveys;
DROP POLICY IF EXISTS "Enable delete for users based on user_id" ON surveys;

-- Survey ART Responses
DROP POLICY IF EXISTS "Atomic_Sync_Policy_Survey_Art" ON survey_art_responses;
DROP POLICY IF EXISTS "survey_art_puskesmas_access" ON survey_art_responses;
DROP POLICY IF EXISTS "RLS_survey_art" ON survey_art_responses;
DROP POLICY IF EXISTS "Enable read access for all users" ON survey_art_responses;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON survey_art_responses;
DROP POLICY IF EXISTS "Enable update for users based on email" ON survey_art_responses;
DROP POLICY IF EXISTS "Enable delete for users based on user_id" ON survey_art_responses;


-- 2. TERAPKAN KEBIJAKAN TUNGGAL (PUSKESMAS SCOPED)

-- A. Tabel Households (Cek puskesmas_id secara langsung)
CREATE POLICY "Strict_Puskesmas_Access_Households" ON households
FOR ALL TO authenticated
USING (
  puskesmas_id = (SELECT puskesmas_id FROM app_users WHERE id = auth.uid())
  OR EXISTS (SELECT 1 FROM app_users WHERE id = auth.uid() AND role IN ('superadmin', 'stakeholder'))
)
WITH CHECK (
  puskesmas_id = (SELECT puskesmas_id FROM app_users WHERE id = auth.uid())
  OR EXISTS (SELECT 1 FROM app_users WHERE id = auth.uid() AND role IN ('superadmin', 'stakeholder'))
);

-- B. Tabel Family Members (Cek puskesmas_id via relasi ke households)
CREATE POLICY "Strict_Puskesmas_Access_Family_Members" ON family_members
FOR ALL TO authenticated
USING (
  household_id IN (
    SELECT id FROM households WHERE puskesmas_id = (SELECT puskesmas_id FROM app_users WHERE id = auth.uid())
  )
  OR EXISTS (SELECT 1 FROM app_users WHERE id = auth.uid() AND role IN ('superadmin', 'stakeholder'))
)
WITH CHECK (
  household_id IN (
    SELECT id FROM households WHERE puskesmas_id = (SELECT puskesmas_id FROM app_users WHERE id = auth.uid())
  )
  OR EXISTS (SELECT 1 FROM app_users WHERE id = auth.uid() AND role IN ('superadmin', 'stakeholder'))
);

-- C. Tabel Surveys (Cek puskesmas_id via relasi ke households)
CREATE POLICY "Strict_Puskesmas_Access_Surveys" ON surveys
FOR ALL TO authenticated
USING (
  household_id IN (
    SELECT id FROM households WHERE puskesmas_id = (SELECT puskesmas_id FROM app_users WHERE id = auth.uid())
  )
  OR EXISTS (SELECT 1 FROM app_users WHERE id = auth.uid() AND role IN ('superadmin', 'stakeholder'))
)
WITH CHECK (
  household_id IN (
    SELECT id FROM households WHERE puskesmas_id = (SELECT puskesmas_id FROM app_users WHERE id = auth.uid())
  )
  OR EXISTS (SELECT 1 FROM app_users WHERE id = auth.uid() AND role IN ('superadmin', 'stakeholder'))
);

-- D. Tabel Survey ART Responses (Cek puskesmas_id via relasi berantai survey -> households)
CREATE POLICY "Strict_Puskesmas_Access_ART" ON survey_art_responses
FOR ALL TO authenticated
USING (
  survey_id IN (
    SELECT s.id FROM surveys s
    JOIN households h ON s.household_id = h.id
    WHERE h.puskesmas_id = (SELECT puskesmas_id FROM app_users WHERE id = auth.uid())
  )
  OR EXISTS (SELECT 1 FROM app_users WHERE id = auth.uid() AND role IN ('superadmin', 'stakeholder'))
)
WITH CHECK (
  survey_id IN (
    SELECT s.id FROM surveys s
    JOIN households h ON s.household_id = h.id
    WHERE h.puskesmas_id = (SELECT puskesmas_id FROM app_users WHERE id = auth.uid())
  )
  OR EXISTS (SELECT 1 FROM app_users WHERE id = auth.uid() AND role IN ('superadmin', 'stakeholder'))
);

-- Pastikan RLS tetap aktif di tabel-tabel tersebut
ALTER TABLE households ENABLE ROW LEVEL SECURITY;
ALTER TABLE family_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE surveys ENABLE ROW LEVEL SECURITY;
ALTER TABLE survey_art_responses ENABLE ROW LEVEL SECURITY;

-- SELESAI 🎉
