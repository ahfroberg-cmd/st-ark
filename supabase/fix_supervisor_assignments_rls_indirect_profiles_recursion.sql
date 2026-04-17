-- Root-cause fix for indirect RLS recursion:
-- profiles policy -> supervisor_assignments policy -> profiles query
-- which causes 42P17 / HTTP 500 on profiles reads.
--
-- Run in Supabase SQL Editor.
-- Safe to run multiple times.

ALTER TABLE public.supervisor_assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Supervisors can view own assignments" ON public.supervisor_assignments;
CREATE POLICY "Supervisors can view own assignments"
  ON public.supervisor_assignments
  FOR SELECT
  USING (
    supervisor_id = auth.uid()
    OR st_lakare_id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM public.clinic_memberships cm
      WHERE cm.clinic_id = supervisor_assignments.clinic_id
        AND cm.user_id = auth.uid()
        AND cm.role = 'studierektor'
    )
  );

DROP POLICY IF EXISTS "Studierektor can create assignments" ON public.supervisor_assignments;
CREATE POLICY "Studierektor can create assignments"
  ON public.supervisor_assignments
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.clinic_memberships cm
      WHERE cm.clinic_id = supervisor_assignments.clinic_id
        AND cm.user_id = auth.uid()
        AND cm.role = 'studierektor'
    )
  );

DROP POLICY IF EXISTS "Studierektor can delete assignments" ON public.supervisor_assignments;
CREATE POLICY "Studierektor can delete assignments"
  ON public.supervisor_assignments
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1
      FROM public.clinic_memberships cm
      WHERE cm.clinic_id = supervisor_assignments.clinic_id
        AND cm.user_id = auth.uid()
        AND cm.role = 'studierektor'
    )
  );

