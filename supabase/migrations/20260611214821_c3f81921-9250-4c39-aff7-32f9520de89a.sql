CREATE TABLE public.daily_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  check_date date NOT NULL,
  tasks jsonb NOT NULL DEFAULT '{}'::jsonb,
  points integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, check_date)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.daily_checks TO authenticated;
GRANT ALL ON public.daily_checks TO service_role;

ALTER TABLE public.daily_checks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own daily checks"
  ON public.daily_checks FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Coaches can view all daily checks"
  ON public.daily_checks FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'coach'));

CREATE TRIGGER update_daily_checks_updated_at
  BEFORE UPDATE ON public.daily_checks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_daily_checks_user_date ON public.daily_checks(user_id, check_date DESC);