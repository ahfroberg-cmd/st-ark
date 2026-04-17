-- Typ av vårdenhet: sjukhus eller vårdcentral. Kör efter hospitals_schema.sql.

ALTER TABLE public.hospitals
  ADD COLUMN IF NOT EXISTS facility_type TEXT NOT NULL DEFAULT 'sjukhus';

ALTER TABLE public.hospitals
  DROP CONSTRAINT IF EXISTS hospitals_facility_type_check;

ALTER TABLE public.hospitals
  ADD CONSTRAINT hospitals_facility_type_check
  CHECK (facility_type IN ('sjukhus', 'vardcentral'));

CREATE INDEX IF NOT EXISTS idx_hospitals_region_facility_type ON public.hospitals (region, facility_type);

COMMENT ON COLUMN public.hospitals.facility_type IS 'sjukhus | vardcentral';
