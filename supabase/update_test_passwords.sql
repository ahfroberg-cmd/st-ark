-- Uppdatera lösenord för alla test-ST-läkare
-- Kör detta i Supabase SQL Editor

-- Uppdatera lösenord för alla test-användare
UPDATE auth.users 
SET encrypted_password = crypt('password123', gen_salt('bf'))
WHERE email IN (
  'anna.andersson@test.se',
  'bjorn.bergstrom@test.se',
  'cecilia.carlsson@test.se',
  'david.danielsson@test.se',
  'emma.eriksson@test.se',
  'fredrik.fredriksson@test-dummy.local',
  'gabriella.gustafsson@test-dummy.local',
  'henrik.hansson@test-dummy.local'
);

-- Verifiera att lösenorden uppdaterades
SELECT 
  email,
  encrypted_password IS NOT NULL as has_password,
  email_confirmed_at IS NOT NULL as email_confirmed
FROM auth.users 
WHERE email LIKE '%test%'
ORDER BY email;
