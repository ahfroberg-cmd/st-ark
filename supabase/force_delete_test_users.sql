-- Force delete test users by removing from all tables
-- Detta går runt Supabase Auth och tar bort användarna direkt
-- VARNING: Använd endast för test-användare!

DO $$
DECLARE
  test_user_ids uuid[];
BEGIN
  -- Hämta alla test-användar-ID:n
  SELECT array_agg(id) INTO test_user_ids
  FROM auth.users
  WHERE email LIKE '%@test.se' OR email LIKE '%@test-dummy.local';

  IF test_user_ids IS NULL OR array_length(test_user_ids, 1) = 0 THEN
    RAISE NOTICE 'Inga test-användare hittades';
    RETURN;
  END IF;

  -- Ta bort från clinic_memberships
  DELETE FROM clinic_memberships WHERE user_id = ANY(test_user_ids);
  RAISE NOTICE 'Tog bort från clinic_memberships';

  -- Ta bort från profiles
  DELETE FROM profiles WHERE id = ANY(test_user_ids);
  RAISE NOTICE 'Tog bort från profiles';

  -- Ta bort från auth.identities (om det finns)
  DELETE FROM auth.identities WHERE user_id = ANY(test_user_ids);
  RAISE NOTICE 'Tog bort från auth.identities';

  -- Ta bort från auth.sessions (om det finns)
  DELETE FROM auth.sessions WHERE user_id = ANY(test_user_ids);
  RAISE NOTICE 'Tog bort från auth.sessions';

  -- Ta bort från auth.users
  DELETE FROM auth.users WHERE id = ANY(test_user_ids);
  RAISE NOTICE 'Tog bort från auth.users';

  RAISE NOTICE 'Tog bort % test-användare', array_length(test_user_ids, 1);
END $$;

-- Verifiera att de är borta
SELECT COUNT(*) as remaining_test_users
FROM auth.users
WHERE email LIKE '%@test%';
