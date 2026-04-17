-- ST-läkare ska kunna läsa profiler för studierektor och huvudhandledare på samma klinik
-- (t.ex. Hemklinik-modalen). Policyn "ST-läkare can view colleague profiles" i
-- allow_colleague_data_access.sql tillåter endast andra st_lakare, vilket gav tomma
-- namn ("Okänd") för ledningsroller trots att de finns i clinic_memberships.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE policyname = 'ST-lakare can view clinic leadership profiles'
      AND tablename = 'profiles'
  ) THEN
    EXECUTE '
      CREATE POLICY "ST-lakare can view clinic leadership profiles"
      ON profiles FOR SELECT
      USING (
        EXISTS (
          SELECT 1
          FROM clinic_memberships cm_self
          JOIN clinic_memberships cm_leader ON cm_self.clinic_id = cm_leader.clinic_id
          WHERE cm_self.user_id = auth.uid()
            AND cm_self.role = ''st_lakare''
            AND cm_leader.user_id = profiles.id
            AND cm_leader.role IN (
              ''studierektor'',
              ''studierektor_admin'',
              ''study_director'',
              ''huvudhandledare'',
              ''supervisor'',
              ''handledare''
            )
        )
      )
    ';
  END IF;
END $$;
