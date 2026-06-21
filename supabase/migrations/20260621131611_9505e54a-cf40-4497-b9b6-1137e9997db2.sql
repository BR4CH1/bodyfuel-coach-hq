
-- =========================================================
-- 1) coach_messages: restrict UPDATE to read-receipt columns
-- =========================================================
DROP POLICY IF EXISTS "messages_update_read" ON public.coach_messages;

CREATE POLICY "messages_update_coach"
  ON public.coach_messages FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'coach'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'coach'::public.app_role));

CREATE POLICY "messages_update_client"
  ON public.coach_messages FOR UPDATE TO authenticated
  USING (thread_user_id = auth.uid())
  WITH CHECK (thread_user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.coach_messages_update_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_coach boolean := public.has_role(auth.uid(), 'coach'::public.app_role);
BEGIN
  -- These columns must never change after insert
  IF NEW.thread_user_id IS DISTINCT FROM OLD.thread_user_id
     OR NEW.sender_id    IS DISTINCT FROM OLD.sender_id
     OR NEW.from_coach   IS DISTINCT FROM OLD.from_coach
     OR NEW.body         IS DISTINCT FROM OLD.body
     OR NEW.broadcast_id IS DISTINCT FROM OLD.broadcast_id
     OR NEW.created_at   IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'coach_messages: only read-receipt columns may be updated';
  END IF;

  IF NOT v_is_coach THEN
    -- Clients can only set read_by_client_at
    IF NEW.read_by_coach_at IS DISTINCT FROM OLD.read_by_coach_at THEN
      RAISE EXCEPTION 'coach_messages: clients may only update read_by_client_at';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS coach_messages_update_guard ON public.coach_messages;
CREATE TRIGGER coach_messages_update_guard
  BEFORE UPDATE ON public.coach_messages
  FOR EACH ROW EXECUTE FUNCTION public.coach_messages_update_guard();

-- =========================================================
-- 2) upgrade_events: validate inserted values
-- =========================================================
DROP POLICY IF EXISTS "Users insert own upgrade events" ON public.upgrade_events;

CREATE POLICY "Users insert own upgrade events"
  ON public.upgrade_events FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND event IN ('click','started','completed')
    AND to_tier IN ('free','trial','smart','coaching')
    AND (from_tier IS NULL OR from_tier IN ('free','trial','smart','coaching'))
  );

-- =========================================================
-- 3) user_roles: coaches cannot grant the coach role
-- =========================================================
DROP POLICY IF EXISTS "Coach manages roles" ON public.user_roles;
CREATE POLICY "Coach manages roles"
  ON public.user_roles
  FOR ALL
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'coach'::public.app_role)
    AND role <> 'coach'::public.app_role
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'coach'::public.app_role)
    AND role <> 'coach'::public.app_role
  );

-- =========================================================
-- 4) email_send_log: explicit lockdown for app users
-- =========================================================
REVOKE ALL ON public.email_send_log FROM PUBLIC;
REVOKE ALL ON public.email_send_log FROM anon;
REVOKE ALL ON public.email_send_log FROM authenticated;

DROP POLICY IF EXISTS "deny_app_users" ON public.email_send_log;
CREATE POLICY "deny_app_users"
  ON public.email_send_log
  AS RESTRICTIVE
  FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);
