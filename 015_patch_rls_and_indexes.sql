-- =========================================================
-- PATCH 015: Konsolidasi RLS family_members & Cleanup Index
-- Tujuan:
-- - Menghilangkan sisa-sisa direct upsert dari Frontend (Diselesaikan di Kode TypeScript)
-- - Menerapkan RLS konsolidasi pada tabel family_members (Deterministic)
-- - Membersihkan indeks duplikat yang membebani Write Cost (Insert/Update)
-- =========================================================

BEGIN;

-- 1) Pastikan RLS aktif
ALTER TABLE public.family_members ENABLE ROW LEVEL SECURITY;

-- 2) Drop policy lama yang tumpang tindih
DROP POLICY IF EXISTS "Strict_Puskesmas_Access_Family_Members" ON public.family_members;
DROP POLICY IF EXISTS "sync_insert_hotfix_family_members" ON public.family_members;
DROP POLICY IF EXISTS "Atomic_Sync_Policy_Family_Members" ON public.family_members;

-- 3) Buat policy SELECT (Membaca)
CREATE POLICY "family_members_select_scoped"
ON public.family_members
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.households h
    JOIN public.app_users au ON au.id = (SELECT auth.uid())
    WHERE h.id = family_members.household_id
      AND (
        au.role IN ('superadmin', 'stakeholder')
        OR h.puskesmas_id = au.puskesmas_id
      )
  )
);

-- 4) Buat policy INSERT (Menambah)
CREATE POLICY "family_members_insert_scoped"
ON public.family_members
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.households h
    JOIN public.app_users au ON au.id = (SELECT auth.uid())
    WHERE h.id = family_members.household_id
      AND (
        au.role IN ('superadmin', 'stakeholder')
        OR h.puskesmas_id = au.puskesmas_id
      )
  )
);

-- 5) Buat policy UPDATE (Mengubah)
CREATE POLICY "family_members_update_scoped"
ON public.family_members
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.households h
    JOIN public.app_users au ON au.id = (SELECT auth.uid())
    WHERE h.id = family_members.household_id
      AND (
        au.role IN ('superadmin', 'stakeholder')
        OR h.puskesmas_id = au.puskesmas_id
      )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.households h
    JOIN public.app_users au ON au.id = (SELECT auth.uid())
    WHERE h.id = family_members.household_id
      AND (
        au.role IN ('superadmin', 'stakeholder')
        OR h.puskesmas_id = au.puskesmas_id
      )
  )
);

-- 6) Buat policy DELETE (Menghapus)
CREATE POLICY "family_members_delete_scoped"
ON public.family_members
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.households h
    JOIN public.app_users au ON au.id = (SELECT auth.uid())
    WHERE h.id = family_members.household_id
      AND (
        au.role IN ('superadmin', 'stakeholder')
        OR h.puskesmas_id = au.puskesmas_id
      )
  )
);

COMMIT;


-- =========================================================
-- DRAFT CLEANUP INDEX DUPLIKAT (NON-EKSEKUSI DALAM TRANSACTION)
-- =========================================================
-- Jalankan kode di bawah ini satu per satu di luar blok BEGIN-COMMIT di atas.
-- Drop indeks versi lama agar Write Cost (Performa Insert) Postgres lebih ringan.

/*
DROP INDEX CONCURRENTLY IF EXISTS public.idx_family_members_household;
DROP INDEX CONCURRENTLY IF EXISTS public.idx_households_desa;
DROP INDEX CONCURRENTLY IF EXISTS public.idx_households_puskesmas;
DROP INDEX CONCURRENTLY IF EXISTS public.idx_kader_desa_id;
DROP INDEX CONCURRENTLY IF EXISTS public.idx_kader_puskesmas_id;
DROP INDEX CONCURRENTLY IF EXISTS public.idx_ref_desa_puskesmas;
DROP INDEX CONCURRENTLY IF EXISTS public.idx_survey_art_member_id;
DROP INDEX CONCURRENTLY IF EXISTS public.idx_survey_art_survey_id;
DROP INDEX CONCURRENTLY IF EXISTS public.idx_surveys_household;
*/
