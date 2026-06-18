CREATE TABLE public.ai_checkin_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL,
  coach_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','edited','rejected')),
  draft jsonb NOT NULL,
  message_final text,
  generated_at timestamptz NOT NULL DEFAULT now(),
  decided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_ai_checkin_drafts_client ON public.ai_checkin_drafts(client_id, generated_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_checkin_drafts TO authenticated;
GRANT ALL ON public.ai_checkin_drafts TO service_role;

ALTER TABLE public.ai_checkin_drafts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Coaches can read drafts"
  ON public.ai_checkin_drafts FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'coach'));

CREATE POLICY "Coaches can insert drafts"
  ON public.ai_checkin_drafts FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'coach') AND coach_id = auth.uid());

CREATE POLICY "Coaches can update drafts"
  ON public.ai_checkin_drafts FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'coach'))
  WITH CHECK (public.has_role(auth.uid(), 'coach'));

CREATE POLICY "Coaches can delete drafts"
  ON public.ai_checkin_drafts FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'coach'));

CREATE TRIGGER trg_ai_checkin_drafts_updated_at
  BEFORE UPDATE ON public.ai_checkin_drafts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();