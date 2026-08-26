ALTER TABLE public.training_set_logs
ADD COLUMN IF NOT EXISTS training_date date;

COMMENT ON COLUMN public.training_set_logs.training_date IS
  'Local training day used to make set logging idempotent per client, exercise and set number.';

CREATE UNIQUE INDEX IF NOT EXISTS training_set_logs_client_exercise_training_date_set_unique
ON public.training_set_logs (client_id, exercise_id, training_date, set_number);