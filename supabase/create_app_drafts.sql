-- Skapa app_drafts-tabell för att spara utkast (ansökningar, BT-intyg, etc.)
CREATE TABLE IF NOT EXISTS public.app_drafts (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  draft_key TEXT NOT NULL,
  draft_data JSONB DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (user_id, draft_key)
);

-- RLS
ALTER TABLE public.app_drafts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own app_drafts"
  ON public.app_drafts FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own app_drafts"
  ON public.app_drafts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own app_drafts"
  ON public.app_drafts FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own app_drafts"
  ON public.app_drafts FOR DELETE
  USING (auth.uid() = user_id);
