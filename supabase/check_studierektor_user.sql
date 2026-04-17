-- Kolla användare och profil för studierektor
SELECT 
  u.id,
  u.email,
  u.email_confirmed_at,
  p.role,
  p.name
FROM auth.users u
LEFT JOIN profiles p ON u.id = p.id
WHERE u.email = 'andreas.hofflander@yahoo.com';
