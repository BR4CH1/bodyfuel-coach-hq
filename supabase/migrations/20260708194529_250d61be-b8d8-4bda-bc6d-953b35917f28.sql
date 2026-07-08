
CREATE TABLE IF NOT EXISTS public.athlete_exercise_state (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  exercise_key text NOT NULL,
  exercise_name text NOT NULL,
  current_working_load numeric,
  recommended_next_load numeric,
  target_rep_min int,
  target_rep_max int,
  progression_status text NOT NULL DEFAULT 'new'
    CHECK (progression_status IN ('new','progressing','holding','deloading','stalled')),
  confidence text NOT NULL DEFAULT 'low'
    CHECK (confidence IN ('low','medium','high')),
  successful_sessions int NOT NULL DEFAULT 0,
  failed_sessions int NOT NULL DEFAULT 0,
  trend text NOT NULL DEFAULT 'flat' CHECK (trend IN ('up','flat','down')),
  last_completed_at timestamptz,
  last_decision text,
  last_reason text,
  pain_flag boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, exercise_key)
);

CREATE INDEX IF NOT EXISTS idx_aes_user ON public.athlete_exercise_state(user_id);
CREATE INDEX IF NOT EXISTS idx_aes_user_key ON public.athlete_exercise_state(user_id, exercise_key);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.athlete_exercise_state TO authenticated;
GRANT ALL ON public.athlete_exercise_state TO service_role;

ALTER TABLE public.athlete_exercise_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "aes_owner_all"
ON public.athlete_exercise_state
FOR ALL
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY "aes_coach_read"
ON public.athlete_exercise_state
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'coach'::app_role));

CREATE OR REPLACE FUNCTION public.aes_touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_aes_touch ON public.athlete_exercise_state;
CREATE TRIGGER trg_aes_touch
BEFORE UPDATE ON public.athlete_exercise_state
FOR EACH ROW EXECUTE FUNCTION public.aes_touch_updated_at();
