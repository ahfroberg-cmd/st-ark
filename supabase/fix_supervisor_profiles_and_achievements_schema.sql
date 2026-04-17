-- Fixar två rotorsaker:
-- 1) Huvudhandledare saknar läsaccess till tilldelade ST-läkares profiler (namn blir "Okänd ST-läkare")
-- 2) achievements-tabellen saknar kolumner som appen läser (400 på SELECT)
--
-- Kör i Supabase SQL Editor.

-- =========================================================
-- 1) Schema-fix för achievements
-- =========================================================

ALTER TABLE achievements
  ADD COLUMN IF NOT EXISTS achieved_date TEXT,
  ADD COLUMN IF NOT EXISTS note TEXT;

-- Backfill för äldre data där "date" använts istället för "achieved_date"
UPDATE achievements
SET achieved_date = COALESCE(achieved_date, date)
WHERE achieved_date IS NULL;

-- =========================================================
-- 2) RLS-fix: handledare ska kunna läsa profiler för tilldelade ST-läkare
-- =========================================================

-- Ta bort ALLA rekursiva profiles-policies (de som refererar profiles i sitt eget villkor)
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'profiles'
      AND (
        coalesce(qual, '') ILIKE '%from profiles%'
        OR coalesce(with_check, '') ILIKE '%from profiles%'
      )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON profiles', r.policyname);
  END LOOP;
END $$;

-- Viktigt: ersätt policy helt för att undvika rekursion i profiles-RLS.
DROP POLICY IF EXISTS "Supervisors can view assigned st profiles" ON profiles;

DO $$
BEGIN
  EXECUTE 'CREATE POLICY "Supervisors can view assigned st profiles"
    ON profiles FOR SELECT
    USING (
      id = auth.uid()
      OR EXISTS (
        SELECT 1
        FROM supervisor_assignments sa
        WHERE sa.supervisor_id = auth.uid()
          AND sa.st_lakare_id = profiles.id
      )
    )';
END $$;

