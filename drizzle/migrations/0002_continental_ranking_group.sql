ALTER TYPE public.app_group ADD VALUE IF NOT EXISTS 'continental';
CREATE OR REPLACE FUNCTION public.get_ranking()
RETURNS TABLE(user_id uuid, nickname text, display_name text, total_points integer, level integer, current_streak integer, weekly_points integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
 SELECT p.id,
 CASE WHEN p.is_minor THEN COALESCE(p.nickname, 'Athlet*in') ELSE p.nickname END,
 CASE WHEN p.is_minor THEN COALESCE(p.nickname, 'Athlet*in') ELSE p.display_name END,
 COALESCE(up.total_points,0), COALESCE(up.level,1), COALESCE(up.current_streak,0),
 (COALESCE((SELECT SUM(dc.points)::int FROM public.daily_checks dc WHERE dc.user_id=p.id AND dc.check_date > CURRENT_DATE - INTERVAL '7 days'),0)
 + COALESCE((SELECT SUM(pp.points)::int FROM public.performance_points pp WHERE pp.user_id=p.id AND pp.approved=true AND pp.training_date > CURRENT_DATE - INTERVAL '7 days'),0))
 FROM public.profiles p
 JOIN public.user_roles r ON r.user_id=p.id AND r.role='client'
 LEFT JOIN public.user_points up ON up.user_id=p.id
 WHERE auth.uid() IS NOT NULL AND (
 NOT EXISTS(SELECT 1 FROM public.user_groups own_group WHERE own_group.user_id=auth.uid() AND own_group.group_name::text='continental')
 OR EXISTS(SELECT 1 FROM public.user_groups participant_group WHERE participant_group.user_id=p.id AND participant_group.group_name::text='continental')
 );
$function$;
REVOKE ALL ON FUNCTION public.get_ranking() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_ranking() TO authenticated, service_role;