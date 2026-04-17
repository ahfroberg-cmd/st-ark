-- Uppdatera check-constraint på sr_activity_suggestions för att inkludera
-- 'progression_assessment' och ta bort 'leave'. Behåller 'leave' i constraint
-- för bakåtkompatibilitet med eventuella befintliga poster.

DO $$
BEGIN
  -- Drop old constraint if exists
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'sr_activity_suggestions_activity_type_check'
      AND conrelid = 'sr_activity_suggestions'::regclass
  ) THEN
    ALTER TABLE sr_activity_suggestions
      DROP CONSTRAINT sr_activity_suggestions_activity_type_check;
  END IF;
  -- Add new constraint
  ALTER TABLE sr_activity_suggestions
    ADD CONSTRAINT sr_activity_suggestions_activity_type_check
    CHECK (activity_type IN ('placement', 'leave', 'course', 'sr_meeting', 'progression_assessment'));
END $$;

-- RLS: studierektor kan läsa ST-läkarens kurser (för att visa kursrullista i dashboard)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Studierektor can read clinic member courses' AND tablename = 'courses'
  ) THEN
    EXECUTE '
      CREATE POLICY "Studierektor can read clinic member courses"
      ON courses FOR SELECT
      USING (
        EXISTS (
          SELECT 1 FROM clinic_memberships cm_sr
          JOIN clinic_memberships cm_st ON cm_st.clinic_id = cm_sr.clinic_id
          WHERE cm_sr.user_id = auth.uid()
            AND cm_sr.role = ''studierektor''
            AND cm_st.user_id = courses.user_id
        )
      )
    ';
  END IF;
END $$;

-- RLS: studierektor kan läsa ST-läkarens iup_settings (instrument-lista)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Studierektor can read clinic member iup_settings' AND tablename = 'iup_settings'
  ) THEN
    EXECUTE '
      CREATE POLICY "Studierektor can read clinic member iup_settings"
      ON iup_settings FOR SELECT
      USING (
        EXISTS (
          SELECT 1 FROM clinic_memberships cm_sr
          JOIN clinic_memberships cm_st ON cm_st.clinic_id = cm_sr.clinic_id
          WHERE cm_sr.user_id = auth.uid()
            AND cm_sr.role = ''studierektor''
            AND cm_st.user_id = iup_settings.user_id
        )
      )
    ';
  END IF;
END $$;
