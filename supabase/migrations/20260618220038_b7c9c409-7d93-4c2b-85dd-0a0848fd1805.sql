CREATE TABLE public.plan_adjustment_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL,
  coach_id uuid NOT NULL,
  kind text NOT NULL CHECK (kind IN ('nutrition','training')),
  area text,
  summary text NOT NULL,
  before_json jsonb,
  after_json jsonb,
  rationale text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_plan_adj_history_client ON public.plan_adjustment_history(client_id, created_at DESC);
CREATE INDEX idx_plan_adj_history_coach ON public.plan_adjustment_history(coach_id, created_at DESC);

GRANT SELECT, INSERT ON public.plan_adjustment_history TO authenticated;
GRANT ALL ON public.plan_adjustment_history TO service_role;

ALTER TABLE public.plan_adjustment_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Coaches insert their own adjustments"
ON public.plan_adjustment_history FOR INSERT TO authenticated
WITH CHECK (auth.uid() = coach_id AND public.has_role(auth.uid(), 'coach'));

CREATE POLICY "Coaches read adjustments they made"
ON public.plan_adjustment_history FOR SELECT TO authenticated
USING (auth.uid() = coach_id AND public.has_role(auth.uid(), 'coach'));

CREATE POLICY "Clients read their own adjustments"
ON public.plan_adjustment_history FOR SELECT TO authenticated
USING (auth.uid() = client_id);