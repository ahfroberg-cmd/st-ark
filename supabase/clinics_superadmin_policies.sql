-- Superadmin: create/update/delete clinics from /admin without relying on
-- "EXISTS (SELECT ... FROM profiles ...)" in the policy (same helper as profiles).
--
-- Run in Supabase SQL Editor after profiles_superadmin_policies.sql, or run standalone
-- (function is duplicated here with CREATE OR REPLACE).

CREATE OR REPLACE FUNCTION public.stark_current_user_is_superadmin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.role = 'superadmin'
  );
$$;

REVOKE ALL ON FUNCTION public.stark_current_user_is_superadmin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.stark_current_user_is_superadmin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.stark_current_user_is_superadmin() TO service_role;

ALTER TABLE public.clinics ENABLE ROW LEVEL SECURITY;

-- Utan SELECT-policy syns inga rader i admin (lista blir tom) trots lyckad INSERT.
DROP POLICY IF EXISTS "Authenticated users can view clinics" ON public.clinics;
CREATE POLICY "Authenticated users can view clinics"
  ON public.clinics
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- Explicit superadmin-läsning (t.ex. om JWT-roll avviker); OR med policyn ovan.
DROP POLICY IF EXISTS "Superadmin can select all clinics" ON public.clinics;
CREATE POLICY "Superadmin can select all clinics"
  ON public.clinics
  FOR SELECT
  USING (public.stark_current_user_is_superadmin());

DROP POLICY IF EXISTS "Superadmin can insert clinics" ON public.clinics;
CREATE POLICY "Superadmin can insert clinics"
  ON public.clinics
  FOR INSERT
  WITH CHECK (public.stark_current_user_is_superadmin());

DROP POLICY IF EXISTS "Superadmin can update clinics" ON public.clinics;
CREATE POLICY "Superadmin can update clinics"
  ON public.clinics
  FOR UPDATE
  USING (public.stark_current_user_is_superadmin())
  WITH CHECK (public.stark_current_user_is_superadmin());

DROP POLICY IF EXISTS "Superadmin can delete clinics" ON public.clinics;
CREATE POLICY "Superadmin can delete clinics"
  ON public.clinics
  FOR DELETE
  USING (public.stark_current_user_is_superadmin());
