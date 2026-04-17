-- Restore non-recursive read policies for public.profiles after emergency reset.
-- Run in Supabase SQL Editor.
-- Safe to run multiple times.

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Keep base self-read policy.
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile"
  ON public.profiles
  FOR SELECT
  USING (id = auth.uid());

-- Supervisor can read assigned ST profiles (non-recursive: no SELECT from profiles).
DROP POLICY IF EXISTS "Supervisors can view assigned st profiles" ON public.profiles;
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

-- Studierektor can read ST profiles in same clinic (non-recursive).
DROP POLICY IF EXISTS "Studierektor can view clinic st_lakare profiles" ON public.profiles;
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

-- ST doctor can read colleague ST profiles in same clinic (non-recursive).
DROP POLICY IF EXISTS "ST-läkare can view colleague profiles" ON public.profiles;
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

-- Superadmin: läs/uppdatera alla profiler (admin listar medlemmar med namn — kräver denna policy).
-- Använder SECURITY DEFINER-funktion för att undvika rekursiv RLS mot profiles.
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

