-- Notifieringar när studierektor tar bort/byter namn på aktivitetsmall
CREATE TABLE IF NOT EXISTS activity_template_change_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  change_type TEXT NOT NULL CHECK (change_type IN ('deleted', 'renamed')),
  activity_type TEXT NOT NULL CHECK (activity_type IN ('placering', 'kurs', 'annan')),
  old_title TEXT NOT NULL,
  new_title TEXT,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  acknowledged BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS activity_template_change_notifications_user_idx
  ON activity_template_change_notifications (user_id, acknowledged, created_at DESC);

ALTER TABLE activity_template_change_notifications ENABLE ROW LEVEL SECURITY;

-- ST-läkare kan läsa och kvittera sina notifieringar
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE tablename = 'activity_template_change_notifications'
      AND policyname = 'Recipient can view template change notifications'
  ) THEN
    EXECUTE 'CREATE POLICY "Recipient can view template change notifications"
      ON activity_template_change_notifications
      FOR SELECT
      USING (user_id = auth.uid())';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE tablename = 'activity_template_change_notifications'
      AND policyname = 'Recipient can update template change notifications'
  ) THEN
    EXECUTE 'CREATE POLICY "Recipient can update template change notifications"
      ON activity_template_change_notifications
      FOR UPDATE
      USING (user_id = auth.uid())
      WITH CHECK (user_id = auth.uid())';
  END IF;
END $$;

-- Studierektor i samma klinik kan skapa notifieringar
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE tablename = 'activity_template_change_notifications'
      AND policyname = 'Studierektor can insert template change notifications'
  ) THEN
    EXECUTE 'CREATE POLICY "Studierektor can insert template change notifications"
      ON activity_template_change_notifications
      FOR INSERT
      WITH CHECK (
        EXISTS (
          SELECT 1
          FROM clinic_memberships cm
          WHERE cm.clinic_id = activity_template_change_notifications.clinic_id
            AND cm.user_id = auth.uid()
            AND cm.role = ''studierektor''
        )
      )';
  END IF;
END $$;

