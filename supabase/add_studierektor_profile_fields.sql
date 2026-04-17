ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS secondary_email TEXT,
  ADD COLUMN IF NOT EXISTS other_information TEXT;
