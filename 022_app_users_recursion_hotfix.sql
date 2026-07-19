-- =========================================================
-- PATCH 022: HOTFIX INFINTIE RECURSION APP_USERS
-- Tujuan: 
-- Mengembalikan fungsi SECURITY DEFINER HANYA untuk tabel app_users 
-- agar terhindar dari infinite recursion saat membaca dirinya sendiri.
-- Tabel lain (households, dll) TETAP menggunakan Subquery In-line 
-- untuk performa maksimal.
-- =========================================================

BEGIN;

-- 1. Ciptakan kembali fungsi pembantu dengan SECURITY DEFINER
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

-- Amankan fungsinya
REVOKE EXECUTE ON FUNCTION public.get_my_role() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_my_role() TO authenticated;

REVOKE EXECUTE ON FUNCTION public.get_my_puskesmas() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_my_puskesmas() TO authenticated;

-- 2. Drop policy inline yang bermasalah pada app_users
DROP POLICY IF EXISTS "app_users_select_inline" ON public.app_users;
DROP POLICY IF EXISTS "app_users_update_inline" ON public.app_users;

-- 3. Buat ulang policy app_users menggunakan fungsi tersebut
--    (Dibungkus dengan SELECT agar tetap diproses sebagai Initplan)
CREATE POLICY "app_users_select_fixed"
ON public.app_users FOR SELECT TO authenticated
USING (
  id = (SELECT auth.uid()) 
  OR (SELECT public.get_my_role()) IN ('superadmin', 'stakeholder')
  OR puskesmas_id = (SELECT public.get_my_puskesmas())
);

CREATE POLICY "app_users_update_fixed"
ON public.app_users FOR UPDATE TO authenticated
USING (
  id = (SELECT auth.uid()) 
  OR (SELECT public.get_my_role()) = 'superadmin'
);

-- Muat ulang schema untuk postgREST
NOTIFY pgrst, 'reload schema';

COMMIT;
