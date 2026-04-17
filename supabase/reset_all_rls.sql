-- KOMPLETT RESET AV ALLA RLS POLICIES
-- Kör detta i Supabase SQL Editor för att fixa alla RLS-problem

-- 1) PROFILES - Ta bort alla policies och stäng av RLS
DO $$ 
DECLARE 
    r RECORD;
BEGIN
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'profiles') LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON profiles';
    END LOOP;
END $$;

ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;

-- 2) CLINICS - Ta bort alla policies och stäng av RLS
DO $$ 
DECLARE 
    r RECORD;
BEGIN
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'clinics') LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON clinics';
    END LOOP;
END $$;

ALTER TABLE clinics DISABLE ROW LEVEL SECURITY;

-- 3) CLINIC_MEMBERSHIPS - Ta bort alla policies och stäng av RLS
DO $$ 
DECLARE 
    r RECORD;
BEGIN
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'clinic_memberships') LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON clinic_memberships';
    END LOOP;
END $$;

ALTER TABLE clinic_memberships DISABLE ROW LEVEL SECURITY;

-- 4) INVITATIONS - Ta bort alla policies och stäng av RLS
DO $$ 
DECLARE 
    r RECORD;
BEGIN
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'invitations') LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON invitations';
    END LOOP;
END $$;

ALTER TABLE invitations DISABLE ROW LEVEL SECURITY;

-- Bekräfta att RLS är avstängt
SELECT 
    schemaname,
    tablename,
    rowsecurity
FROM pg_tables 
WHERE tablename IN ('profiles', 'clinics', 'clinic_memberships', 'invitations')
ORDER BY tablename;
