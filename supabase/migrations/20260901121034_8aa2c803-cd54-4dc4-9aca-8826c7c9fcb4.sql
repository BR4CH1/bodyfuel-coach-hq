CREATE TABLE public.continental_challenge_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name text NOT NULL,
  last_name text NOT NULL,
  email text NOT NULL,
  phone text NOT NULL,
  age integer,
  goal_type text,
  goal_text text NOT NULL,
  motivation text NOT NULL,
  privacy_consent boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'pending',
  reviewed_at timestamptz,
  reviewed_by uuid,
  internal_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT continental_applications_status_check CHECK (status IN ('pending','approved','rejected')),
  CONSTRAINT continental_applications_first_name_len CHECK (char_length(first_name) BETWEEN 1 AND 80),
  CONSTRAINT continental_applications_last_name_len CHECK (char_length(last_name) BETWEEN 1 AND 80),
  CONSTRAINT continental_applications_email_len CHECK (char_length(email) BETWEEN 5 AND 200),
  CONSTRAINT continental_applications_phone_len CHECK (char_length(phone) BETWEEN 4 AND 40),
  CONSTRAINT continental_applications_age_range CHECK (age IS NULL OR (age BETWEEN 14 AND 99)),
  CONSTRAINT continental_applications_goal_type_check CHECK (
    goal_type IS NULL OR goal_type IN ('abnehmen','muskeln_aufbauen','fitter_werden','gewohnheiten','sonstiges')
  ),
  CONSTRAINT continental_applications_goal_text_len CHECK (char_length(goal_text) BETWEEN 5 AND 2000),
  CONSTRAINT continental_applications_motivation_len CHECK (char_length(motivation) BETWEEN 5 AND 2000),
  CONSTRAINT continental_applications_consent_check CHECK (privacy_consent = true),
  CONSTRAINT continental_applications_notes_len CHECK (internal_notes IS NULL OR char_length(internal_notes) <= 4000)
);

GRANT SELECT, UPDATE ON public.continental_challenge_applications TO authenticated;
GRANT ALL ON public.continental_challenge_applications TO service_role;

ALTER TABLE public.continental_challenge_applications ENABLE ROW LEVEL SECURITY;

-- Nur Coaches (Plattform) dürfen Bewerbungen lesen und bearbeiten.
CREATE POLICY "Coaches can view challenge applications"
  ON public.continental_challenge_applications
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'coach'));

CREATE POLICY "Coaches can update challenge applications"
  ON public.continental_challenge_applications
  FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'coach'))
  WITH CHECK (public.has_role(auth.uid(), 'coach'));

-- Keine INSERT-Policy für anon/authenticated: das Absenden läuft ausschließlich
-- über die Server-Funktion (service_role) mit eigener Validierung.

-- Doppelte aktive Bewerbung (pending/approved) pro normalisierter E-Mail verhindern.
CREATE UNIQUE INDEX continental_applications_active_email_uniq
  ON public.continental_challenge_applications (lower(btrim(email)))
  WHERE status IN ('pending','approved');

CREATE INDEX continental_applications_status_idx
  ON public.continental_challenge_applications (status, created_at DESC);

CREATE OR REPLACE FUNCTION public.continental_applications_touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER continental_applications_touch_updated_at
  BEFORE UPDATE ON public.continental_challenge_applications
  FOR EACH ROW
  EXECUTE FUNCTION public.continental_applications_touch_updated_at();