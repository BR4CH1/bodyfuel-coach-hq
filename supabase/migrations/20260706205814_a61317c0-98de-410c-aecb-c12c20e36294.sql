ALTER TABLE public.staff_assignments
  ADD COLUMN IF NOT EXISTS function_label text,
  ADD COLUMN IF NOT EXISTS onboarding_completed_at timestamptz;