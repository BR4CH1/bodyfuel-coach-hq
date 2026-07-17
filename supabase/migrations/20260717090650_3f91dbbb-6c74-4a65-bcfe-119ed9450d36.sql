
create extension if not exists pg_trgm;
create extension if not exists unaccent;

-- immutable unaccent wrapper (needed for generated columns and indexes)
create or replace function public.immutable_unaccent(text)
returns text
language sql
immutable
strict
parallel safe
set search_path = public, extensions
as $$ select unaccent('unaccent', $1) $$;

-- =========================================================
-- Central foods table
-- =========================================================
create table if not exists public.foods (
  id bigserial primary key,
  source text not null,
  source_id text not null,
  barcode text,
  name text not null,
  name_normalized text generated always as (lower(public.immutable_unaccent(name))) stored,
  brand text,
  category text,
  country_codes text[],
  language_code text default 'de',
  serving_size_g numeric(10,3),

  kcal numeric(12,4),
  protein_g numeric(12,4),
  carbohydrates_g numeric(12,4),
  fat_g numeric(12,4),
  fiber_g numeric(12,4),
  sugar_g numeric(12,4),
  saturated_fat_g numeric(12,4),
  salt_g numeric(12,4),
  sodium_mg numeric(12,4),

  data_basis text default 'per_100g',
  quality_score smallint check (quality_score between 0 and 100),
  is_verified boolean not null default false,
  is_active boolean not null default true,

  source_updated_at timestamptz,
  imported_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  raw_data jsonb,

  unique(source, source_id)
);

create unique index if not exists foods_barcode_unique
  on public.foods(barcode)
  where barcode is not null and barcode <> '';

create index if not exists foods_name_trgm_idx
  on public.foods using gin (name_normalized gin_trgm_ops);
create index if not exists foods_brand_trgm_idx
  on public.foods using gin (brand gin_trgm_ops);
create index if not exists foods_category_idx on public.foods(category);
create index if not exists foods_source_idx on public.foods(source);
create index if not exists foods_verified_lang_idx
  on public.foods(is_verified desc, language_code)
  where is_active = true;

grant select on public.foods to authenticated;
grant all on public.foods to service_role;
alter table public.foods enable row level security;

create policy "foods readable by authenticated"
  on public.foods for select
  to authenticated
  using (is_active = true);

create policy "foods writable by platform owner"
  on public.foods for all
  to authenticated
  using (public.has_role(auth.uid(), 'platform_owner'))
  with check (public.has_role(auth.uid(), 'platform_owner'));

-- =========================================================
-- Nutrients
-- =========================================================
create table if not exists public.nutrients (
  id bigserial primary key,
  canonical_code text not null unique,
  name_de text not null,
  name_en text,
  default_unit text not null
);
grant select on public.nutrients to authenticated;
grant all on public.nutrients to service_role;
alter table public.nutrients enable row level security;
create policy "nutrients readable"
  on public.nutrients for select to authenticated using (true);
create policy "nutrients writable by platform owner"
  on public.nutrients for all to authenticated
  using (public.has_role(auth.uid(), 'platform_owner'))
  with check (public.has_role(auth.uid(), 'platform_owner'));

create table if not exists public.food_nutrients (
  food_id bigint not null references public.foods(id) on delete cascade,
  nutrient_id bigint not null references public.nutrients(id) on delete cascade,
  amount_per_100g numeric(16,6),
  unit text not null,
  source_value text,
  primary key(food_id, nutrient_id)
);
create index if not exists food_nutrients_food_idx on public.food_nutrients(food_id);
grant select on public.food_nutrients to authenticated;
grant all on public.food_nutrients to service_role;
alter table public.food_nutrients enable row level security;
create policy "food_nutrients readable"
  on public.food_nutrients for select to authenticated using (true);
create policy "food_nutrients writable by platform owner"
  on public.food_nutrients for all to authenticated
  using (public.has_role(auth.uid(), 'platform_owner'))
  with check (public.has_role(auth.uid(), 'platform_owner'));

