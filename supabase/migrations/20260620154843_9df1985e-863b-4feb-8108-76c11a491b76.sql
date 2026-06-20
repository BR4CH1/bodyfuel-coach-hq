CREATE TABLE public.coach_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  from_coach boolean NOT NULL,
  body text NOT NULL CHECK (length(btrim(body)) > 0 AND length(body) <= 4000),
  broadcast_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  read_by_coach_at timestamptz,
  read_by_client_at timestamptz
);

CREATE INDEX coach_messages_thread_idx ON public.coach_messages(thread_user_id, created_at DESC);
CREATE INDEX coach_messages_unread_coach_idx ON public.coach_messages(thread_user_id) WHERE from_coach = false AND read_by_coach_at IS NULL;
CREATE INDEX coach_messages_unread_client_idx ON public.coach_messages(thread_user_id) WHERE from_coach = true AND read_by_client_at IS NULL;

GRANT SELECT, INSERT, UPDATE ON public.coach_messages TO authenticated;
GRANT ALL ON public.coach_messages TO service_role;

ALTER TABLE public.coach_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "messages_select"
  ON public.coach_messages FOR SELECT TO authenticated
  USING (
    thread_user_id = auth.uid()
    OR public.has_role(auth.uid(), 'coach')
  );

CREATE POLICY "messages_insert"
  ON public.coach_messages FOR INSERT TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND (
      (from_coach = false AND thread_user_id = auth.uid())
      OR (from_coach = true AND public.has_role(auth.uid(), 'coach'))
    )
  );

CREATE POLICY "messages_update_read"
  ON public.coach_messages FOR UPDATE TO authenticated
  USING (
    thread_user_id = auth.uid()
    OR public.has_role(auth.uid(), 'coach')
  )
  WITH CHECK (
    thread_user_id = auth.uid()
    OR public.has_role(auth.uid(), 'coach')
  );

ALTER PUBLICATION supabase_realtime ADD TABLE public.coach_messages;