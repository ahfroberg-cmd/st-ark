-- ST-ARK definitive RLS fix for profiles-related recursion/500 errors
-- Root cause addressed:
--   profiles policy -> supervisor_assignments policy -> profiles lookup
-- which can trigger infinite recursion / HTTP 500 in PostgREST.
--
-- Run this in Supabase SQL Editor.
-- Idempotent: safe to run multiple times.

BEGIN;

-- ------------------------------------------------------------
-- 1) Ensure RLS is enabled
-- ------------------------------------------------------------
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supervisor_assignments ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------
-- 2) Reset ALL policies on public.profiles (clean slate)
-- ------------------------------------------------------------
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'profiles'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.profiles', r.policyname);
  END LOOP;
END $$;

-- Minimal own-profile policies
CREATE POLICY "Users can view own profile"
  ON public.profiles
  FOR SELECT
  USING (id = auth.uid());

CREATE POLICY "Users can insert own profile"
  ON public.profiles
  FOR INSERT
  WITH CHECK (id = auth.uid());

CREATE POLICY "Users can update own profile"
  ON public.profiles
  FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- Supervisor -> assigned ST profiles
-- Non-recursive: only reads supervisor_assignments (not profiles)
CREATE POLICY "Supervisors can view assigned st profiles"
  ON public.profiles
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.supervisor_assignments sa
      WHERE sa.supervisor_id = auth.uid()
        AND sa.st_lakare_id = public.profiles.id
    )
  );

-- Studierektor -> ST profiles in same clinic
-- Non-recursive: reads clinic_memberships only
CREATE POLICY "Studierektor can view clinic st_lakare profiles"
  ON public.profiles
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.clinic_memberships cm_sr
      JOIN public.clinic_memberships cm_st
        ON cm_sr.clinic_id = cm_st.clinic_id
      WHERE cm_sr.user_id = auth.uid()
        AND cm_sr.role = 'studierektor'
        AND cm_st.user_id = public.profiles.id
        AND cm_st.role = 'st_lakare'
    )
  );

-- ST-lakare -> colleague ST profiles in same clinic
CREATE POLICY "ST-läkare can view colleague profiles"
  ON public.profiles
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.clinic_memberships cm_self
      JOIN public.clinic_memberships cm_colleague
        ON cm_self.clinic_id = cm_colleague.clinic_id
      WHERE cm_self.user_id = auth.uid()
        AND cm_self.role = 'st_lakare'
        AND cm_colleague.user_id = public.profiles.id
        AND cm_colleague.role = 'st_lakare'
    )
  );

-- Superadmin: läs/uppdatera alla profiler (annars visas "(inget namn)" i admin för medlemmar).
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

CREATE POLICY "Superadmin can select all profiles"
  ON public.profiles
  FOR SELECT
  USING (public.stark_current_user_is_superadmin());

CREATE POLICY "Superadmin can update all profiles"
  ON public.profiles
  FOR UPDATE
  USING (public.stark_current_user_is_superadmin())
  WITH CHECK (public.stark_current_user_is_superadmin());

-- ------------------------------------------------------------
-- 3) Reset policies on supervisor_assignments to avoid
--    any lookup against profiles from this table's policies
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Supervisors can view own assignments" ON public.supervisor_assignments;
DROP POLICY IF EXISTS "Studierektor can create assignments" ON public.supervisor_assignments;
DROP POLICY IF EXISTS "Studierektor can delete assignments" ON public.supervisor_assignments;

CREATE POLICY "Supervisors can view own assignments"
  ON public.supervisor_assignments
  FOR SELECT
  USING (
    supervisor_id = auth.uid()
    OR st_lakare_id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM public.clinic_memberships cm
      WHERE cm.clinic_id = public.supervisor_assignments.clinic_id
        AND cm.user_id = auth.uid()
        AND cm.role = 'studierektor'
    )
  );

CREATE POLICY "Studierektor can create assignments"
  ON public.supervisor_assignments
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.clinic_memberships cm
      WHERE cm.clinic_id = public.supervisor_assignments.clinic_id
        AND cm.user_id = auth.uid()
        AND cm.role = 'studierektor'
    )
  );

CREATE POLICY "Studierektor can delete assignments"
  ON public.supervisor_assignments
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1
      FROM public.clinic_memberships cm
      WHERE cm.clinic_id = public.supervisor_assignments.clinic_id
        AND cm.user_id = auth.uid()
        AND cm.role = 'studierektor'
    )
  );

COMMIT;

-- Optional verification (run separately if needed):
-- SELECT schemaname, tablename, policyname, cmd, qual, with_check
-- FROM pg_policies
-- WHERE schemaname = 'public'
--   AND tablename IN ('profiles', 'supervisor_assignments')
-- ORDER BY tablename, policyname;

