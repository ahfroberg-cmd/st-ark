-- =============================================================
-- ST-ARK: Performance indexes for common filters/sorts
-- Safe to run multiple times (IF NOT EXISTS).
-- =============================================================

-- placements: frequent filter by user_id + sort by start_date
CREATE INDEX IF NOT EXISTS idx_placements_user_id ON public.placements(user_id);
CREATE INDEX IF NOT EXISTS idx_placements_user_start_date ON public.placements(user_id, start_date);

-- courses: frequent filter by user_id + sort by start/certificate date
CREATE INDEX IF NOT EXISTS idx_courses_user_id ON public.courses(user_id);
CREATE INDEX IF NOT EXISTS idx_courses_user_start_date ON public.courses(user_id, start_date);
CREATE INDEX IF NOT EXISTS idx_courses_user_certificate_date ON public.courses(user_id, certificate_date);

-- timeline_versions: latest version per user
CREATE INDEX IF NOT EXISTS idx_timeline_versions_user_created_desc
  ON public.timeline_versions(user_id, created_at DESC);

-- RLS-heavy relation lookups
CREATE INDEX IF NOT EXISTS idx_clinic_memberships_user_clinic_role
  ON public.clinic_memberships(user_id, clinic_id, role);
CREATE INDEX IF NOT EXISTS idx_clinic_memberships_clinic_user_role
  ON public.clinic_memberships(clinic_id, user_id, role);

CREATE INDEX IF NOT EXISTS idx_supervisor_assignments_supervisor_st
  ON public.supervisor_assignments(supervisor_id, st_lakare_id);
CREATE INDEX IF NOT EXISTS idx_supervisor_assignments_st
  ON public.supervisor_assignments(st_lakare_id);
