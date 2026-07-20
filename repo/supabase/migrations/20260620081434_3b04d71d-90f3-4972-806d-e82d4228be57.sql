
CREATE TABLE public.coach_alert_resolutions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  alert_key text NOT NULL,
  alert_user_id uuid NOT NULL,
  alert_kind text NOT NULL,
  alert_severity text NOT NULL,
  alert_title text NOT NULL,
  alert_detail text,
  alert_range text,
  client_name text,
  action text NOT NULL CHECK (action IN ('done','ignored')),
  resolved_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (coach_user_id, alert_key)
);

CREATE INDEX idx_coach_alert_resolutions_coach_recent
  ON public.coach_alert_resolutions (coach_user_id, resolved_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.coach_alert_resolutions TO authenticated;
GRANT ALL ON public.coach_alert_resolutions TO service_role;

ALTER TABLE public.coach_alert_resolutions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Coaches manage their own alert resolutions"
ON public.coach_alert_resolutions
FOR ALL
TO authenticated
USING (auth.uid() = coach_user_id AND public.has_role(auth.uid(), 'coach'))
WITH CHECK (auth.uid() = coach_user_id AND public.has_role(auth.uid(), 'coach'));
