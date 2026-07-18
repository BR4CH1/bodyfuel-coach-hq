
CREATE TABLE public.fuely_action_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id uuid,
  action_type text NOT NULL,
  target_table text,
  target_id text,
  old_value jsonb,
  new_value jsonb,
  status text NOT NULL DEFAULT 'done',
  source text NOT NULL DEFAULT 'fuely',
  undo_until timestamptz,
  undone_at timestamptz,
  summary text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX fuely_action_log_user_created_idx
  ON public.fuely_action_log (user_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE ON public.fuely_action_log TO authenticated;
GRANT ALL ON public.fuely_action_log TO service_role;

ALTER TABLE public.fuely_action_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own fuely actions read"
  ON public.fuely_action_log FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "own fuely actions insert"
  ON public.fuely_action_log FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "own fuely actions update"
  ON public.fuely_action_log FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
