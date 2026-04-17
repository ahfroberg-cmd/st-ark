-- Adds track_completions flag to clinic_activity_templates
-- Used for 'annan' (Utbildningsmoment) templates where SR wants to count
-- how many times each activity has been completed by each ST-läkare.
ALTER TABLE clinic_activity_templates
  ADD COLUMN IF NOT EXISTS track_completions BOOLEAN NOT NULL DEFAULT FALSE;
