CREATE TABLE public.fuely_timeline_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type text NOT NULL CHECK (event_type IN ('morning_briefing','evening_review','action','milestone','memory')),
  category text,
  icon text,
  title text NOT NULL,
  summary text,
  cta_label text,
  cta_href text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  coach_visible boolean NOT NULL DEFAULT false,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX fuely_timeline_events_user_time_idx ON public.fuely_timeline_events (user_id, occurred_at DESC);
CREATE INDEX fuely_timeline_events_coach_idx ON public.fuely_timeline_events (user_id, coach_visible, occurred_at DESC) WHERE coach_visible = true;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.fuely_timeline_events TO authenticated;
GRANT ALL ON public.fuely_timeline_events TO service_role;

ALTER TABLE public.fuely_timeline_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own timeline events"
  ON public.fuely_timeline_events
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Coaches view shared timeline events of their athletes"
  ON public.fuely_timeline_events
  FOR SELECT TO authenticated
  USING (
    coach_visible = true
    AND public.coach_can_access_user(auth.uid(), user_id)
  );