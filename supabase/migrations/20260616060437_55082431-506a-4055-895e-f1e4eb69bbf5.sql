CREATE TABLE public.training_exercise_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exercise_id uuid NOT NULL REFERENCES public.training_exercises(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  note_date date NOT NULL DEFAULT (now() AT TIME ZONE 'utc')::date,
  note text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (exercise_id, client_id, note_date)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.training_exercise_notes TO authenticated;
GRANT ALL ON public.training_exercise_notes TO service_role;
ALTER TABLE public.training_exercise_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ten read own or coach" ON public.training_exercise_notes FOR SELECT TO authenticated
  USING (client_id = auth.uid() OR has_role(auth.uid(), 'coach'::app_role));
CREATE POLICY "ten insert own or coach" ON public.training_exercise_notes FOR INSERT TO authenticated
  WITH CHECK (client_id = auth.uid() OR has_role(auth.uid(), 'coach'::app_role));
CREATE POLICY "ten update own or coach" ON public.training_exercise_notes FOR UPDATE TO authenticated
  USING (client_id = auth.uid() OR has_role(auth.uid(), 'coach'::app_role))
  WITH CHECK (client_id = auth.uid() OR has_role(auth.uid(), 'coach'::app_role));
CREATE POLICY "ten delete own or coach" ON public.training_exercise_notes FOR DELETE TO authenticated
  USING (client_id = auth.uid() OR has_role(auth.uid(), 'coach'::app_role));
CREATE TRIGGER training_exercise_notes_updated_at BEFORE UPDATE ON public.training_exercise_notes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();