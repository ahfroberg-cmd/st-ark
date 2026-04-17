-- Fix RLS policies för profiles och clinic_memberships
-- Kör detta i Supabase SQL Editor

-- TILLFÄLLIG FIX: Stäng av RLS på profiles för att undvika 500-fel
-- Detta låter alla läsa/skriva till profiles utan restriktioner
-- TODO: Aktivera RLS igen med korrekta policies senare

-- 1) Ta bort alla befintliga policies på profiles
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "All users can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Superadmin can view all profiles" ON profiles;

-- 2) Stäng av RLS på profiles-tabellen
ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;

-- 3) Uppdatera clinic_memberships SELECT policy
DROP POLICY IF EXISTS "Authenticated users can view memberships" ON clinic_memberships;
CREATE POLICY "Authenticated users can view memberships"
  ON clinic_memberships FOR SELECT
  USING (auth.role() = 'authenticated');
