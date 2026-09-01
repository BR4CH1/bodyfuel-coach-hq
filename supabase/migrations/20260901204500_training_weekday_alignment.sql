-- Keep coach training plans anchored to Monday-based weeks.
-- The builder stores days in canonical Mo..So sort order. Previously a non-Monday
-- scheduled_start_date shifted day_date, and reloading derived weekday from that
-- shifted date, making e.g. Tuesday appear as Thursday.

create or replace function public.normalize_training_plan_week_start()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  dow integer;
  offset_days integer;
begin
  if new.plan_type = 'training' and new.scheduled_start_date is not null then
    dow := extract(dow from new.scheduled_start_date)::integer; -- 0=Sun..6=Sat
    offset_days := case when dow = 1 then 0 else (8 - dow) % 7 end;
    new.scheduled_start_date := new.scheduled_start_date + offset_days;

    if new.weeks_count is not null and new.weeks_count > 0 then
      new.scheduled_end_date := new.scheduled_start_date + (new.weeks_count * 7 - 1);
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_normalize_training_plan_week_start on public.nutrition_plans;
create trigger trg_normalize_training_plan_week_start
before insert or update of scheduled_start_date, weeks_count, plan_type
on public.nutrition_plans
for each row
execute function public.normalize_training_plan_week_start();

create or replace function public.align_training_day_date_to_weekday()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  plan_start date;
  day_index integer;
  week_no integer;
begin
  select scheduled_start_date
    into plan_start
    from public.nutrition_plans
   where id = new.plan_id
     and plan_type = 'training';

  if plan_start is not null then
    day_index := mod(greatest(coalesce(new.sort_order, 0), 0), 7); -- 0=Mo ... 6=So
    week_no := greatest(coalesce(new.week_number, floor(coalesce(new.sort_order, 0) / 7.0)::integer + 1), 1);
    new.day_date := plan_start + ((week_no - 1) * 7 + day_index);
  end if;

  return new;
end;
$$;

drop trigger if exists trg_align_training_day_date_to_weekday on public.training_days;
create trigger trg_align_training_day_date_to_weekday
before insert or update of plan_id, sort_order, week_number, day_date
on public.training_days
for each row
execute function public.align_training_day_date_to_weekday();
