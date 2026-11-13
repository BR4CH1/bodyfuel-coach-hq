create table if not exists public.account_setup_tokens (
  token text primary key,
  user_id uuid not null,
  email text not null,
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);
grant all on public.account_setup_tokens to service_role;
create index if not exists account_setup_tokens_user_idx on public.account_setup_tokens(user_id);
alter table public.account_setup_tokens enable row level security;