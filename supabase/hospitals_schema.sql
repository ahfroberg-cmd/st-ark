-- Sjukhus-tabell + koppling till kliniker. Kräver att stark_current_user_is_superadmin() redan finns
-- (kör profiles_superadmin_policies.sql / clinics_superadmin_policies.sql först).

CREATE TABLE IF NOT EXISTS public.hospitals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  region TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_hospitals_region_name ON public.hospitals (region, name);

ALTER TABLE public.clinics
  ADD COLUMN IF NOT EXISTS hospital_id UUID REFERENCES public.hospitals(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_clinics_hospital_id ON public.clinics (hospital_id);

ALTER TABLE public.hospitals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view hospitals" ON public.hospitals;
CREATE POLICY "Authenticated users can view hospitals"
  ON public.hospitals
  FOR SELECT
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Superadmin can select all hospitals" ON public.hospitals;
CREATE POLICY "Superadmin can select all hospitals"
  ON public.hospitals
  FOR SELECT
  USING (public.stark_current_user_is_superadmin());

DROP POLICY IF EXISTS "Superadmin can insert hospitals" ON public.hospitals;
CREATE POLICY "Superadmin can insert hospitals"
  ON public.hospitals
  FOR INSERT
  WITH CHECK (public.stark_current_user_is_superadmin());

DROP POLICY IF EXISTS "Superadmin can update hospitals" ON public.hospitals;
CREATE POLICY "Superadmin can update hospitals"
  ON public.hospitals
  FOR UPDATE
  USING (public.stark_current_user_is_superadmin())
  WITH CHECK (public.stark_current_user_is_superadmin());

DROP POLICY IF EXISTS "Superadmin can delete hospitals" ON public.hospitals;
CREATE POLICY "Superadmin can delete hospitals"
  ON public.hospitals
  FOR DELETE
  USING (public.stark_current_user_is_superadmin());

-- Utan dessa kan PostgREST returnera tomma fel / "ingen åtkomst" trots RLS-policies.
GRANT SELECT ON TABLE public.hospitals TO authenticated;
GRANT INSERT, UPDATE, DELETE ON TABLE public.hospitals TO authenticated;
