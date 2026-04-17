-- =============================================================
-- ST-ARK: Aktivera RLS på kärntabeller (prod-fix)
-- Kör i Supabase SQL Editor för st-ark-prod.
--
-- Åtgärdar Security Advisor:
--   - rls_disabled_in_public
--   - policy_exists_rls_disabled
--   - sensitive_columns_exposed (invitations) — genom att RLS faktiskt tillämpas
--
-- Förutsätter att policys redan finns (create_roles_and_clinics.sql,
-- fix_profiles_rls.sql, add_invitation_name_and_rls.sql, allow_colleague_data_access.sql).
-- Om någon tabell saknar policys helt: lägg till dem INNAN du kör detta, annars blir åtkomst nekad.
-- Om clinic_memberships får "RLS Enabled No Policy": kör restore_clinic_memberships_rls_policies.sql.
-- =============================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clinics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clinic_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;

-- Verifiering (valfritt — kör efteråt):
-- SELECT c.relname AS table, c.relrowsecurity AS rls_enabled
-- FROM pg_class c
-- JOIN pg_namespace n ON n.oid = c.relnamespace
-- WHERE n.nspname = 'public'
--   AND c.relname IN ('profiles', 'clinics', 'clinic_memberships', 'invitations')
-- ORDER BY 1;
