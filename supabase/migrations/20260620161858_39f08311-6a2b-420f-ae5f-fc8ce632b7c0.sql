
-- upgrade_events: Tracking für Klicks und Conversions zwischen Tarifen
CREATE TABLE public.upgrade_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  from_tier TEXT,
  to_tier TEXT NOT NULL,
  event TEXT NOT NULL CHECK (event IN ('click','started','completed')),
  source TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX upgrade_events_user_idx ON public.upgrade_events(user_id);
CREATE INDEX upgrade_events_created_idx ON public.upgrade_events(created_at);
CREATE INDEX upgrade_events_to_tier_idx ON public.upgrade_events(to_tier);

GRANT SELECT, INSERT ON public.upgrade_events TO authenticated;
GRANT ALL ON public.upgrade_events TO service_role;

ALTER TABLE public.upgrade_events ENABLE ROW LEVEL SECURITY;

-- Nutzer dürfen eigene Events anlegen
CREATE POLICY "Users insert own upgrade events"
  ON public.upgrade_events FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Nutzer sehen eigene Events
CREATE POLICY "Users read own upgrade events"
  ON public.upgrade_events FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Coaches sehen alles
CREATE POLICY "Coaches read all upgrade events"
  ON public.upgrade_events FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'coach'));
