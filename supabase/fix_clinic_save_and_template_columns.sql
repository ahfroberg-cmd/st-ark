-- Fixes:
-- 1) "Spara klinikuppgifter" does not persist st_chief/verksamhetschef
-- 2) 400 errors for clinic_activity_templates.track_completions
--
-- Run in Supabase SQL Editor. Safe to run multiple times.

BEGIN;

-- ------------------------------------------------------------------
-- Clinics dashboard fields
-- ------------------------------------------------------------------
ALTER TABLE public.clinics
  ADD COLUMN IF NOT EXISTS st_chief TEXT DEFAULT '';

ALTER TABLE public.clinics
  ADD COLUMN IF NOT EXISTS verksamhetschef TEXT DEFAULT '';

ALTER TABLE public.clinics
  ADD COLUMN IF NOT EXISTS org_home TEXT DEFAULT '';

-- ------------------------------------------------------------------
-- Clinics: SELECT + UPDATE for studierektor workflow
-- Without a SELECT policy, RLS returns zero rows on read — PATCH can still
-- succeed, but verify/readback (and loadClinicForm) gets null.
-- ------------------------------------------------------------------
ALTER TABLE public.clinics ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view clinics" ON public.clinics;
CREATE POLICY "Authenticated users can view clinics"
  ON public.clinics
  FOR SELECT
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Studierektor can update own clinic" ON public.clinics;
CREATE POLICY "Studierektor can update own clinic"
  ON public.clinics
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM public.clinic_memberships cm
      WHERE cm.clinic_id = public.clinics.id
        AND cm.user_id = auth.uid()
        AND cm.role = 'studierektor'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.clinic_memberships cm
      WHERE cm.clinic_id = public.clinics.id
        AND cm.user_id = auth.uid()
        AND cm.role = 'studierektor'
    )
  );

-- ------------------------------------------------------------------
-- Activity template schema compatibility
-- ------------------------------------------------------------------
ALTER TABLE public.clinic_activity_templates
  ADD COLUMN IF NOT EXISTS track_completions BOOLEAN NOT NULL DEFAULT FALSE;

COMMIT;

