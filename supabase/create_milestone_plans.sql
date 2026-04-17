-- Skapa milestone_plans-tabell för att spara delmålsplaner
CREATE TABLE IF NOT EXISTS public.milestone_plans (
  id TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  milestone_id TEXT NOT NULL,
  plan_text TEXT DEFAULT '',
  updated_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (user_id, milestone_id)
);

-- RLS
ALTER TABLE public.milestone_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own milestone_plans"
  ON public.milestone_plans FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own milestone_plans"
  ON public.milestone_plans FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own milestone_plans"
  ON public.milestone_plans FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own milestone_plans"
  ON public.milestone_plans FOR DELETE
  USING (auth.uid() = user_id);
