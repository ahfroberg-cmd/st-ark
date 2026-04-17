-- Lägg till name-kolumn i invitations (namn som studierektorn angav vid inbjudan)
ALTER TABLE invitations ADD COLUMN IF NOT EXISTS name TEXT;

-- RLS: Studierektor ska kunna läsa timeline_versions för ST-läkare i sin klinik
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Studierektor can view clinic st_lakare timeline_versions' AND tablename = 'timeline_versions'
  ) THEN
    EXECUTE 'CREATE POLICY "Studierektor can view clinic st_lakare timeline_versions" ON timeline_versions FOR SELECT USING (EXISTS (SELECT 1 FROM clinic_memberships cm_sr JOIN clinic_memberships cm_st ON cm_sr.clinic_id = cm_st.clinic_id WHERE cm_sr.user_id = auth.uid() AND cm_sr.role = ''studierektor'' AND cm_st.user_id = timeline_versions.user_id AND cm_st.role = ''st_lakare''))';
  END IF;
END $$;

-- RLS: Studierektor ska kunna läsa milestone_plans för ST-läkare i sin klinik
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Studierektor can view clinic st_lakare milestone_plans' AND tablename = 'milestone_plans'
  ) THEN
    EXECUTE 'CREATE POLICY "Studierektor can view clinic st_lakare milestone_plans" ON milestone_plans FOR SELECT USING (EXISTS (SELECT 1 FROM clinic_memberships cm_sr JOIN clinic_memberships cm_st ON cm_sr.clinic_id = cm_st.clinic_id WHERE cm_sr.user_id = auth.uid() AND cm_sr.role = ''studierektor'' AND cm_st.user_id = milestone_plans.user_id AND cm_st.role = ''st_lakare''))';
  END IF;
END $$;

-- RLS: Studierektor ska kunna läsa placements för ST-läkare i sin klinik
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Studierektor can view clinic st_lakare placements' AND tablename = 'placements'
  ) THEN
    EXECUTE 'CREATE POLICY "Studierektor can view clinic st_lakare placements" ON placements FOR SELECT USING (EXISTS (SELECT 1 FROM clinic_memberships cm_sr JOIN clinic_memberships cm_st ON cm_sr.clinic_id = cm_st.clinic_id WHERE cm_sr.user_id = auth.uid() AND cm_sr.role = ''studierektor'' AND cm_st.user_id = placements.user_id AND cm_st.role = ''st_lakare''))';
  END IF;
END $$;

-- RLS: Studierektor ska kunna läsa courses för ST-läkare i sin klinik
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Studierektor can view clinic st_lakare courses' AND tablename = 'courses'
  ) THEN
    EXECUTE 'CREATE POLICY "Studierektor can view clinic st_lakare courses" ON courses FOR SELECT USING (EXISTS (SELECT 1 FROM clinic_memberships cm_sr JOIN clinic_memberships cm_st ON cm_sr.clinic_id = cm_st.clinic_id WHERE cm_sr.user_id = auth.uid() AND cm_sr.role = ''studierektor'' AND cm_st.user_id = courses.user_id AND cm_st.role = ''st_lakare''))';
  END IF;
END $$;

-- RLS: Studierektor ska kunna läsa achievements för ST-läkare i sin klinik
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Studierektor can view clinic st_lakare achievements' AND tablename = 'achievements'
  ) THEN
    EXECUTE 'CREATE POLICY "Studierektor can view clinic st_lakare achievements" ON achievements FOR SELECT USING (EXISTS (SELECT 1 FROM clinic_memberships cm_sr JOIN clinic_memberships cm_st ON cm_sr.clinic_id = cm_st.clinic_id WHERE cm_sr.user_id = auth.uid() AND cm_sr.role = ''studierektor'' AND cm_st.user_id = achievements.user_id AND cm_st.role = ''st_lakare''))';
  END IF;
END $$;

-- RLS: Studierektor ska kunna läsa profiles för ST-läkare i sin klinik
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Studierektor can view clinic st_lakare profiles' AND tablename = 'profiles'
  ) THEN
    EXECUTE 'CREATE POLICY "Studierektor can view clinic st_lakare profiles" ON profiles FOR SELECT USING (EXISTS (SELECT 1 FROM clinic_memberships cm_sr JOIN clinic_memberships cm_st ON cm_sr.clinic_id = cm_st.clinic_id WHERE cm_sr.user_id = auth.uid() AND cm_sr.role = ''studierektor'' AND cm_st.user_id = profiles.id AND cm_st.role = ''st_lakare''))';
  END IF;
END $$;

-- RLS: Studierektor ska kunna läsa iup_settings för ST-läkare i sin klinik
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Studierektor can view clinic st_lakare iup_settings' AND tablename = 'iup_settings'
  ) THEN
    EXECUTE 'CREATE POLICY "Studierektor can view clinic st_lakare iup_settings" ON iup_settings FOR SELECT USING (EXISTS (SELECT 1 FROM clinic_memberships cm_sr JOIN clinic_memberships cm_st ON cm_sr.clinic_id = cm_st.clinic_id WHERE cm_sr.user_id = auth.uid() AND cm_sr.role = ''studierektor'' AND cm_st.user_id = iup_settings.user_id AND cm_st.role = ''st_lakare''))';
  END IF;
END $$;

-- RLS: Inbjudna användare ska kunna läsa sina egna inbjudningar via email
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Users can view own invitations by email' AND tablename = 'invitations'
  ) THEN
    EXECUTE 'CREATE POLICY "Users can view own invitations by email" ON invitations FOR SELECT USING (lower(email) = lower((SELECT email FROM profiles WHERE id = auth.uid())) OR lower(email) = lower(auth.email()))';
  END IF;
END $$;