-- =========================================================
-- Aliases
-- =========================================================
create table if not exists public.food_aliases (
  id bigserial primary key,
  food_id bigint not null references public.foods(id) on delete cascade,
  alias text not null,
  alias_normalized text generated always as (lower(public.immutable_unaccent(alias))) stored,
  language_code text default 'de',
  unique(food_id, alias, language_code)
);
create index if not exists food_aliases_food_idx on public.food_aliases(food_id);
create index if not exists food_aliases_trgm_idx
  on public.food_aliases using gin (alias_normalized gin_trgm_ops);
grant select on public.food_aliases to authenticated;
grant all on public.food_aliases to service_role;
alter table public.food_aliases enable row level security;
create policy "food_aliases readable"
  on public.food_aliases for select to authenticated using (true);
create policy "food_aliases writable by platform owner"
  on public.food_aliases for all to authenticated
  using (public.has_role(auth.uid(), 'platform_owner'))
  with check (public.has_role(auth.uid(), 'platform_owner'));

-- =========================================================
-- Import runs
-- =========================================================
create table if not exists public.import_runs (
  id bigserial primary key,
  source text not null,
  status text not null default 'running',
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  rows_read bigint default 0,
  rows_imported bigint default 0,
  rows_rejected bigint default 0,
  notes text
);
create index if not exists import_runs_source_idx on public.import_runs(source, started_at desc);
grant select on public.import_runs to authenticated;
grant all on public.import_runs to service_role;
alter table public.import_runs enable row level security;
create policy "import_runs readable by platform owner"
  on public.import_runs for select to authenticated
  using (public.has_role(auth.uid(), 'platform_owner'));
create policy "import_runs writable by platform owner"
  on public.import_runs for all to authenticated
  using (public.has_role(auth.uid(), 'platform_owner'))
  with check (public.has_role(auth.uid(), 'platform_owner'));

