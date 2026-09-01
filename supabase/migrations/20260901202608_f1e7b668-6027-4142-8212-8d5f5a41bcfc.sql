drop trigger if exists trg_normalize_training_plan_week_start on public.nutrition_plans;
drop function if exists public.normalize_training_plan_week_start();
drop trigger if exists trg_align_training_day_date_to_weekday on public.training_days;
drop function if exists public.align_training_day_date_to_weekday();