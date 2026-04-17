-- clinic_activity_templates
-- Studierektor hanterar vilka placeringar/kurser/aktiviteter ST-läkare kan välja i PusslaDinST
CREATE TABLE IF NOT EXISTS clinic_activity_templates (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id     UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  type          TEXT NOT NULL CHECK (type IN ('placering', 'kurs', 'annan')),
  title         TEXT NOT NULL,
  description   TEXT NOT NULL DEFAULT '',
  suggested_milestones JSONB NOT NULL DEFAULT '[]',
  suggested_rows       JSONB NOT NULL DEFAULT '[]',
  is_metis      BOOLEAN NOT NULL DEFAULT FALSE,
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS clinic_activity_templates_clinic_id_idx
  ON clinic_activity_templates (clinic_id);

ALTER TABLE clinic_activity_templates ENABLE ROW LEVEL SECURITY;

-- Studierektor: full access för sin klinik
CREATE POLICY "studierektor_full_access" ON clinic_activity_templates
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM clinic_memberships cm
      WHERE cm.clinic_id = clinic_activity_templates.clinic_id
        AND cm.user_id   = auth.uid()
        AND cm.role      = 'studierektor'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM clinic_memberships cm
      WHERE cm.clinic_id = clinic_activity_templates.clinic_id
        AND cm.user_id   = auth.uid()
        AND cm.role      = 'studierektor'
    )
  );

-- Klinikmedlemmar (ST-läkare, huvudhandledare): kan läsa
CREATE POLICY "members_read" ON clinic_activity_templates
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM clinic_memberships cm
      WHERE cm.clinic_id = clinic_activity_templates.clinic_id
        AND cm.user_id   = auth.uid()
    )
  );

-- Uppdatera updated_at automatiskt
CREATE OR REPLACE FUNCTION update_clinic_activity_templates_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON clinic_activity_templates
  FOR EACH ROW EXECUTE FUNCTION update_clinic_activity_templates_updated_at();
