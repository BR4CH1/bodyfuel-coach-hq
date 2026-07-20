-- Auto-activate approved nutrition/training plans whose start date has arrived.
-- Runs daily at 00:05 UTC via pg_cron. Idempotent: only flips approved -> active
-- when scheduled_start_date <= CURRENT_DATE, and archives whatever plan is
-- currently active for the same client/plan_type so the (client_id, plan_type)
-- "is_active" trigger stays consistent.

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

CREATE OR REPLACE FUNCTION public.auto_activate_due_plans()
RETURNS TABLE(activated_plan_id uuid, client_id uuid, plan_type text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT p.id, p.client_id, p.plan_type
    FROM public.nutrition_plans p
    WHERE p.status = 'approved'
      AND p.scheduled_start_date IS NOT NULL
      AND p.scheduled_start_date <= CURRENT_DATE
    ORDER BY p.client_id, p.plan_type, p.scheduled_start_date ASC
  LOOP
    -- Archive whatever is currently active for this client/plan_type
    UPDATE public.nutrition_plans
       SET status = 'archived'
     WHERE client_id = r.client_id
       AND plan_type = r.plan_type
       AND status = 'active'
       AND id <> r.id;

    -- Promote the approved plan
    UPDATE public.nutrition_plans
       SET status = 'active'
     WHERE id = r.id;

    activated_plan_id := r.id;
    client_id := r.client_id;
    plan_type := r.plan_type;
    RETURN NEXT;
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION public.auto_activate_due_plans() TO service_role;

-- Unschedule any previous version, then schedule fresh at 00:05 UTC daily.
DO $$
BEGIN
  PERFORM cron.unschedule('auto-activate-due-plans');
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

SELECT cron.schedule(
  'auto-activate-due-plans',
  '5 0 * * *',
  $$ SELECT public.auto_activate_due_plans(); $$
);