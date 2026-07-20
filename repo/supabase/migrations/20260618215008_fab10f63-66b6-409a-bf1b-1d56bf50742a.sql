CREATE TABLE public.coach_task_state (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  coach_id UUID NOT NULL,
  task_key TEXT NOT NULL,
  completed_at TIMESTAMPTZ,
  snoozed_until TIMESTAMPTZ,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (coach_id, task_key)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.coach_task_state TO authenticated;
GRANT ALL ON public.coach_task_state TO service_role;

ALTER TABLE public.coach_task_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Coach manages own task state select"
  ON public.coach_task_state FOR SELECT
  TO authenticated
  USING (auth.uid() = coach_id AND public.has_role(auth.uid(), 'coach'));

CREATE POLICY "Coach manages own task state insert"
  ON public.coach_task_state FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = coach_id AND public.has_role(auth.uid(), 'coach'));

CREATE POLICY "Coach manages own task state update"
  ON public.coach_task_state FOR UPDATE
  TO authenticated
  USING (auth.uid() = coach_id AND public.has_role(auth.uid(), 'coach'))
  WITH CHECK (auth.uid() = coach_id AND public.has_role(auth.uid(), 'coach'));

CREATE POLICY "Coach manages own task state delete"
  ON public.coach_task_state FOR DELETE
  TO authenticated
  USING (auth.uid() = coach_id AND public.has_role(auth.uid(), 'coach'));

CREATE TRIGGER update_coach_task_state_updated_at
  BEFORE UPDATE ON public.coach_task_state
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_coach_task_state_coach ON public.coach_task_state(coach_id, task_key);