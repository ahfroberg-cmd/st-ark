-- =============================================================
-- ST-ARK: Policies för public.clinic_memberships
-- Kör i Supabase SQL Editor om Security Advisor visar
-- "RLS Enabled No Policy" på clinic_memberships (t.ex. efter RLS
-- aktiverats utan att policies fanns kvar i databasen).
--
-- Idempotent: DROP IF EXISTS + CREATE.
-- =============================================================

ALTER TABLE public.clinic_memberships ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view memberships" ON public.clinic_memberships;
CREATE POLICY "Authenticated users can view memberships"
  ON public.clinic_memberships FOR SELECT
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Superadmin can insert memberships" ON public.clinic_memberships;
CREATE POLICY "Superadmin can insert memberships"
  ON public.clinic_memberships FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'superadmin'
    )
  );

DROP POLICY IF EXISTS "Superadmin can delete memberships" ON public.clinic_memberships;
CREATE POLICY "Superadmin can delete memberships"
  ON public.clinic_memberships FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'superadmin'
    )
  );

DROP POLICY IF EXISTS "Studierektor can add st_lakare to own clinic" ON public.clinic_memberships;
CREATE POLICY "Studierektor can add st_lakare to own clinic"
  ON public.clinic_memberships FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.clinic_memberships cm
      WHERE cm.clinic_id = clinic_memberships.clinic_id
        AND cm.user_id = auth.uid()
        AND cm.role = 'studierektor'
    )
    AND role = 'st_lakare'
  );
