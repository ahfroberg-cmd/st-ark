-- Kör om sjukhus-tabellen redan finns men superadmin inte ser rader (RLS OK men saknar tabellrättigheter).
GRANT SELECT ON TABLE public.hospitals TO authenticated;
GRANT INSERT, UPDATE, DELETE ON TABLE public.hospitals TO authenticated;
