ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS nickname text;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_nickname_lower_unique
  ON public.profiles (lower(nickname))
  WHERE nickname IS NOT NULL;

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_nickname_format_chk;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_nickname_format_chk
  CHECK (nickname IS NULL OR nickname ~ '^[A-Za-z0-9_-]{2,20}$');

CREATE OR REPLACE FUNCTION public.get_ranking()
RETURNS TABLE(
  user_id uuid,
  nickname text,
  display_name text,
  total_points integer,
  level integer,
  current_streak integer,
  weekly_points integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.id AS user_id,
    p.nickname,
    p.display_name,
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
$$;

GRANT EXECUTE ON FUNCTION public.get_ranking() TO authenticated;