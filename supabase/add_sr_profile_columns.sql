-- Lägg till kolumner för studierektorsprofil
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS sr_specialty TEXT DEFAULT '';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS sr_for_specialty TEXT DEFAULT '';
