-- Achievements-tabell för ST-ARK
-- Kör detta i Supabase SQL Editor

CREATE TABLE IF NOT EXISTS achievements (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  placement_id TEXT,
  course_id TEXT,
  milestone_id TEXT NOT NULL,
  goal_id TEXT,
  code TEXT,
  milestone TEXT,
  date TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Index för snabb filtrering
CREATE INDEX IF NOT EXISTS idx_achievements_user_id ON achievements(user_id);
CREATE INDEX IF NOT EXISTS idx_achievements_milestone_id ON achievements(milestone_id);
CREATE INDEX IF NOT EXISTS idx_achievements_placement_id ON achievements(placement_id);
CREATE INDEX IF NOT EXISTS idx_achievements_course_id ON achievements(course_id);

-- Row Level Security
ALTER TABLE achievements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own achievements"
  ON achievements FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own achievements"
  ON achievements FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own achievements"
  ON achievements FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own achievements"
  ON achievements FOR DELETE
  USING (auth.uid() = user_id);
