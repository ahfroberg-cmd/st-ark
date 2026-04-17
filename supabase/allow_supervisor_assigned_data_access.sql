-- Ge huvudhandledare läsaccess till tilldelade ST-läkares data
-- Kör detta i Supabase SQL Editor.

-- placements
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'placements'
      AND policyname = 'Supervisors can view assigned st placements'
  ) THEN
    EXECUTE 'CREATE POLICY "Supervisors can view assigned st placements"
      ON placements FOR SELECT
      USING (
        user_id = auth.uid()
        OR EXISTS (
          SELECT 1
          FROM supervisor_assignments sa
          WHERE sa.supervisor_id = auth.uid()
            AND sa.st_lakare_id = placements.user_id
        )
        OR EXISTS (
          SELECT 1 FROM profiles p
          WHERE p.id = auth.uid() AND p.role = ''superadmin''
        )
      )';
  END IF;
END $$;

-- courses
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'courses'
      AND policyname = 'Supervisors can view assigned st courses'
  ) THEN
    EXECUTE 'CREATE POLICY "Supervisors can view assigned st courses"
      ON courses FOR SELECT
      USING (
        user_id = auth.uid()
        OR EXISTS (
          SELECT 1
          FROM supervisor_assignments sa
          WHERE sa.supervisor_id = auth.uid()
            AND sa.st_lakare_id = courses.user_id
        )
        OR EXISTS (
          SELECT 1 FROM profiles p
          WHERE p.id = auth.uid() AND p.role = ''superadmin''
        )
      )';
  END IF;
END $$;

-- achievements
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'achievements'
      AND policyname = 'Supervisors can view assigned st achievements'
  ) THEN
    EXECUTE 'CREATE POLICY "Supervisors can view assigned st achievements"
      ON achievements FOR SELECT
      USING (
        user_id = auth.uid()
        OR EXISTS (
          SELECT 1
          FROM supervisor_assignments sa
          WHERE sa.supervisor_id = auth.uid()
            AND sa.st_lakare_id = achievements.user_id
        )
        OR EXISTS (
          SELECT 1 FROM profiles p
          WHERE p.id = auth.uid() AND p.role = ''superadmin''
        )
      )';
  END IF;
END $$;

-- timeline_versions
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'timeline_versions'
      AND policyname = 'Supervisors can view assigned st timeline_versions'
  ) THEN
    EXECUTE 'CREATE POLICY "Supervisors can view assigned st timeline_versions"
      ON timeline_versions FOR SELECT
      USING (
        user_id = auth.uid()
        OR EXISTS (
          SELECT 1
          FROM supervisor_assignments sa
          WHERE sa.supervisor_id = auth.uid()
            AND sa.st_lakare_id = timeline_versions.user_id
        )
        OR EXISTS (
          SELECT 1 FROM profiles p
          WHERE p.id = auth.uid() AND p.role = ''superadmin''
        )
      )';
  END IF;
END $$;

-- milestone_plans
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'milestone_plans'
      AND policyname = 'Supervisors can view assigned st milestone_plans'
  ) THEN
    EXECUTE 'CREATE POLICY "Supervisors can view assigned st milestone_plans"
      ON milestone_plans FOR SELECT
      USING (
        user_id = auth.uid()
        OR EXISTS (
          SELECT 1
          FROM supervisor_assignments sa
          WHERE sa.supervisor_id = auth.uid()
            AND sa.st_lakare_id = milestone_plans.user_id
        )
        OR EXISTS (
          SELECT 1 FROM profiles p
          WHERE p.id = auth.uid() AND p.role = ''superadmin''
        )
      )';
  END IF;
END $$;

-- profiles
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

-- iup_settings
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'iup_settings'
      AND policyname = 'Supervisors can view assigned st iup_settings'
  ) THEN
    EXECUTE 'CREATE POLICY "Supervisors can view assigned st iup_settings"
      ON iup_settings FOR SELECT
      USING (
        user_id = auth.uid()
        OR EXISTS (
          SELECT 1
          FROM supervisor_assignments sa
          WHERE sa.supervisor_id = auth.uid()
            AND sa.st_lakare_id = iup_settings.user_id
        )
        OR EXISTS (
          SELECT 1 FROM profiles p
          WHERE p.id = auth.uid() AND p.role = ''superadmin''
        )
      )';
  END IF;
END $$;

