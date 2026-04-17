-- Tabell för sparade timeline-versioner
CREATE TABLE IF NOT EXISTS timeline_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  version_name TEXT NOT NULL,
  version_data JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Index för snabbare queries
CREATE INDEX IF NOT EXISTS idx_timeline_versions_user_id ON timeline_versions(user_id);
CREATE INDEX IF NOT EXISTS idx_timeline_versions_created_at ON timeline_versions(created_at DESC);

-- RLS policies
ALTER TABLE timeline_versions ENABLE ROW LEVEL SECURITY;

-- Användare kan bara se sina egna versioner
CREATE POLICY "Users can view own timeline versions"
  ON timeline_versions FOR SELECT
  USING (auth.uid() = user_id);

-- Användare kan skapa sina egna versioner
CREATE POLICY "Users can insert own timeline versions"
  ON timeline_versions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Användare kan uppdatera sina egna versioner
CREATE POLICY "Users can update own timeline versions"
  ON timeline_versions FOR UPDATE
  USING (auth.uid() = user_id);

-- Användare kan radera sina egna versioner
CREATE POLICY "Users can delete own timeline versions"
  ON timeline_versions FOR DELETE
  USING (auth.uid() = user_id);
