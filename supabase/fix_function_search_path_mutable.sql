-- =============================================================
-- ST-ARK: Åtgärda Security Advisor "function_search_path_mutable"
-- Kör i Supabase SQL Editor (prod/staging efter behov).
--
-- Utan fast search_path kan en angripare teoretiskt skugga objekt
-- i ett schema som kommer före public i sökvägen.
-- =============================================================

CREATE OR REPLACE FUNCTION public.update_clinic_activity_templates_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_default_role()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.role IS NULL THEN
    NEW.role := 'st_lakare';
  END IF;
  RETURN NEW;
END;
$$;
