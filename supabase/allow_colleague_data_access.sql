-- Allow ST-läkare to view their colleagues' data (placements, courses, achievements)
-- Colleagues are defined as other ST-läkare in the same clinic

-- ST-läkare can view placements of colleagues in same clinic
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'ST-läkare can view colleague placements' AND tablename = 'placements'
  ) THEN
    EXECUTE 'CREATE POLICY "ST-läkare can view colleague placements" ON placements FOR SELECT USING (
      EXISTS (
        SELECT 1 FROM clinic_memberships cm_self
        JOIN clinic_memberships cm_colleague ON cm_self.clinic_id = cm_colleague.clinic_id
        WHERE cm_self.user_id = auth.uid()
          AND cm_self.role = ''st_lakare''
          AND cm_colleague.user_id = placements.user_id
          AND cm_colleague.role = ''st_lakare''
      )
    )';
  END IF;
END $$;

-- ST-läkare can view courses of colleagues in same clinic
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'ST-läkare can view colleague courses' AND tablename = 'courses'
  ) THEN
    EXECUTE 'CREATE POLICY "ST-läkare can view colleague courses" ON courses FOR SELECT USING (
      EXISTS (
        SELECT 1 FROM clinic_memberships cm_self
        JOIN clinic_memberships cm_colleague ON cm_self.clinic_id = cm_colleague.clinic_id
        WHERE cm_self.user_id = auth.uid()
          AND cm_self.role = ''st_lakare''
          AND cm_colleague.user_id = courses.user_id
          AND cm_colleague.role = ''st_lakare''
      )
    )';
  END IF;
END $$;

-- ST-läkare can view achievements of colleagues in same clinic
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'ST-läkare can view colleague achievements' AND tablename = 'achievements'
  ) THEN
    EXECUTE 'CREATE POLICY "ST-läkare can view colleague achievements" ON achievements FOR SELECT USING (
      EXISTS (
        SELECT 1 FROM clinic_memberships cm_self
        JOIN clinic_memberships cm_colleague ON cm_self.clinic_id = cm_colleague.clinic_id
        WHERE cm_self.user_id = auth.uid()
          AND cm_self.role = ''st_lakare''
          AND cm_colleague.user_id = achievements.user_id
          AND cm_colleague.role = ''st_lakare''
      )
    )';
  END IF;
END $$;

-- ST-läkare can view profiles of colleagues in same clinic
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'ST-läkare can view colleague profiles' AND tablename = 'profiles'
  ) THEN
    EXECUTE 'CREATE POLICY "ST-läkare can view colleague profiles" ON profiles FOR SELECT USING (
      EXISTS (
        SELECT 1 FROM clinic_memberships cm_self
        JOIN clinic_memberships cm_colleague ON cm_self.clinic_id = cm_colleague.clinic_id
        WHERE cm_self.user_id = auth.uid()
          AND cm_self.role = ''st_lakare''
          AND cm_colleague.user_id = profiles.id
          AND cm_colleague.role = ''st_lakare''
      )
    )';
  END IF;
END $$;

-- ST-läkare can view timeline_versions of colleagues in same clinic
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'ST-läkare can view colleague timeline_versions' AND tablename = 'timeline_versions'
  ) THEN
    EXECUTE 'CREATE POLICY "ST-läkare can view colleague timeline_versions" ON timeline_versions FOR SELECT USING (
      EXISTS (
        SELECT 1 FROM clinic_memberships cm_self
        JOIN clinic_memberships cm_colleague ON cm_self.clinic_id = cm_colleague.clinic_id
        WHERE cm_self.user_id = auth.uid()
          AND cm_self.role = ''st_lakare''
          AND cm_colleague.user_id = timeline_versions.user_id
          AND cm_colleague.role = ''st_lakare''
      )
    )';
  END IF;
END $$;

