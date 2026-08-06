-- 1) Abgelaufene Trials serverseitig beenden (idempotent, optional pro User)
CREATE OR REPLACE FUNCTION public.expire_stale_trials(_user_id uuid DEFAULT NULL)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  n integer;
BEGIN
  UPDATE public.profiles p
     SET trial_status = 'trial_expired'
   WHERE p.trial_status = 'trial'
     AND p.trial_end IS NOT NULL
     AND p.trial_end < CURRENT_DATE
     AND (_user_id IS NULL OR p.id = _user_id);
  GET DIAGNOSTICS n = ROW_COUNT;

  UPDATE public.customer_packages cp
     SET is_active = false,
         status = 'expired',
         ended_at = COALESCE(cp.ended_at, now())
   WHERE cp.source = 'trial'
     AND cp.is_active = true
     AND cp.end_date < CURRENT_DATE
     AND (_user_id IS NULL OR cp.user_id = _user_id);

  RETURN n;
END;
$$;

REVOKE ALL ON FUNCTION public.expire_stale_trials(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.expire_stale_trials(uuid) TO authenticated, service_role;

-- 2) Einheitlicher Entitlement-Resolver (Single Source of Truth)
CREATE OR REPLACE FUNCTION public.resolve_entitlement(_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_trial_status text;
  v_trial_end date;
  v_paid text;
  v_paid_end date;
  v_tier text := 'free';
  v_is_trial boolean := false;
  v_days_left integer := NULL;
  v_expires date := NULL;
BEGIN
  PERFORM public.expire_stale_trials(_user_id);

  SELECT p.trial_status, p.trial_end
    INTO v_trial_status, v_trial_end
    FROM public.profiles p
   WHERE p.id = _user_id;

  -- Bezahltes / manuell vergebenes Paket (Trial-Zeilen ausgeschlossen)
  SELECT cp.package, cp.end_date
    INTO v_paid, v_paid_end
    FROM public.customer_packages cp
   WHERE cp.user_id = _user_id
     AND cp.is_active = true
     AND cp.source <> 'trial'
     AND (cp.end_date IS NULL OR cp.end_date >= CURRENT_DATE)
   ORDER BY CASE cp.package
              WHEN 'coaching' THEN 1
              WHEN 'premium'  THEN 1
              WHEN 'starter'  THEN 1
              WHEN 'smart'    THEN 2
              ELSE 3
            END,
            cp.end_date DESC NULLS FIRST
   LIMIT 1;

  IF v_paid IS NOT NULL THEN
    v_tier := CASE WHEN v_paid = 'smart' THEN 'smart' ELSE 'coaching' END;
    v_expires := v_paid_end;
  ELSIF v_trial_status = 'trial' AND v_trial_end IS NOT NULL AND v_trial_end >= CURRENT_DATE THEN
    v_tier := 'smart';
    v_is_trial := true;
    v_expires := v_trial_end;
    v_days_left := GREATEST(0, (v_trial_end - CURRENT_DATE));
  ELSIF v_trial_status = 'active' THEN
    -- Legacy: vom Coach freigeschaltete Mitgliedschaft ohne Paketzeile
    v_tier := 'coaching';
  END IF;

  RETURN jsonb_build_object(
    'tier', v_tier,
    'is_trial', v_is_trial,
    'trial_status', COALESCE(v_trial_status, 'none'),
    'trial_days_left', v_days_left,
    'expires_on', v_expires,
    'package', v_paid
  );
END;
$$;

REVOKE ALL ON FUNCTION public.resolve_entitlement(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_entitlement(uuid) TO authenticated, service_role;

-- 3) Boolean-Helfer für Policies / Serverchecks
CREATE OR REPLACE FUNCTION public.has_smart_access(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.customer_packages cp
     WHERE cp.user_id = _user_id
       AND cp.is_active = true
       AND cp.source <> 'trial'
       AND cp.package IN ('smart', 'coaching', 'premium', 'starter')
       AND (cp.end_date IS NULL OR cp.end_date >= CURRENT_DATE)
  )
  OR EXISTS (
    SELECT 1 FROM public.profiles p
     WHERE p.id = _user_id
       AND (
         p.trial_status = 'active'
         OR (p.trial_status = 'trial' AND p.trial_end IS NOT NULL AND p.trial_end >= CURRENT_DATE)
       )
  );
$$;

REVOKE ALL ON FUNCTION public.has_smart_access(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_smart_access(uuid) TO authenticated, service_role;

-- 4) Backfill: laufende Trials bekommen eine sichtbare Smart-Trial-Paketzeile
INSERT INTO public.customer_packages (user_id, package, price_eur, start_date, end_date, is_active, source, status, started_at, notes)
SELECT p.id, 'smart', 0, COALESCE(p.trial_start, CURRENT_DATE), p.trial_end, true, 'trial', 'trial', now(), '7-Tage-Smart-Test'
  FROM public.profiles p
 WHERE p.trial_status = 'trial'
   AND p.trial_end IS NOT NULL
   AND p.trial_end >= CURRENT_DATE
ON CONFLICT (user_id, package) DO NOTHING;

-- 5) Altlasten bereinigen
SELECT public.expire_stale_trials(NULL);

-- 6) Stündlicher Cron-Job
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule('bodyfuel-expire-trials')
      WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'bodyfuel-expire-trials');
    PERFORM cron.schedule('bodyfuel-expire-trials', '7 * * * *', 'SELECT public.expire_stale_trials(NULL);');
  END IF;
END;
$$;