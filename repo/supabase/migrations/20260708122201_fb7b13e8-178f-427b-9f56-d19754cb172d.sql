
CREATE UNIQUE INDEX IF NOT EXISTS organization_tasks_upsert_key
  ON public.organization_tasks (organization_id, user_id, task_type, source_type, source_id, scheduled_date)
  NULLS NOT DISTINCT;
