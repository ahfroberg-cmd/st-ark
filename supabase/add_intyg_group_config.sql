-- JSON-konfiguration per intygsgrupp (titel, ev. vald handledare för intyg m.m.)
-- Samma objekt ska ligga på alla placeringar som delar samma intyg_group.

alter table public.placements
  add column if not exists intyg_group_config jsonb;

comment on column public.placements.intyg_group_config is
  'Valfri konfiguration för sammanslaget intyg: title, certSupervisor, certSpecialty, certSite';
