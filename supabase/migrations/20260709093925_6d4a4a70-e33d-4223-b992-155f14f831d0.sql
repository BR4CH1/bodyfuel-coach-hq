ALTER TABLE public.training_progression_events
  ADD COLUMN IF NOT EXISTS readiness_gate TEXT,
  ADD COLUMN IF NOT EXISTS readiness_gate_reason TEXT;

CREATE INDEX IF NOT EXISTS idx_progression_events_gate
  ON public.training_progression_events (client_id, evaluated_at DESC)
  WHERE readiness_gate IS NOT NULL;