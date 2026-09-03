ALTER TABLE public.continental_challenge_applications
  ADD COLUMN IF NOT EXISTS birth_year integer,
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS activity_level text,
  ADD COLUMN IF NOT EXISTS blockers text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS blocker_other text,
  ADD COLUMN IF NOT EXISTS goal_other text,
  ADD COLUMN IF NOT EXISTS insurance_last_review text,
  ADD COLUMN IF NOT EXISTS insurance_topics text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS insurance_priorities text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS insurance_notes text,
  ADD COLUMN IF NOT EXISTS financial_contact_consent boolean NOT NULL DEFAULT false;

ALTER TABLE public.continental_challenge_applications
  ADD CONSTRAINT continental_birth_year_range
  CHECK (birth_year IS NULL OR (birth_year >= 1900 AND birth_year <= 2100)) NOT VALID;