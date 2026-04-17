-- Lägg till RLS-policy så användare kan läsa och uppdatera sin egen profil

-- Ta bort gamla policies om de finns
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;

-- Tillåt användare att läsa sin egen profil
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

-- Tillåt användare att uppdatera sin egen profil
CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

-- Tillåt användare att skapa sin egen profil (vid första inloggning)
CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Tillåt studierektor att ta bort inbjudningar till sin klinik
DROP POLICY IF EXISTS "Studierektor can delete own clinic invitations" ON invitations;
CREATE POLICY "Studierektor can delete own clinic invitations"
  ON invitations FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM clinic_memberships cm
      WHERE cm.clinic_id = invitations.clinic_id
        AND cm.user_id = auth.uid()
        AND cm.role = 'studierektor'
    )
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'superadmin')
  );
