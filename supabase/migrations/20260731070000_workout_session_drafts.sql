create extension if not exists pgcrypto;

create table if not exists public.workout_session_drafts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  subject_user_id uuid not null references auth.users(id) on delete cascade,
  session_key text not null,
  device_id text not null,
  client_revision bigint not null default 0,
  server_revision bigint not null default 1,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, session_key)
);

-- Safe upgrade path for an earlier draft of this feature.
alter table public.workout_session_drafts
  add column if not exists subject_user_id uuid references auth.users(id) on delete cascade,
  add column if not exists device_id text;

update public.workout_session_drafts
   set subject_user_id = coalesce(subject_user_id, user_id),
       device_id = coalesce(device_id, payload ->> 'deviceId', payload ->> 'clientId', 'legacy')
 where subject_user_id is null
    or device_id is null;

alter table public.workout_session_drafts
  alter column subject_user_id set not null,
  alter column device_id set not null;

do $$
begin
  if exists (
    select 1
      from information_schema.columns
     where table_schema = 'public'
       and table_name = 'workout_session_drafts'
       and column_name = 'client_id'
  ) then
    execute 'alter table public.workout_session_drafts alter column client_id drop not null';
  end if;
  if exists (
    select 1
      from information_schema.columns
     where table_schema = 'public'
       and table_name = 'workout_session_drafts'
       and column_name = 'client_updated_at'
  ) then
    execute 'alter table public.workout_session_drafts alter column client_updated_at drop not null';
  end if;
end;
$$;

create index if not exists workout_session_drafts_user_updated_idx
  on public.workout_session_drafts (user_id, updated_at desc);

alter table public.workout_session_drafts enable row level security;

drop policy if exists "Users read own workout drafts"
  on public.workout_session_drafts;
create policy "Users read own workout drafts"
  on public.workout_session_drafts
  for select
  using (auth.uid() = user_id and auth.uid() = subject_user_id);

drop policy if exists "Users insert own workout drafts"
  on public.workout_session_drafts;
create policy "Users insert own workout drafts"
  on public.workout_session_drafts
  for insert
  with check (auth.uid() = user_id and auth.uid() = subject_user_id);

drop policy if exists "Users update own workout drafts"
  on public.workout_session_drafts;
create policy "Users update own workout drafts"
  on public.workout_session_drafts
  for update
  using (auth.uid() = user_id and auth.uid() = subject_user_id)
  with check (auth.uid() = user_id and auth.uid() = subject_user_id);

drop policy if exists "Users delete own workout drafts"
  on public.workout_session_drafts;
create policy "Users delete own workout drafts"
  on public.workout_session_drafts
  for delete
  using (auth.uid() = user_id and auth.uid() = subject_user_id);

grant select, insert, update, delete on public.workout_session_drafts to authenticated;

create or replace function public.save_workout_session_draft(
  p_session_key text,
  p_payload jsonb,
  p_subject_user_id uuid,
  p_device_id text,
  p_client_revision bigint,
  p_expected_server_revision bigint
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_row public.workout_session_drafts%rowtype;
  v_applied boolean := false;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;
  if p_subject_user_id <> v_user_id then
    raise exception 'Workout drafts can only be saved by their owner';
  end if;

  select *
    into v_row
    from public.workout_session_drafts
   where user_id = v_user_id
     and session_key = p_session_key
   for update;

  if not found then
    if p_expected_server_revision is not null then
      raise exception 'Workout draft revision no longer exists';
    end if;

    insert into public.workout_session_drafts (
      user_id,
      subject_user_id,
      session_key,
      device_id,
      client_revision,
      server_revision,
      payload
    )
    values (
      v_user_id,
      p_subject_user_id,
      p_session_key,
      p_device_id,
      p_client_revision,
      1,
      p_payload
    )
    returning * into v_row;
    v_applied := true;
  elsif p_expected_server_revision = v_row.server_revision then
    -- Exact same-device revisions are idempotent. A strictly older revision
    -- can never overwrite the state already stored for that device.
    if v_row.device_id <> p_device_id or p_client_revision > v_row.client_revision then
      update public.workout_session_drafts
         set subject_user_id = p_subject_user_id,
             device_id = p_device_id,
             client_revision = p_client_revision,
             server_revision = server_revision + 1,
             payload = p_payload,
             updated_at = now()
       where id = v_row.id
      returning * into v_row;
      v_applied := true;
    end if;
  end if;

  return jsonb_build_object(
    'applied', v_applied,
    'remote_revision', v_row.server_revision,
    'payload', v_row.payload
  );
end;
$$;

revoke all on function public.save_workout_session_draft(
  text,
  jsonb,
  uuid,
  text,
  bigint,
  bigint
) from public;

grant execute on function public.save_workout_session_draft(
  text,
  jsonb,
  uuid,
  text,
  bigint,
  bigint
) to authenticated;
