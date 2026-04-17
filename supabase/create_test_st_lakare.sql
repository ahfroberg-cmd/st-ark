-- Skapa test-ST-läkare och koppla dem till Psykiatri Psykos-kliniken
-- Kör detta i Supabase SQL Editor

-- Först, hitta clinic_id för "Psykiatri Psykos"
DO $$
DECLARE
  v_clinic_id uuid;
  v_user_id uuid;
BEGIN
  -- Hämta clinic_id för Psykiatri Psykos
  SELECT id INTO v_clinic_id FROM clinics WHERE name = 'Psykiatri Psykos' LIMIT 1;
  
  IF v_clinic_id IS NULL THEN
    RAISE EXCEPTION 'Kliniken "Psykiatri Psykos" hittades inte. Skapa den först.';
  END IF;

  -- ST-läkare 1: Anna Andersson
  INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    created_at,
    updated_at,
    confirmation_token,
    recovery_token
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    gen_random_uuid(),
    'authenticated',
    'authenticated',
    'anna.andersson@test.se',
    crypt('password123', gen_salt('bf')),
    now(),
    now(),
    now(),
    '',
    ''
  ) RETURNING id INTO v_user_id;

  INSERT INTO profiles (id, name, specialty, goals_version, st_start_date, created_at, updated_at, role)
  VALUES (
    v_user_id,
    'Anna Andersson',
    'Psykiatri',
    '2021',
    '2022-01-15',
    now(),
    now(),
    'st_lakare'
  );

  INSERT INTO clinic_memberships (clinic_id, user_id, role)
  VALUES (v_clinic_id, v_user_id, 'st_lakare');

  -- ST-läkare 2: Björn Bergström
  INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    created_at,
    updated_at,
    confirmation_token,
    recovery_token
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    gen_random_uuid(),
    'authenticated',
    'authenticated',
    'bjorn.bergstrom@test.se',
    crypt('password123', gen_salt('bf')),
    now(),
    now(),
    now(),
    '',
    ''
  ) RETURNING id INTO v_user_id;

  INSERT INTO profiles (id, name, specialty, goals_version, st_start_date, created_at, updated_at, role)
  VALUES (
    v_user_id,
    'Björn Bergström',
    'Psykiatri',
    '2021',
    '2021-07-01',
    now(),
    now(),
    'st_lakare'
  );

  INSERT INTO clinic_memberships (clinic_id, user_id, role)
  VALUES (v_clinic_id, v_user_id, 'st_lakare');

  -- ST-läkare 3: Cecilia Carlsson
  INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    created_at,
    updated_at,
    confirmation_token,
    recovery_token
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    gen_random_uuid(),
    'authenticated',
    'authenticated',
    'cecilia.carlsson@test.se',
    crypt('password123', gen_salt('bf')),
    now(),
    now(),
    now(),
    '',
    ''
  ) RETURNING id INTO v_user_id;

  INSERT INTO profiles (id, name, specialty, goals_version, st_start_date, created_at, updated_at, role)
  VALUES (
    v_user_id,
    'Cecilia Carlsson',
    'Psykiatri',
    '2015',
    '2020-08-15',
    now(),
    now(),
    'st_lakare'
  );

  INSERT INTO clinic_memberships (clinic_id, user_id, role)
  VALUES (v_clinic_id, v_user_id, 'st_lakare');

  -- ST-läkare 4: David Danielsson
  INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    created_at,
    updated_at,
    confirmation_token,
    recovery_token
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    gen_random_uuid(),
    'authenticated',
    'authenticated',
    'david.danielsson@test.se',
    crypt('password123', gen_salt('bf')),
    now(),
    now(),
    now(),
    '',
    ''
  ) RETURNING id INTO v_user_id;

  INSERT INTO profiles (id, name, specialty, goals_version, st_start_date, created_at, updated_at, role)
  VALUES (
    v_user_id,
    'David Danielsson',
    'Psykiatri',
    '2021',
    '2023-02-01',
    now(),
    now(),
    'st_lakare'
  );

  INSERT INTO clinic_memberships (clinic_id, user_id, role)
  VALUES (v_clinic_id, v_user_id, 'st_lakare');

  -- ST-läkare 5: Emma Eriksson
  INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    created_at,
    updated_at,
    confirmation_token,
    recovery_token
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    gen_random_uuid(),
    'authenticated',
    'authenticated',
    'emma.eriksson@test.se',
    crypt('password123', gen_salt('bf')),
    now(),
    now(),
    now(),
    '',
    ''
  ) RETURNING id INTO v_user_id;

  INSERT INTO profiles (id, name, specialty, goals_version, st_start_date, created_at, updated_at, role)
  VALUES (
    v_user_id,
    'Emma Eriksson',
    'Psykiatri',
    '2021',
    '2022-09-01',
    now(),
    now(),
    'st_lakare'
  );

  INSERT INTO clinic_memberships (clinic_id, user_id, role)
  VALUES (v_clinic_id, v_user_id, 'st_lakare');

  RAISE NOTICE 'Skapade 5 test-ST-läkare kopplade till Psykiatri Psykos';
END $$;

-- Verifiera att de skapades
SELECT 
  p.name,
  p.specialty,
  p.st_start_date,
  au.email,
  c.name as clinic_name
FROM profiles p
JOIN auth.users au ON au.id = p.id
JOIN clinic_memberships cm ON cm.user_id = p.id
JOIN clinics c ON c.id = cm.clinic_id
WHERE p.role = 'st_lakare'
  AND c.name = 'Psykiatri Psykos'
ORDER BY p.name;
