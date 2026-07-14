-- =========================================================
-- HOTFIX: Mengatasi Infinite Recursion di app_users
-- =========================================================

BEGIN;

-- 1. Buat kembali fungsi pembantu sebagai SECURITY DEFINER 
--    (MUTLAK DIBUTUHKAN untuk app_users agar tidak terjadi infinite recursion)
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

REVOKE EXECUTE ON FUNCTION public.get_my_role() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_my_role() TO authenticated;

REVOKE EXECUTE ON FUNCTION public.get_my_puskesmas() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_my_puskesmas() TO authenticated;


-- 2. Perbaiki Policy app_users agar menggunakan SECURITY DEFINER 
--    sehingga tidak terjebak dalam loop saat membaca tabel dirinya sendiri
DROP POLICY IF EXISTS "app_users_select_inline" ON public.app_users;
DROP POLICY IF EXISTS "app_users_update_inline" ON public.app_users;

CREATE POLICY "app_users_select_fixed"
ON public.app_users FOR SELECT TO authenticated
USING (
  id = (SELECT auth.uid()) 
  OR public.get_my_role() IN ('superadmin', 'stakeholder')
  OR puskesmas_id = public.get_my_puskesmas()
);

CREATE POLICY "app_users_update_fixed"
ON public.app_users FOR UPDATE TO authenticated
USING (
  id = (SELECT auth.uid()) 
  OR public.get_my_role() = 'superadmin'
);

-- Catatan: Tabel lain (households, surveys, dll) TETAP menggunakan Subquery In-line
-- karena mereka tidak mengalami recursion (mereka menembak tabel app_users, bukan dirinya sendiri).
-- Hal ini mempertahankan performa Initplan yang optimal pada tabel-tabel raksasa.

COMMIT;
