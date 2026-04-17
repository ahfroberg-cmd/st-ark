-- 1. Sätt studierektorsroll på befintlig profil
-- Om profilen redan finns
UPDATE profiles 
SET role = 'studierektor' 
WHERE id = (SELECT id FROM auth.users WHERE email = 'andreas.hofflander@yahoo.com');

-- 2. Skapa profil om den inte finns och sätt roll
-- Om profilen saknas helt
INSERT INTO profiles (id, role, name, updated_at)
SELECT id, 'studierektor', 'Andreas Hofflander', NOW()
FROM auth.users 
WHERE email = 'andreas.hofflander@yahoo.com'
AND NOT EXISTS (SELECT 1 FROM profiles WHERE id = (SELECT id FROM auth.users WHERE email = 'andreas.hofflander@yahoo.com'));

-- 3. Koppla till en befintlig klinik (valfritt men rekommenderat)
-- Välj en klinik först:
SELECT id, name FROM clinics ORDER BY name;

-- Koppla sedan till klinik (ersätt 'CLINIC_ID_HÄR' med id från queryn ovan)
INSERT INTO clinic_memberships (clinic_id, user_id, role)
SELECT 'CLINIC_ID_HÄR', id, 'studierektor'
FROM auth.users 
WHERE email = 'andreas.hofflander@yahoo.com'
ON CONFLICT (clinic_id, user_id) 
DO UPDATE SET role = 'studierektor';

-- 4. Verifiera resultatet
SELECT 
  u.email,
  p.role,
  p.name,
  cm.clinic_id,
  c.name as clinic_name
FROM auth.users u
LEFT JOIN profiles p ON u.id = p.id
LEFT JOIN clinic_memberships cm ON u.id = cm.user_id
LEFT JOIN clinics c ON cm.clinic_id = c.id
WHERE u.email = 'andreas.hofflander@yahoo.com';
