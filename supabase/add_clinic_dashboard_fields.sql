-- Fält för Dashboard -> Klinik
-- Kör i Supabase SQL editor

ALTER TABLE public.clinics
  ADD COLUMN IF NOT EXISTS st_chief TEXT DEFAULT '';

ALTER TABLE public.clinics
  ADD COLUMN IF NOT EXISTS verksamhetschef TEXT DEFAULT '';

ALTER TABLE public.clinics
  ADD COLUMN IF NOT EXISTS org_home TEXT DEFAULT '';

