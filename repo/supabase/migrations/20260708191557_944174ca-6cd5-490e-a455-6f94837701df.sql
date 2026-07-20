
-- Audit table for smart progression decisions per exercise
CREATE TABLE public.training_progression_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL,
  source_exercise_id UUID NOT NULL,
  source_day_id UUID,
  source_session_date DATE NOT NULL,
  applied_to_exercise_id UUID,
  decision TEXT NOT NULL,
  previous_load NUMERIC,
  next_load NUMERIC,
  previous_target_weights TEXT,
  next_target_weights TEXT,
  previous_target_reps TEXT,
  next_target_reps TEXT,
  reason TEXT NOT NULL,
  evaluated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.training_progression_events TO authenticated;
GRANT ALL ON public.training_progression_events TO service_role;

ALTER TABLE public.training_progression_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Client reads own progression events"
  ON public.training_progression_events FOR SELECT
  TO authenticated
  USING (auth.uid() = client_id);

CREATE POLICY "Client inserts own progression events"
  ON public.training_progression_events FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = client_id);

CREATE POLICY "Coaches can read athlete progression events"
  ON public.training_progression_events FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'coach'));

CREATE INDEX idx_progression_events_client ON public.training_progression_events (client_id, source_session_date DESC);
CREATE INDEX idx_progression_events_source_ex ON public.training_progression_events (source_exercise_id);

-- Marks a planned training day as completed on a given date
CREATE TABLE public.training_day_completions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL,
  day_id UUID NOT NULL,
  completion_date DATE NOT NULL,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  exercises_evaluated INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (client_id, day_id, completion_date)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.training_day_completions TO authenticated;
GRANT ALL ON public.training_day_completions TO service_role;

ALTER TABLE public.training_day_completions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Client manages own completions"
  ON public.training_day_completions FOR ALL
  TO authenticated
  USING (auth.uid() = client_id)
  WITH CHECK (auth.uid() = client_id);

CREATE POLICY "Coaches read athlete completions"
  ON public.training_day_completions FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'coach'));

-- Optional per-set RPE for smarter progression decisions
ALTER TABLE public.training_set_logs
  ADD COLUMN IF NOT EXISTS rpe NUMERIC;
