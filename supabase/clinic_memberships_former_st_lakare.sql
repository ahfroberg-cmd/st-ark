-- Tidigare ST-läkare: flagga på medlemskap (studierektor flyttar hit / återaktiverar).
-- Kör i Supabase SQL Editor.

ALTER TABLE public.clinic_memberships
  ADD COLUMN IF NOT EXISTS former_st_lakare BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.clinic_memberships.former_st_lakare IS
  'Om true: ST-läkare visas under tidigare ST-läkare, inte i aktiva listan.';

DROP POLICY IF EXISTS "Studierektor can update st_lakare in own clinic" ON public.clinic_memberships;
CREATE POLICY "Studierektor can update st_lakare in own clinic"
  ON public.clinic_memberships FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.clinic_memberships cm
      WHERE cm.clinic_id = clinic_memberships.clinic_id
        AND cm.user_id = auth.uid()
        AND cm.role = 'studierektor'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.clinic_memberships cm
      WHERE cm.clinic_id = clinic_memberships.clinic_id
        AND cm.user_id = auth.uid()
        AND cm.role = 'studierektor'
    )
  );
