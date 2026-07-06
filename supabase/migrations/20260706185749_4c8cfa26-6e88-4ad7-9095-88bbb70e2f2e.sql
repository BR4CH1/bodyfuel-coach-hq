
ALTER TABLE public.performance_test_sessions
  ADD COLUMN IF NOT EXISTS test_day text CHECK (test_day IS NULL OR test_day IN ('field','strength','full')),
  ADD COLUMN IF NOT EXISTS entry_mode text DEFAULT 'by_test' CHECK (entry_mode IN ('by_test','by_athlete')),
  ADD COLUMN IF NOT EXISTS location text,
  ADD COLUMN IF NOT EXISTS measurement_method_default text,
  ADD COLUMN IF NOT EXISTS completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS completion_notes text,
  ADD COLUMN IF NOT EXISTS mode text DEFAULT 'test' CHECK (mode IN ('test','production'));
