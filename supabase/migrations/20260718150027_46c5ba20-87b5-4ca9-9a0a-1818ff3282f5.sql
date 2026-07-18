
CREATE TABLE public.fuely_daily_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  note_date date NOT NULL DEFAULT (now() AT TIME ZONE 'UTC')::date,
  kind text NOT NULL CHECK (kind IN ('morning', 'evening')),
  content text NOT NULL,
  data_snapshot jsonb,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, note_date, kind)
);

CREATE INDEX fuely_daily_notes_user_date_idx
  ON public.fuely_daily_notes (user_id, note_date DESC);

GRANT SELECT, INSERT, UPDATE ON public.fuely_daily_notes TO authenticated;
GRANT ALL ON public.fuely_daily_notes TO service_role;

ALTER TABLE public.fuely_daily_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own daily notes read"
  ON public.fuely_daily_notes FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "own daily notes insert"
  ON public.fuely_daily_notes FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "own daily notes update"
  ON public.fuely_daily_notes FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
