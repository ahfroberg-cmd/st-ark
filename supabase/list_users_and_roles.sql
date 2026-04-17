-- 1. Alla användare med deras profil och roll
SELECT 
  u.id,
  u.email,
  u.created_at as user_created,
  p.role,
  p.name,
  p.mobile,
  p.secondary_email,
  p.other_information
FROM auth.users u
LEFT JOIN profiles p ON u.id = p.id
ORDER BY u.created_at DESC;

-- 2. Endast studierektorer
SELECT 
  u.email,
  p.name,
  p.mobile,
  p.secondary_email,
  p.other_information
FROM auth.users u
JOIN profiles p ON u.id = p.id
WHERE p.role = 'studierektor'
ORDER BY p.name;

-- 3. Endast superadmin
SELECT 
  u.email,
  p.name
FROM auth.users u
JOIN profiles p ON u.id = p.id
WHERE p.role = 'superadmin';

-- 4. Användare utan profil (kan behöva skapas)
SELECT 
  u.id,
  u.email,
  u.created_at
FROM auth.users u
LEFT JOIN profiles p ON u.id = p.id
WHERE p.id IS NULL
ORDER BY u.created_at DESC;
