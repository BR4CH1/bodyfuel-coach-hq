-- Re-drop the legacy date-shifting triggers. The original drop migration
-- (20260901202608) sorts BEFORE the migration that creates them
-- (20260901204500), so a fresh/reset environment would re-create them and
-- again shift plan start dates to Monday and overwrite training_days.day_date.
drop trigger if exists trg_normalize_training_plan_week_start on public.nutrition_plans;
drop function if exists public.normalize_training_plan_week_start();
drop trigger if exists trg_align_training_day_date_to_weekday on public.training_days;
drop function if exists public.align_training_day_date_to_weekday();
