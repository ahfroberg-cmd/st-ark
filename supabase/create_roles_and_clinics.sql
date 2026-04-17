-- =============================================================
-- ST-ARK: Rollhantering, kliniker och inbjudningar
-- Kör detta i Supabase SQL Editor
-- =============================================================

-- 1) Lägg till role-kolumn på profiles
-- Möjliga värden: 'st_lakare', 'studierektor', 'superadmin'
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'st_lakare'
  CHECK (role IN ('st_lakare', 'studierektor', 'superadmin'));

-- 2) Kliniker
CREATE TABLE IF NOT EXISTS clinics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  city TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE clinics ENABLE ROW LEVEL SECURITY;

-- Alla inloggade kan se kliniker
CREATE POLICY "Authenticated users can view clinics"
  ON clinics FOR SELECT
  USING (auth.role() = 'authenticated');

-- Bara superadmin kan skapa/ändra/ta bort kliniker
CREATE POLICY "Superadmin can insert clinics"
  ON clinics FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'superadmin')
  );

CREATE POLICY "Superadmin can update clinics"
  ON clinics FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'superadmin')
  );

CREATE POLICY "Superadmin can delete clinics"
  ON clinics FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'superadmin')
  );

-- 3) Klinikmembership (kopplar användare till kliniker)
CREATE TABLE IF NOT EXISTS clinic_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'st_lakare'
    CHECK (role IN ('st_lakare', 'studierektor')),
  joined_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (clinic_id, user_id)
);

ALTER TABLE clinic_memberships ENABLE ROW LEVEL SECURITY;

-- Alla inloggade kan se memberships (behövs för att visa klinikmedlemmar)
CREATE POLICY "Authenticated users can view memberships"
  ON clinic_memberships FOR SELECT
  USING (auth.role() = 'authenticated');

-- Superadmin kan skapa memberships (t.ex. tilldela studierektor)
CREATE POLICY "Superadmin can insert memberships"
  ON clinic_memberships FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'superadmin')
  );

-- Superadmin kan ta bort memberships
CREATE POLICY "Superadmin can delete memberships"
  ON clinic_memberships FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'superadmin')
  );

-- Studierektor kan också lägga till ST-läkare till sin klinik
CREATE POLICY "Studierektor can add st_lakare to own clinic"
  ON clinic_memberships FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM clinic_memberships cm
      WHERE cm.clinic_id = clinic_memberships.clinic_id
        AND cm.user_id = auth.uid()
        AND cm.role = 'studierektor'
    )
    AND role = 'st_lakare'
  );

-- 4) Inbjudningar (studierektor bjuder in ST-läkare via e-post)
CREATE TABLE IF NOT EXISTS invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  invited_by UUID NOT NULL REFERENCES auth.users(id),
  role TEXT NOT NULL DEFAULT 'st_lakare'
    CHECK (role IN ('st_lakare', 'studierektor')),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'expired')),
  token TEXT NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  created_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ DEFAULT (now() + interval '30 days'),
  accepted_at TIMESTAMPTZ
);

ALTER TABLE invitations ENABLE ROW LEVEL SECURITY;

-- Studierektor kan se inbjudningar till sin klinik
CREATE POLICY "Studierektor can view own clinic invitations"
  ON invitations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM clinic_memberships cm
      WHERE cm.clinic_id = invitations.clinic_id
        AND cm.user_id = auth.uid()
        AND cm.role = 'studierektor'
    )
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'superadmin')
  );

-- Studierektor kan skapa inbjudningar till sin klinik
CREATE POLICY "Studierektor can insert invitations to own clinic"
  ON invitations FOR INSERT
  WITH CHECK (
    invited_by = auth.uid()
    AND (
      EXISTS (
        SELECT 1 FROM clinic_memberships cm
        WHERE cm.clinic_id = invitations.clinic_id
          AND cm.user_id = auth.uid()
          AND cm.role = 'studierektor'
      )
      OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'superadmin')
    )
  );

-- Studierektor kan uppdatera (t.ex. återkalla) inbjudningar
CREATE POLICY "Studierektor can update own clinic invitations"
  ON invitations FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM clinic_memberships cm
      WHERE cm.clinic_id = invitations.clinic_id
        AND cm.user_id = auth.uid()
        AND cm.role = 'studierektor'
    )
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'superadmin')
  );

-- Index
CREATE INDEX IF NOT EXISTS idx_clinic_memberships_clinic ON clinic_memberships(clinic_id);
CREATE INDEX IF NOT EXISTS idx_clinic_memberships_user ON clinic_memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_invitations_clinic ON invitations(clinic_id);
CREATE INDEX IF NOT EXISTS idx_invitations_email ON invitations(email);
CREATE INDEX IF NOT EXISTS idx_invitations_token ON invitations(token);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);
