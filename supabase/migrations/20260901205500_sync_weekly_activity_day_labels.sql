-- Keep course/home-workout-only weekdays from being labelled as rest days.
-- Strength exercises remain in training_days/training_exercises, while additional
-- activities live in athlete_weekly_activity_plan. The visible day label should
-- still reflect an active course-only day.

create or replace function public.sync_weekly_activity_day_labels()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  idx integer;
  fallback_label text;
  activity_label text;
begin
  idx := case new.weekday
    when 1 then 0
    when 2 then 1
    when 3 then 2
    when 4 then 3
    when 5 then 4
    when 6 then 5
    else 6
  end;

  fallback_label := case new.weekday
    when 1 then 'Mo — Ruhetag'
    when 2 then 'Di — Ruhetag'
    when 3 then 'Mi — Ruhetag'
    when 4 then 'Do — Ruhetag'
    when 5 then 'Fr — Ruhetag'
    when 6 then 'Sa — Ruhetag'
    else 'So — Ruhetag'
  end;

  select nullif(string_agg(nullif(trim(item->>'title'), ''), ' + '), '')
    into activity_label
    from jsonb_array_elements(coalesce(new.activities, '[]'::jsonb)) item;

  update public.training_days d
     set name = case
       when activity_label is not null then activity_label
       else fallback_label
     end
    from public.nutrition_plans p
   where d.plan_id = p.id
     and p.client_id = new.user_id
     and p.plan_type = 'training'
     and p.status in ('draft', 'approved', 'published', 'active')
     and mod(d.sort_order, 7) = idx
     and not exists (
       select 1 from public.training_exercises e where e.day_id = d.id
     );

  return new;
end;
$$;

drop trigger if exists trg_sync_weekly_activity_day_labels on public.athlete_weekly_activity_plan;
create trigger trg_sync_weekly_activity_day_labels
after insert or update of activities
on public.athlete_weekly_activity_plan
for each row
execute function public.sync_weekly_activity_day_labels();