-- =========================================================
-- User private foods
-- =========================================================
create table if not exists public.user_foods (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  name_normalized text generated always as (lower(public.immutable_unaccent(name))) stored,
  brand text,
  barcode text,
  category text,
  serving_size_g numeric(10,3),

  kcal numeric(12,4),
  protein_g numeric(12,4),
  carbohydrates_g numeric(12,4),
  fat_g numeric(12,4),
  fiber_g numeric(12,4),
  sugar_g numeric(12,4),
  saturated_fat_g numeric(12,4),
  salt_g numeric(12,4),
  sodium_mg numeric(12,4),

  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists user_foods_user_idx on public.user_foods(user_id);
create index if not exists user_foods_name_trgm_idx
  on public.user_foods using gin (name_normalized gin_trgm_ops);

grant select, insert, update, delete on public.user_foods to authenticated;
grant all on public.user_foods to service_role;
alter table public.user_foods enable row level security;

create policy "user_foods select own"
  on public.user_foods for select to authenticated
  using (auth.uid() = user_id);
create policy "user_foods insert own"
  on public.user_foods for insert to authenticated
  with check (auth.uid() = user_id);
create policy "user_foods update own"
  on public.user_foods for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
create policy "user_foods delete own"
  on public.user_foods for delete to authenticated
  using (auth.uid() = user_id);

create or replace function public.tg_set_updated_at()
returns trigger language plpgsql
set search_path = public
as $$
begin new.updated_at = now(); return new; end $$;

drop trigger if exists user_foods_updated_at on public.user_foods;
create trigger user_foods_updated_at before update on public.user_foods
  for each row execute function public.tg_set_updated_at();
drop trigger if exists foods_updated_at on public.foods;
create trigger foods_updated_at before update on public.foods
  for each row execute function public.tg_set_updated_at();

-- =========================================================
-- Search RPC — searches central + user private foods
-- =========================================================
create or replace function public.search_foods(
  q text,
  include_private boolean default true,
  max_results int default 50
)
returns table (
  id text,
  kind text,
  name text,
  brand text,
  barcode text,
  category text,
  source text,
  is_verified boolean,
  language_code text,
  kcal numeric,
  protein_g numeric,
  carbohydrates_g numeric,
  fat_g numeric,
  fiber_g numeric,
  sugar_g numeric,
  saturated_fat_g numeric,
  salt_g numeric,
  sodium_mg numeric,
  serving_size_g numeric,
  score real
)
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  qn text := lower(public.immutable_unaccent(coalesce(q, '')));
  lim int := least(greatest(coalesce(max_results, 50), 1), 50);
begin
  if qn = '' then
    return;
  end if;

  return query
  with barcode_rows as (
    select
      f.id::text as id, 'central'::text as kind,
      f.name, f.brand, f.barcode, f.category, f.source,
      f.is_verified, f.language_code,
      f.kcal, f.protein_g, f.carbohydrates_g, f.fat_g, f.fiber_g, f.sugar_g,
      f.saturated_fat_g, f.salt_g, f.sodium_mg, f.serving_size_g,
      10.0::real as score
    from public.foods f
    where f.is_active
      and q ~ '^[0-9]{6,}$'
      and f.barcode = q
    limit 5
  ),
  private_hits as (
    select
      uf.id::text as id, 'private'::text as kind,
      uf.name, uf.brand, uf.barcode, uf.category, 'user'::text as source,
      true as is_verified, 'de'::text as language_code,
      uf.kcal, uf.protein_g, uf.carbohydrates_g, uf.fat_g, uf.fiber_g, uf.sugar_g,
      uf.saturated_fat_g, uf.salt_g, uf.sodium_mg, uf.serving_size_g,
      (similarity(uf.name_normalized, qn) + 0.5)::real as score
    from public.user_foods uf
    where include_private
      and uf.user_id = auth.uid()
      and (
        uf.name_normalized % qn
        or uf.name_normalized ilike '%' || qn || '%'
      )
    order by score desc
    limit lim
  ),
  central as (
    select
      f.id::text as id, 'central'::text as kind,
      f.name, f.brand, f.barcode, f.category, f.source,
      f.is_verified, f.language_code,
      f.kcal, f.protein_g, f.carbohydrates_g, f.fat_g, f.fiber_g, f.sugar_g,
      f.saturated_fat_g, f.salt_g, f.sodium_mg, f.serving_size_g,
      (
        greatest(
          similarity(f.name_normalized, qn),
          coalesce(similarity(lower(public.immutable_unaccent(f.brand)), qn), 0),
          coalesce((select max(similarity(fa.alias_normalized, qn))
                    from public.food_aliases fa where fa.food_id = f.id), 0)
        )
        + case when f.is_verified then 0.25 else 0 end
        + case when f.language_code = 'de' then 0.15 else 0 end
        + case when coalesce(f.quality_score,0) >= 70 then 0.05 else 0 end
      )::real as score
    from public.foods f
    where f.is_active
      and (
        f.name_normalized % qn
        or f.name_normalized ilike '%' || qn || '%'
        or coalesce(lower(public.immutable_unaccent(f.brand)), '') ilike '%' || qn || '%'
        or exists (
          select 1 from public.food_aliases fa
          where fa.food_id = f.id and fa.alias_normalized % qn
        )
      )
    order by score desc
    limit lim
  )
  select * from barcode_rows
  union all
  select * from private_hits
  union all
  select * from central
  order by score desc
  limit lim;
end $$;

grant execute on function public.search_foods(text, boolean, int) to authenticated;

create or replace view public.foods_search as
select
  id, name, brand, barcode, category, source, quality_score,
  kcal, protein_g, carbohydrates_g, fat_g, fiber_g, sugar_g,
  saturated_fat_g, salt_g, sodium_mg
from public.foods
where is_active = true;
grant select on public.foods_search to authenticated;
