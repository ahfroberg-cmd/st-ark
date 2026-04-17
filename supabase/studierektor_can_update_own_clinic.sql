-- Tillåt studierektor att uppdatera sin kliniks rad (t.ex. ST-chef, verksamhetschef).
-- Utan denna policy kan endast superadmin uppdatera `clinics` (se create_roles_and_clinics.sql).
--
-- Viktigt: utan SELECT-policy returnerar PostgREST inga rader vid läsning trots lyckad UPDATE.
-- Återställ därför även läsning för inloggade (samma som create_roles_and_clinics.sql).

ALTER TABLE public.clinics ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view clinics" ON public.clinics;
CREATE POLICY "Authenticated users can view clinics"
  ON public.clinics
  FOR SELECT
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Studierektor can update own clinic" ON public.clinics;

CREATE POLICY "Studierektor can update own clinic"
  ON public.clinics FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.clinic_memberships cm
      WHERE cm.clinic_id = clinics.id
        AND cm.user_id = auth.uid()
        AND cm.role = 'studierektor'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.clinic_memberships cm
      WHERE cm.clinic_id = clinics.id
        AND cm.user_id = auth.uid()
        AND cm.role = 'studierektor'
    )
  );
