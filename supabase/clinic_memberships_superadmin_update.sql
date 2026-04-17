-- Superadmin kan uppdatera clinic_memberships (t.ex. flytta medlem mellan kliniker).
-- Kräver stark_current_user_is_superadmin() (se clinics_superadmin_policies.sql).

DROP POLICY IF EXISTS "Superadmin can update memberships" ON public.clinic_memberships;
CREATE POLICY "Superadmin can update memberships"
  ON public.clinic_memberships
  FOR UPDATE
  USING (public.stark_current_user_is_superadmin())
  WITH CHECK (public.stark_current_user_is_superadmin());
