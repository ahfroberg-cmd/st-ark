-- Koppla manuellt skapade användare till Psykiatri Psykos
-- Kör detta EFTER att du skapat användare i Supabase Dashboard

DO $$
DECLARE
  v_clinic_id uuid;
  v_user record;
  test_emails text[] := ARRAY[
    'anna.andersson@test.se',
    'bjorn.bergstrom@test.se',
    'cecilia.carlsson@test.se'
  ];
  user_names text[] := ARRAY[
    'Anna Andersson',
    'Björn Bergström',
    'Cecilia Carlsson'
  ];
  start_dates text[] := ARRAY[
    '2022-01-15',
    '2021-07-01',
    '2020-08-15'
  ];
  goals_versions text[] := ARRAY[
    '2021',
    '2021',
    '2015'
  ];
  i int;
BEGIN
  -- Hämta clinic_id för Psykiatri Psykos
  SELECT id INTO v_clinic_id FROM clinics WHERE name = 'Psykiatri Psykos' LIMIT 1;
  
  IF v_clinic_id IS NULL THEN
    RAISE EXCEPTION 'Kliniken "Psykiatri Psykos" hittades inte';
  END IF;

  -- Loopa igenom alla emails
  FOR i IN 1..array_length(test_emails, 1) LOOP
    -- Hitta användaren
    SELECT id INTO v_user FROM auth.users WHERE email = test_emails[i];
    
    IF v_user.id IS NOT NULL THEN
      -- Skapa/uppdatera profil
      INSERT INTO profiles (id, name, specialty, goals_version, st_start_date, created_at, updated_at, role)
      VALUES (
        v_user.id,
        user_names[i],
        'Psykiatri',
        goals_versions[i],
        start_dates[i]::date,
        now(),
        now(),
        'st_lakare'
      )
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        specialty = EXCLUDED.specialty,
        goals_version = EXCLUDED.goals_version,
        st_start_date = EXCLUDED.st_start_date,
        role = EXCLUDED.role;
      
      -- Koppla till klinik
      INSERT INTO clinic_memberships (clinic_id, user_id, role)
      VALUES (v_clinic_id, v_user.id, 'st_lakare')
      ON CONFLICT DO NOTHING;
      
      RAISE NOTICE 'Kopplade % till Psykiatri Psykos', user_names[i];
    ELSE
      RAISE NOTICE 'Användare % hittades inte - skapa den i Dashboard först', test_emails[i];
    END IF;
  END LOOP;

  RAISE NOTICE 'Klart!';
END $$;

-- Verifiera resultatet
SELECT 
  p.name,
  au.email,
  p.specialty,
  p.st_start_date,
  c.name as clinic_name
FROM profiles p
JOIN auth.users au ON au.id = p.id
JOIN clinic_memberships cm ON cm.user_id = p.id
JOIN clinics c ON c.id = cm.clinic_id
WHERE c.name = 'Psykiatri Psykos'
  AND p.role = 'st_lakare'
ORDER BY p.name;
