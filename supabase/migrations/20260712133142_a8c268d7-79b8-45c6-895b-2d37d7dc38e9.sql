ALTER TABLE public.ai_checkin_drafts
  ADD COLUMN IF NOT EXISTS action_decisions jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS published_at timestamptz;

CREATE POLICY "Clients can read own published drafts"
  ON public.ai_checkin_drafts FOR SELECT
  TO authenticated
  USING (client_id = auth.uid() AND published_at IS NOT NULL);
