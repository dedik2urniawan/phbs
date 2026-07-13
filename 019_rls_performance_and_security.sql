-- =========================================================
-- PATCH 019: RLS Performance (Initplan) & Lanjutan Konsolidasi
-- Tujuan:
-- 1. Menjadikan fungsi bantu (get_my_puskesmas) menjadi STABLE 
--    agar Postgres mengubahnya menjadi Initplan (dieksekusi 1x).
-- 2. Mengonsolidasi RLS untuk kader_phbs dan sasaran_kk.
-- =========================================================

BEGIN;

-- =========================================================
-- 1. OPTIMASI INITPLAN (STABLE FUNCTIONS)
-- =========================================================
-- Dengan menambahkan `STABLE`, fungsi ini tidak akan dievaluasi per baris,
-- melainkan hanya sekali di awal kueri, menghilangkan peringatan `auth_rls_initplan`.

CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.app_users WHERE id = (SELECT auth.uid());
$$;

CREATE OR REPLACE FUNCTION public.get_my_puskesmas()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT puskesmas_id FROM public.app_users WHERE id = (SELECT auth.uid());
$$;


-- =========================================================
-- 2. KONSOLIDASI RLS: KADER_PHBS
-- =========================================================
-- Menghapus semua overlap permissive policy
DROP POLICY IF EXISTS "Strict_Puskesmas_Access_Kader" ON public.kader_phbs;
DROP POLICY IF EXISTS "sync_insert_hotfix_kader_phbs" ON public.kader_phbs;
DROP POLICY IF EXISTS "kader_phbs_select" ON public.kader_phbs;
DROP POLICY IF EXISTS "kader_phbs_insert" ON public.kader_phbs;
DROP POLICY IF EXISTS "kader_phbs_update" ON public.kader_phbs;

CREATE POLICY "kader_phbs_select_final"
ON public.kader_phbs FOR SELECT TO authenticated
USING (
  puskesmas_id = public.get_my_puskesmas()
  OR public.get_my_role() IN ('superadmin', 'stakeholder')
);

CREATE POLICY "kader_phbs_insert_final"
ON public.kader_phbs FOR INSERT TO authenticated
WITH CHECK (
  puskesmas_id = public.get_my_puskesmas()
  OR public.get_my_role() IN ('superadmin', 'stakeholder')
);

CREATE POLICY "kader_phbs_update_final"
ON public.kader_phbs FOR UPDATE TO authenticated
USING (
  puskesmas_id = public.get_my_puskesmas()
  OR public.get_my_role() IN ('superadmin', 'stakeholder')
);


-- =========================================================
-- 3. KONSOLIDASI RLS: SASARAN_KK
-- =========================================================
DROP POLICY IF EXISTS "allow_all_authenticated" ON public.sasaran_kk;
DROP POLICY IF EXISTS "Strict_Puskesmas_Access_Sasaran" ON public.sasaran_kk;
DROP POLICY IF EXISTS "sasaran_kk_select" ON public.sasaran_kk;
DROP POLICY IF EXISTS "sasaran_kk_insert" ON public.sasaran_kk;
DROP POLICY IF EXISTS "sasaran_kk_update" ON public.sasaran_kk;

CREATE POLICY "sasaran_kk_select_final"
ON public.sasaran_kk FOR SELECT TO authenticated
USING (
  puskesmas_id = public.get_my_puskesmas()
  OR public.get_my_role() IN ('superadmin', 'stakeholder')
);

CREATE POLICY "sasaran_kk_insert_final"
ON public.sasaran_kk FOR INSERT TO authenticated
WITH CHECK (
  puskesmas_id = public.get_my_puskesmas()
  OR public.get_my_role() IN ('superadmin', 'stakeholder')
);

CREATE POLICY "sasaran_kk_update_final"
ON public.sasaran_kk FOR UPDATE TO authenticated
USING (
  puskesmas_id = public.get_my_puskesmas()
  OR public.get_my_role() IN ('superadmin', 'stakeholder')
);


-- =========================================================
-- 4. KEAMANAN FUNGSI LAINNYA
-- =========================================================
-- Pastikan handle_new_user memiliki search_path yang aman
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'handle_new_user') THEN
        ALTER FUNCTION handle_new_user() SET search_path = public;
    END IF;
END $$;

COMMIT;
