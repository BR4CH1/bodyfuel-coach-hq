ALTER TABLE public.body_measurements
  ADD COLUMN IF NOT EXISTS thigh_left_cm numeric,
  ADD COLUMN IF NOT EXISTS thigh_right_cm numeric,
  ADD COLUMN IF NOT EXISTS biceps_left_cm numeric,
  ADD COLUMN IF NOT EXISTS biceps_right_cm numeric;

ALTER TABLE public.weekly_checkins
  ADD COLUMN IF NOT EXISTS thigh_left_cm numeric,
  ADD COLUMN IF NOT EXISTS thigh_right_cm numeric,
  ADD COLUMN IF NOT EXISTS biceps_left_cm numeric,
  ADD COLUMN IF NOT EXISTS biceps_right_cm numeric;