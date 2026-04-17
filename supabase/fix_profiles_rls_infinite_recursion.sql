-- Fix: infinite recursion in RLS policy for public.profiles (42P17)
-- Run in Supabase SQL Editor.
-- Safe to run multiple times.
--
-- NOTE:
-- This is an emergency hard reset for profiles RLS.
-- It drops all existing policies on public.profiles and recreates
-- a minimal, non-recursive policy set required for app auth/profile flow.

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Hard reset: remove all existing policies on public.profiles.
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'profiles'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.profiles', r.policyname);
  END LOOP;
END $$;

-- Minimal non-recursive baseline policies.
CREATE POLICY "Users can view own profile"
  ON public.profiles
  FOR SELECT
  USING (id = auth.uid());

CREATE POLICY "Users can update own profile"
  ON public.profiles
  FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

CREATE POLICY "Users can insert own profile"
  ON public.profiles
  FOR INSERT
  WITH CHECK (id = auth.uid());

-- Optional read policy for service role contexts (server-side tasks),
-- kept non-recursive.
CREATE POLICY "Service role full access to profiles"
  ON public.profiles
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

