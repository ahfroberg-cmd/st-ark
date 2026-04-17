-- Tabell för meddelanden från studierektor till ST-läkare
CREATE TABLE IF NOT EXISTS sr_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID NOT NULL REFERENCES auth.users(id),
  recipient_id UUID NOT NULL REFERENCES auth.users(id),
  clinic_id UUID NOT NULL,
  message_text TEXT NOT NULL,
  channel TEXT NOT NULL DEFAULT 'st_ark' CHECK (channel IN ('st_ark', 'email')),
  read BOOLEAN NOT NULL DEFAULT false,
  dismissed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE sr_messages ENABLE ROW LEVEL SECURITY;

-- Studierektor kan skapa och läsa meddelanden de skickat
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Studierektor can insert sr_messages' AND tablename = 'sr_messages'
  ) THEN
    EXECUTE 'CREATE POLICY "Studierektor can insert sr_messages" ON sr_messages FOR INSERT WITH CHECK (sender_id = auth.uid())';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Studierektor can view own sent sr_messages' AND tablename = 'sr_messages'
  ) THEN
    EXECUTE 'CREATE POLICY "Studierektor can view own sent sr_messages" ON sr_messages FOR SELECT USING (sender_id = auth.uid())';
  END IF;
END $$;

-- ST-läkare kan läsa och uppdatera (markera läst/dismissed) meddelanden riktade till dem
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Recipient can view sr_messages' AND tablename = 'sr_messages'
  ) THEN
    EXECUTE 'CREATE POLICY "Recipient can view sr_messages" ON sr_messages FOR SELECT USING (recipient_id = auth.uid())';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Recipient can update sr_messages' AND tablename = 'sr_messages'
  ) THEN
    EXECUTE 'CREATE POLICY "Recipient can update sr_messages" ON sr_messages FOR UPDATE USING (recipient_id = auth.uid()) WITH CHECK (recipient_id = auth.uid())';
  END IF;
END $$;


-- Tabell för aktivitetsförslag från studierektor till ST-läkare
CREATE TABLE IF NOT EXISTS sr_activity_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID NOT NULL REFERENCES auth.users(id),
  recipient_id UUID NOT NULL REFERENCES auth.users(id),
  clinic_id UUID NOT NULL,
  activity_type TEXT NOT NULL CHECK (activity_type IN ('placement', 'leave', 'course', 'sr_meeting')),
  activity_data JSONB NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'dismissed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  responded_at TIMESTAMPTZ
);

ALTER TABLE sr_activity_suggestions ENABLE ROW LEVEL SECURITY;

-- Studierektor kan skapa och läsa förslag de skickat
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Studierektor can insert sr_activity_suggestions' AND tablename = 'sr_activity_suggestions'
  ) THEN
    EXECUTE 'CREATE POLICY "Studierektor can insert sr_activity_suggestions" ON sr_activity_suggestions FOR INSERT WITH CHECK (sender_id = auth.uid())';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Studierektor can view own sent sr_activity_suggestions' AND tablename = 'sr_activity_suggestions'
  ) THEN
    EXECUTE 'CREATE POLICY "Studierektor can view own sent sr_activity_suggestions" ON sr_activity_suggestions FOR SELECT USING (sender_id = auth.uid())';
  END IF;
END $$;

-- ST-läkare kan läsa och uppdatera (acceptera/avfärda) förslag riktade till dem
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Recipient can view sr_activity_suggestions' AND tablename = 'sr_activity_suggestions'
  ) THEN
    EXECUTE 'CREATE POLICY "Recipient can view sr_activity_suggestions" ON sr_activity_suggestions FOR SELECT USING (recipient_id = auth.uid())';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Recipient can update sr_activity_suggestions' AND tablename = 'sr_activity_suggestions'
  ) THEN
    EXECUTE 'CREATE POLICY "Recipient can update sr_activity_suggestions" ON sr_activity_suggestions FOR UPDATE USING (recipient_id = auth.uid()) WITH CHECK (recipient_id = auth.uid())';
  END IF;
END $$;
