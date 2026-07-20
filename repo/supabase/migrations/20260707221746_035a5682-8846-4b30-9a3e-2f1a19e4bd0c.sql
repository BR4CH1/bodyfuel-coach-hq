
CREATE POLICY "perf_plan_jobs_athlete_self_insert"
  ON public.performance_plan_jobs FOR INSERT
  TO authenticated
  WITH CHECK (
    athlete_user_id = auth.uid()
    AND team_id IS NULL
    AND public.is_org_member(auth.uid(), organization_id)
  );

CREATE POLICY "perf_plan_jobs_athlete_self_read"
  ON public.performance_plan_jobs FOR SELECT
  TO authenticated
  USING (
    athlete_user_id = auth.uid()
  );
