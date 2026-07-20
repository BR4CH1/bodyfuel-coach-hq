
CREATE TABLE public.smart_autopilot_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','running','done','failed')),
  step text NOT NULL DEFAULT 'nutrition' CHECK (step IN ('nutrition','training','done')),
  nutrition_plan_id uuid,
  training_plan_id uuid,
  error text,
  attempts int NOT NULL DEFAULT 0,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX smart_autopilot_jobs_user_idx ON public.smart_autopilot_jobs(user_id, created_at DESC);
CREATE INDEX smart_autopilot_jobs_pending_idx ON public.smart_autopilot_jobs(status, created_at) WHERE status IN ('pending','running');

GRANT SELECT ON public.smart_autopilot_jobs TO authenticated;
GRANT ALL ON public.smart_autopilot_jobs TO service_role;

ALTER TABLE public.smart_autopilot_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own autopilot jobs"
  ON public.smart_autopilot_jobs FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.touch_smart_autopilot_jobs() RETURNS trigger AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER trg_touch_smart_autopilot_jobs
BEFORE UPDATE ON public.smart_autopilot_jobs
FOR EACH ROW EXECUTE FUNCTION public.touch_smart_autopilot_jobs();
