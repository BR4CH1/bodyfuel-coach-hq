-- Minor protection: add columns + consent tokens table
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_minor boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS requires_guardian_consent boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS guardian_name text,
  ADD COLUMN IF NOT EXISTS guardian_email text,
  ADD COLUMN IF NOT EXISTS guardian_consent_at timestamptz,
  ADD COLUMN IF NOT EXISTS guardian_consent_ip text,
  ADD COLUMN IF NOT EXISTS guardian_consent_docs jsonb,
  ADD COLUMN IF NOT EXISTS account_status text NOT NULL DEFAULT 'active';

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'profiles_account_status_check'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_account_status_check
      CHECK (account_status IN ('active','pending_guardian_consent','blocked'));
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.guardian_consent_tokens (
  token uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  guardian_email text NOT NULL,
  guardian_name text,
  expires_at timestamptz NOT NULL DEFAULT (now() + INTERVAL '14 days'),
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.guardian_consent_tokens TO service_role;
GRANT ALL ON public.guardian_consent_tokens TO service_role;

ALTER TABLE public.guardian_consent_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service role manages guardian consent tokens" ON public.guardian_consent_tokens;
CREATE POLICY "service role manages guardian consent tokens"
  ON public.guardian_consent_tokens FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_guardian_tokens_user ON public.guardian_consent_tokens(user_id);

-- Ranking masking for minors
CREATE OR REPLACE FUNCTION public.get_ranking()
 RETURNS TABLE(user_id uuid, nickname text, display_name text, total_points integer, level integer, current_streak integer, weekly_points integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    p.id AS user_id,
    CASE WHEN p.is_minor THEN COALESCE(p.nickname, 'Athlet*in') ELSE p.nickname END AS nickname,
    CASE WHEN p.is_minor THEN COALESCE(p.nickname, 'Athlet*in') ELSE p.display_name END AS display_name,
    COALESCE(up.total_points, 0) AS total_points,
    COALESCE(up.level, 1) AS level,
    COALESCE(up.current_streak, 0) AS current_streak,
    (COALESCE((
      SELECT SUM(dc.points)::int FROM public.daily_checks dc
      WHERE dc.user_id = p.id AND dc.check_date > CURRENT_DATE - INTERVAL '7 days'
    ), 0) + COALESCE((
      SELECT SUM(pp.points)::int FROM public.performance_points pp
      WHERE pp.user_id = p.id AND pp.approved = true AND pp.training_date > CURRENT_DATE - INTERVAL '7 days'
    ), 0)) AS weekly_points
  FROM public.profiles p
  JOIN public.user_roles r ON r.user_id = p.id AND r.role = 'client'
  LEFT JOIN public.user_points up ON up.user_id = p.id
$function$;