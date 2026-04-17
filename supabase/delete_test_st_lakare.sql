-- Ta bort alla test-ST-läkare från Psykiatri Psykos
-- Kör detta FÖRE create_test_st_lakare_simple.sql om du vill börja om

DO $$
DECLARE
  v_clinic_id uuid;
BEGIN
  -- Hämta clinic_id för Psykiatri Psykos
  SELECT id INTO v_clinic_id FROM clinics WHERE name = 'Psykiatri Psykos' LIMIT 1;
  
  IF v_clinic_id IS NULL THEN
    RAISE NOTICE 'Kliniken "Psykiatri Psykos" hittades inte.';
    RETURN;
  END IF;

  -- Ta bort alla ST-läkare med test-dummy.local emails
  DELETE FROM auth.users 
  WHERE email LIKE '%@test-dummy.local';

  RAISE NOTICE 'Tog bort alla test-ST-läkare med @test-dummy.local emails';
END $$;

-- Verifiera att de är borta
SELECT 
  p.name,
  au.email,
  c.name as clinic_name
FROM profiles p
LEFT JOIN auth.users au ON au.id = p.id
LEFT JOIN clinic_memberships cm ON cm.user_id = p.id
LEFT JOIN clinics c ON c.id = cm.clinic_id
WHERE au.email LIKE '%@test-dummy.local'
  OR (p.role = 'st_lakare' AND c.name = 'Psykiatri Psykos');
