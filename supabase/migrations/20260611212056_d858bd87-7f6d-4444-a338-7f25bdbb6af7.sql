
CREATE TABLE public.training_days (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL REFERENCES public.nutrition_plans(id) ON DELETE CASCADE,
  name text NOT NULL,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX training_days_plan_idx ON public.training_days(plan_id, sort_order);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.training_days TO authenticated;
GRANT ALL ON public.training_days TO service_role;
ALTER TABLE public.training_days ENABLE ROW LEVEL SECURITY;
CREATE POLICY "day read" ON public.training_days FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.nutrition_plans p WHERE p.id = plan_id AND (p.client_id = auth.uid() OR has_role(auth.uid(),'coach'))));
CREATE POLICY "day coach write" ON public.training_days FOR ALL TO authenticated
  USING (has_role(auth.uid(),'coach')) WITH CHECK (has_role(auth.uid(),'coach'));

CREATE TABLE public.training_exercises (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  day_id uuid NOT NULL REFERENCES public.training_days(id) ON DELETE CASCADE,
  name text NOT NULL,
  target_sets int,
  target_reps text,
  notes text,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX training_exercises_day_idx ON public.training_exercises(day_id, sort_order);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.training_exercises TO authenticated;
GRANT ALL ON public.training_exercises TO service_role;
ALTER TABLE public.training_exercises ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ex read" ON public.training_exercises FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.training_days d JOIN public.nutrition_plans p ON p.id = d.plan_id
    WHERE d.id = day_id AND (p.client_id = auth.uid() OR has_role(auth.uid(),'coach'))
  ));
CREATE POLICY "ex coach write" ON public.training_exercises FOR ALL TO authenticated
  USING (has_role(auth.uid(),'coach')) WITH CHECK (has_role(auth.uid(),'coach'));

CREATE TABLE public.training_set_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exercise_id uuid NOT NULL REFERENCES public.training_exercises(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  set_number int NOT NULL,
  weight_kg numeric(6,2),
  reps int,
  performed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX training_set_logs_ex_idx ON public.training_set_logs(exercise_id, client_id, performed_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.training_set_logs TO authenticated;
GRANT ALL ON public.training_set_logs TO service_role;
ALTER TABLE public.training_set_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "log read own or coach" ON public.training_set_logs FOR SELECT TO authenticated
  USING (client_id = auth.uid() OR has_role(auth.uid(),'coach'));
CREATE POLICY "log insert own" ON public.training_set_logs FOR INSERT TO authenticated
  WITH CHECK (client_id = auth.uid() OR has_role(auth.uid(),'coach'));
CREATE POLICY "log update own or coach" ON public.training_set_logs FOR UPDATE TO authenticated
  USING (client_id = auth.uid() OR has_role(auth.uid(),'coach'))
  WITH CHECK (client_id = auth.uid() OR has_role(auth.uid(),'coach'));
CREATE POLICY "log delete own or coach" ON public.training_set_logs FOR DELETE TO authenticated
  USING (client_id = auth.uid() OR has_role(auth.uid(),'coach'));
