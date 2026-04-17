-- Skapa iup_settings-tabell för att spara IUP-data (handledarsamtal, bedömningar, etc.)
CREATE TABLE IF NOT EXISTS public.iup_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  meetings JSONB DEFAULT '[]'::jsonb,
  assessments JSONB DEFAULT '[]'::jsonb,
  director_meetings JSONB DEFAULT '[]'::jsonb,
  specialist_collegiums JSONB DEFAULT '[]'::jsonb,
  planning JSONB DEFAULT '{}'::jsonb,
  planning_extra JSONB DEFAULT '[]'::jsonb,
  instruments JSONB DEFAULT '[]'::jsonb,
  planning_hidden JSONB DEFAULT '[]'::jsonb,
  show_meetings_on_timeline BOOLEAN DEFAULT true,
  show_assessments_on_timeline BOOLEAN DEFAULT true,
  show_director_meetings_on_timeline BOOLEAN DEFAULT true,
  show_specialist_collegiums_on_timeline BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id)
);

-- RLS
ALTER TABLE public.iup_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own iup_settings"
  ON public.iup_settings FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own iup_settings"
  ON public.iup_settings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own iup_settings"
  ON public.iup_settings FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own iup_settings"
  ON public.iup_settings FOR DELETE
  USING (auth.uid() = user_id);
