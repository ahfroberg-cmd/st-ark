-- Superadmin: read (and update) all profiles for /admin without RLS recursion.
-- A plain policy "USING (EXISTS (SELECT 1 FROM profiles WHERE ... superadmin))"
-- would recurse. SECURITY DEFINER reads profiles as the function owner (bypasses RLS).
--
-- Run in Supabase SQL Editor. Idempotent.

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

DROP POLICY IF EXISTS "Superadmin can select all profiles" ON public.profiles;
CREATE POLICY "Superadmin can select all profiles"
  ON public.profiles
  FOR SELECT
  USING (public.stark_current_user_is_superadmin());

DROP POLICY IF EXISTS "Superadmin can update all profiles" ON public.profiles;
CREATE POLICY "Superadmin can update all profiles"
  ON public.profiles
  FOR UPDATE
  USING (public.stark_current_user_is_superadmin())
  WITH CHECK (public.stark_current_user_is_superadmin());