-- ST-läkare can view iup_settings of colleagues in same clinic
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'ST-läkare can view colleague iup_settings' AND tablename = 'iup_settings'
  ) THEN
    EXECUTE 'CREATE POLICY "ST-läkare can view colleague iup_settings" ON iup_settings FOR SELECT USING (
      EXISTS (
        SELECT 1 FROM clinic_memberships cm_self
        JOIN clinic_memberships cm_colleague ON cm_self.clinic_id = cm_colleague.clinic_id
        WHERE cm_self.user_id = auth.uid()
          AND cm_self.role = ''st_lakare''
          AND cm_colleague.user_id = iup_settings.user_id
          AND cm_colleague.role = ''st_lakare''
      )
    )';
  END IF;
END $$;

-- Huvudhandledare kan läsa tilldelad ST-läkares placements
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Huvudhandledare can view assigned placements' AND tablename = 'placements'
  ) THEN
    EXECUTE 'CREATE POLICY "Huvudhandledare can view assigned placements" ON placements FOR SELECT USING (
      EXISTS (
        SELECT 1 FROM supervisor_assignments sa
        WHERE sa.supervisor_id = auth.uid()
          AND sa.st_lakare_id = placements.user_id
      )
    )';
  END IF;
END $$;

-- Huvudhandledare kan läsa tilldelad ST-läkares courses
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Huvudhandledare can view assigned courses' AND tablename = 'courses'
  ) THEN
    EXECUTE 'CREATE POLICY "Huvudhandledare can view assigned courses" ON courses FOR SELECT USING (
      EXISTS (
        SELECT 1 FROM supervisor_assignments sa
        WHERE sa.supervisor_id = auth.uid()
          AND sa.st_lakare_id = courses.user_id
      )
    )';
  END IF;
END $$;

-- Huvudhandledare kan läsa tilldelad ST-läkares achievements
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Huvudhandledare can view assigned achievements' AND tablename = 'achievements'
  ) THEN
    EXECUTE 'CREATE POLICY "Huvudhandledare can view assigned achievements" ON achievements FOR SELECT USING (
      EXISTS (
        SELECT 1 FROM supervisor_assignments sa
        WHERE sa.supervisor_id = auth.uid()
          AND sa.st_lakare_id = achievements.user_id
      )
    )';
  END IF;
END $$;

-- Huvudhandledare kan läsa tilldelad ST-läkares timeline_versions
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Huvudhandledare can view assigned timeline_versions' AND tablename = 'timeline_versions'
  ) THEN
    EXECUTE 'CREATE POLICY "Huvudhandledare can view assigned timeline_versions" ON timeline_versions FOR SELECT USING (
      EXISTS (
        SELECT 1 FROM supervisor_assignments sa
        WHERE sa.supervisor_id = auth.uid()
          AND sa.st_lakare_id = timeline_versions.user_id
      )
    )';
  END IF;
END $$;

-- Huvudhandledare kan läsa tilldelad ST-läkares iup_settings
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Huvudhandledare can view assigned iup_settings' AND tablename = 'iup_settings'
  ) THEN
    EXECUTE 'CREATE POLICY "Huvudhandledare can view assigned iup_settings" ON iup_settings FOR SELECT USING (
      EXISTS (
        SELECT 1 FROM supervisor_assignments sa
        WHERE sa.supervisor_id = auth.uid()
          AND sa.st_lakare_id = iup_settings.user_id
      )
    )';
  END IF;
END $$;

-- Huvudhandledare kan läsa tilldelad ST-läkares milestone_plans
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Huvudhandledare can view assigned milestone_plans' AND tablename = 'milestone_plans'
  ) THEN
    EXECUTE 'CREATE POLICY "Huvudhandledare can view assigned milestone_plans" ON milestone_plans FOR SELECT USING (
      EXISTS (
        SELECT 1 FROM supervisor_assignments sa
        WHERE sa.supervisor_id = auth.uid()
          AND sa.st_lakare_id = milestone_plans.user_id
      )
    )';
  END IF;
END $$;
