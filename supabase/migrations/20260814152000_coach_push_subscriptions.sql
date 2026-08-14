create table if not exists public.coach_push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists coach_push_subscriptions_user_id_idx
  on public.coach_push_subscriptions(user_id);

alter table public.coach_push_subscriptions enable row level security;

-- Subscriptions contain device credentials and are intentionally server-only.
-- Authenticated browser clients have no direct table access; coach-only server
-- functions validate the session/role and use the service role for CRUD.
revoke all on table public.coach_push_subscriptions from anon, authenticated;
grant select, insert, update, delete on table public.coach_push_subscriptions to service_role;

comment on table public.coach_push_subscriptions is
  'Server-only Web Push subscriptions for coach accounts.';

create table if not exists public.coach_push_event_receipts (
  event_key text primary key,
  created_at timestamptz not null default now()
);

alter table public.coach_push_event_receipts enable row level security;
revoke all on table public.coach_push_event_receipts from anon, authenticated;
grant select, insert, delete on table public.coach_push_event_receipts to service_role;

comment on table public.coach_push_event_receipts is
  'Server-only idempotency keys preventing duplicate coach push events.';
