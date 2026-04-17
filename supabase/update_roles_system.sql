-- Uppdatera rollsystemet för ST-ARK
-- Roller: st_lakare, huvudhandledare, studierektor, superadmin

-- 1) Uppdatera profiles-tabellen med nya roller
ALTER TABLE profiles
  DROP CONSTRAINT IF EXISTS profiles_role_check;

ALTER TABLE profiles
  ADD CONSTRAINT profiles_role_check 
  CHECK (role IN ('st_lakare', 'huvudhandledare', 'studierektor', 'superadmin'));

-- 2) Uppdatera clinic_memberships för att stödja huvudhandledare
ALTER TABLE clinic_memberships
  DROP CONSTRAINT IF EXISTS clinic_memberships_role_check;

ALTER TABLE clinic_memberships
  ADD CONSTRAINT clinic_memberships_role_check
  CHECK (role IN ('st_lakare', 'huvudhandledare', 'studierektor'));

-- 3) Uppdatera invitations för att stödja alla roller
ALTER TABLE invitations
  ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'st_lakare'
  CHECK (role IN ('st_lakare', 'huvudhandledare', 'studierektor'));

-- 4) Lägg till invited_by för att spåra vem som bjöd in
ALTER TABLE invitations
  ADD COLUMN IF NOT EXISTS invited_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- 5) Uppdatera RLS policies för invitations

-- Studierektor kan bjuda in ST-läkare och huvudhandledare
DROP POLICY IF EXISTS "Studierektor can create invitations" ON invitations;
CREATE POLICY "Studierektor can create invitations"
  ON invitations FOR INSERT
  WITH CHECK (
    (
      role IN ('st_lakare', 'huvudhandledare')
      AND EXISTS (
        SELECT 1 FROM clinic_memberships cm
        WHERE cm.clinic_id = clinic_id
          AND cm.user_id = auth.uid()
          AND cm.role = 'studierektor'
      )
    )
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'superadmin')
  );

-- Superadmin kan bjuda in studierektorer
DROP POLICY IF EXISTS "Superadmin can create studierektor invitations" ON invitations;
CREATE POLICY "Superadmin can create studierektor invitations"
  ON invitations FOR INSERT
  WITH CHECK (
    role = 'studierektor'
    AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'superadmin')
  );

-- 6) Skapa tabell för handledare-ST-läkare kopplingar
CREATE TABLE IF NOT EXISTS supervisor_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supervisor_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  st_lakare_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  assigned_at TIMESTAMPTZ DEFAULT now(),
  assigned_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  UNIQUE(supervisor_id, st_lakare_id)
);

-- Index
CREATE INDEX IF NOT EXISTS idx_supervisor_assignments_supervisor ON supervisor_assignments(supervisor_id);
CREATE INDEX IF NOT EXISTS idx_supervisor_assignments_st_lakare ON supervisor_assignments(st_lakare_id);
CREATE INDEX IF NOT EXISTS idx_supervisor_assignments_clinic ON supervisor_assignments(clinic_id);

-- RLS för supervisor_assignments
ALTER TABLE supervisor_assignments ENABLE ROW LEVEL SECURITY;

-- Handledare kan se sina egna tilldelningar
CREATE POLICY "Supervisors can view own assignments"
  ON supervisor_assignments FOR SELECT
  USING (
    supervisor_id = auth.uid()
    OR st_lakare_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM clinic_memberships cm
      WHERE cm.clinic_id = clinic_id
        AND cm.user_id = auth.uid()
        AND cm.role = 'studierektor'
    )
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'superadmin')
  );

-- Studierektor kan skapa tilldelningar
CREATE POLICY "Studierektor can create assignments"
  ON supervisor_assignments FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM clinic_memberships cm
      WHERE cm.clinic_id = clinic_id
        AND cm.user_id = auth.uid()
        AND cm.role = 'studierektor'
    )
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'superadmin')
  );

-- Studierektor kan ta bort tilldelningar
CREATE POLICY "Studierektor can delete assignments"
  ON supervisor_assignments FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM clinic_memberships cm
      WHERE cm.clinic_id = clinic_id
        AND cm.user_id = auth.uid()
        AND cm.role = 'studierektor'
    )
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'superadmin')
  );

-- 7) Funktion för att automatiskt sätta default-roll vid signup
CREATE OR REPLACE FUNCTION set_default_role()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- Om ingen roll är satt, sätt st_lakare som default
  IF NEW.role IS NULL THEN
    NEW.role := 'st_lakare';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_default_role_trigger ON profiles;
CREATE TRIGGER set_default_role_trigger
  BEFORE INSERT ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION set_default_role();
