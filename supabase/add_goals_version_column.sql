-- Lägg till goals_version-kolumn om den saknas (för att undvika 400-fel i SR-dashboard)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS goals_version TEXT DEFAULT 'st_2021';
