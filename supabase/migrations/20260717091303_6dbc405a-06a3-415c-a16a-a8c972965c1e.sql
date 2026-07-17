
-- Extend central foods
alter table public.foods
  add column if not exists is_bodyfuel_verified boolean not null default false,
  add column if not exists popularity integer not null default 0,
  add column if not exists allergens jsonb,
  add column if not exists micronutrients jsonb,
  add column if not exists ingredients jsonb,
  add column if not exists ingredients_text text;

create index if not exists foods_bodyfuel_verified_idx
  on public.foods(is_bodyfuel_verified desc, popularity desc) where is_active = true;
create index if not exists foods_popularity_idx
  on public.foods(popularity desc) where is_active = true;

alter table public.user_foods
  add column if not exists allergens jsonb,
  add column if not exists micronutrients jsonb,
  add column if not exists ingredients jsonb,
  add column if not exists ingredients_text text;

-- Translations
create table if not exists public.food_translations (
  id bigserial primary key,
  food_id bigint not null references public.foods(id) on delete cascade,
  language_code text not null,
  name text not null,
  name_normalized text generated always as (lower(public.immutable_unaccent(name))) stored,
  created_at timestamptz not null default now(),
  unique(food_id, language_code)
);
create index if not exists food_translations_food_idx on public.food_translations(food_id);
create index if not exists food_translations_lang_idx on public.food_translations(language_code);
create index if not exists food_translations_name_trgm_idx
  on public.food_translations using gin (name_normalized gin_trgm_ops);
grant select on public.food_translations to authenticated;
grant all on public.food_translations to service_role;
alter table public.food_translations enable row level security;
create policy "food_translations readable" on public.food_translations for select to authenticated using (true);
create policy "food_translations writable by platform owner" on public.food_translations for all to authenticated
  using (public.has_role(auth.uid(), 'platform_owner'))
  with check (public.has_role(auth.uid(), 'platform_owner'));

-- Versions
create table if not exists public.food_versions (
  id bigserial primary key,
  food_id bigint not null references public.foods(id) on delete cascade,
  version integer not null,
  snapshot jsonb not null,
  changed_by uuid references auth.users(id) on delete set null,
  change_reason text,
  created_at timestamptz not null default now(),
  unique(food_id, version)
);
create index if not exists food_versions_food_idx on public.food_versions(food_id, version desc);
grant select on public.food_versions to authenticated;
grant all on public.food_versions to service_role;
alter table public.food_versions enable row level security;
create policy "food_versions readable" on public.food_versions for select to authenticated using (true);
create policy "food_versions writable by platform owner" on public.food_versions for all to authenticated
  using (public.has_role(auth.uid(), 'platform_owner'))
  with check (public.has_role(auth.uid(), 'platform_owner'));

create or replace function public.tg_capture_food_version()
returns trigger language plpgsql
set search_path = public
as $$
declare v int;
begin
  if TG_OP = 'UPDATE' and (
       new.name is distinct from old.name
    or new.brand is distinct from old.brand
    or new.kcal is distinct from old.kcal
    or new.protein_g is distinct from old.protein_g
    or new.carbohydrates_g is distinct from old.carbohydrates_g
    or new.fat_g is distinct from old.fat_g
    or new.fiber_g is distinct from old.fiber_g
    or new.sugar_g is distinct from old.sugar_g
    or new.saturated_fat_g is distinct from old.saturated_fat_g
    or new.salt_g is distinct from old.salt_g
    or new.sodium_mg is distinct from old.sodium_mg
    or new.is_bodyfuel_verified is distinct from old.is_bodyfuel_verified
    or new.is_verified is distinct from old.is_verified
  ) then
    select coalesce(max(version), 0) + 1 into v from public.food_versions where food_id = old.id;
    insert into public.food_versions(food_id, version, snapshot, changed_by)
    values (old.id, v, to_jsonb(old), auth.uid());
  end if;
  return new;
end $$;

drop trigger if exists foods_capture_version on public.foods;
create trigger foods_capture_version before update on public.foods
  for each row execute function public.tg_capture_food_version();

-- Library favorites (new name to avoid collision with legacy tracker table)
create table if not exists public.food_library_favorites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  food_kind text not null check (food_kind in ('central','private')),
  central_food_id bigint references public.foods(id) on delete cascade,
  user_food_id uuid references public.user_foods(id) on delete cascade,
  created_at timestamptz not null default now(),
  check (
    (food_kind = 'central' and central_food_id is not null and user_food_id is null)
    or (food_kind = 'private' and user_food_id is not null and central_food_id is null)
  )
);
create unique index if not exists food_library_favorites_uniq_central
  on public.food_library_favorites(user_id, central_food_id) where central_food_id is not null;
create unique index if not exists food_library_favorites_uniq_private
  on public.food_library_favorites(user_id, user_food_id) where user_food_id is not null;
create index if not exists food_library_favorites_user_idx on public.food_library_favorites(user_id, created_at desc);
grant select, insert, delete on public.food_library_favorites to authenticated;
grant all on public.food_library_favorites to service_role;
alter table public.food_library_favorites enable row level security;
create policy "food_library_favorites select own"
  on public.food_library_favorites for select to authenticated using (auth.uid() = user_id);
create policy "food_library_favorites insert own"
  on public.food_library_favorites for insert to authenticated with check (auth.uid() = user_id);
create policy "food_library_favorites delete own"
  on public.food_library_favorites for delete to authenticated using (auth.uid() = user_id);

-- Usage counts
create table if not exists public.food_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  food_kind text not null check (food_kind in ('central','private')),
  central_food_id bigint references public.foods(id) on delete cascade,
  user_food_id uuid references public.user_foods(id) on delete cascade,
  use_count integer not null default 0,
  last_used_at timestamptz not null default now(),
  check (
    (food_kind = 'central' and central_food_id is not null and user_food_id is null)
    or (food_kind = 'private' and user_food_id is not null and central_food_id is null)
  )
);
create unique index if not exists food_usage_uniq_central
  on public.food_usage(user_id, central_food_id) where central_food_id is not null;
create unique index if not exists food_usage_uniq_private
  on public.food_usage(user_id, user_food_id) where user_food_id is not null;
create index if not exists food_usage_user_last_idx on public.food_usage(user_id, last_used_at desc);
grant select, insert, update on public.food_usage to authenticated;
grant all on public.food_usage to service_role;
alter table public.food_usage enable row level security;
create policy "food_usage select own"
  on public.food_usage for select to authenticated using (auth.uid() = user_id);
create policy "food_usage insert own"
  on public.food_usage for insert to authenticated with check (auth.uid() = user_id);
create policy "food_usage update own"
  on public.food_usage for update to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- User recipes
create table if not exists public.user_recipes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  description text,
  servings numeric(10,2) not null default 1 check (servings > 0),
  category text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists user_recipes_user_idx on public.user_recipes(user_id, updated_at desc);
grant select, insert, update, delete on public.user_recipes to authenticated;
grant all on public.user_recipes to service_role;
alter table public.user_recipes enable row level security;
create policy "user_recipes select own" on public.user_recipes for select to authenticated using (auth.uid() = user_id);
create policy "user_recipes insert own" on public.user_recipes for insert to authenticated with check (auth.uid() = user_id);
create policy "user_recipes update own" on public.user_recipes for update to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "user_recipes delete own" on public.user_recipes for delete to authenticated using (auth.uid() = user_id);
drop trigger if exists user_recipes_updated_at on public.user_recipes;
create trigger user_recipes_updated_at before update on public.user_recipes
  for each row execute function public.tg_set_updated_at();

create table if not exists public.user_recipe_items (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references public.user_recipes(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  position integer not null default 0,
  food_kind text not null check (food_kind in ('central','private')),
  central_food_id bigint references public.foods(id) on delete restrict,
  user_food_id uuid references public.user_foods(id) on delete restrict,
  amount_g numeric(12,3) not null check (amount_g >= 0),
  unit text,
  note text,
  check (
    (food_kind = 'central' and central_food_id is not null and user_food_id is null)
    or (food_kind = 'private' and user_food_id is not null and central_food_id is null)
  )
);
create index if not exists user_recipe_items_recipe_idx on public.user_recipe_items(recipe_id, position);
grant select, insert, update, delete on public.user_recipe_items to authenticated;
grant all on public.user_recipe_items to service_role;
alter table public.user_recipe_items enable row level security;
create policy "user_recipe_items select own" on public.user_recipe_items for select to authenticated using (auth.uid() = user_id);
create policy "user_recipe_items insert own" on public.user_recipe_items for insert to authenticated with check (auth.uid() = user_id);
create policy "user_recipe_items update own" on public.user_recipe_items for update to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "user_recipe_items delete own" on public.user_recipe_items for delete to authenticated using (auth.uid() = user_id);

-- User meals
create table if not exists public.user_meals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  slot text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists user_meals_user_idx on public.user_meals(user_id, updated_at desc);
grant select, insert, update, delete on public.user_meals to authenticated;
grant all on public.user_meals to service_role;
alter table public.user_meals enable row level security;
create policy "user_meals select own" on public.user_meals for select to authenticated using (auth.uid() = user_id);
create policy "user_meals insert own" on public.user_meals for insert to authenticated with check (auth.uid() = user_id);
create policy "user_meals update own" on public.user_meals for update to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "user_meals delete own" on public.user_meals for delete to authenticated using (auth.uid() = user_id);
drop trigger if exists user_meals_updated_at on public.user_meals;
create trigger user_meals_updated_at before update on public.user_meals
  for each row execute function public.tg_set_updated_at();

create table if not exists public.user_meal_items (
  id uuid primary key default gen_random_uuid(),
  meal_id uuid not null references public.user_meals(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  position integer not null default 0,
  food_kind text not null check (food_kind in ('central','private','recipe')),
  central_food_id bigint references public.foods(id) on delete restrict,
  user_food_id uuid references public.user_foods(id) on delete restrict,
  recipe_id uuid references public.user_recipes(id) on delete restrict,
  amount_g numeric(12,3),
  servings numeric(10,2),
  unit text,
  note text
);
create index if not exists user_meal_items_meal_idx on public.user_meal_items(meal_id, position);
grant select, insert, update, delete on public.user_meal_items to authenticated;
grant all on public.user_meal_items to service_role;
alter table public.user_meal_items enable row level security;
create policy "user_meal_items select own" on public.user_meal_items for select to authenticated using (auth.uid() = user_id);
create policy "user_meal_items insert own" on public.user_meal_items for insert to authenticated with check (auth.uid() = user_id);
create policy "user_meal_items update own" on public.user_meal_items for update to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "user_meal_items delete own" on public.user_meal_items for delete to authenticated using (auth.uid() = user_id);

-- Barcode lookup
create or replace function public.lookup_barcode(code text)
returns setof public.foods_search
language sql
stable
security invoker
set search_path = public
as $$
  select fs.* from public.foods_search fs
  where fs.barcode = trim(code)
  order by fs.quality_score desc nulls last
  limit 5;
$$;
grant execute on function public.lookup_barcode(text) to authenticated;

-- Log a food selection
create or replace function public.log_food_use(
  p_kind text,
  p_central_food_id bigint default null,
  p_user_food_id uuid default null
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare uid uuid := auth.uid();
begin
  if uid is null then return; end if;
  if p_kind = 'central' and p_central_food_id is not null then
    insert into public.food_usage(user_id, food_kind, central_food_id, use_count, last_used_at)
    values (uid, 'central', p_central_food_id, 1, now())
    on conflict (user_id, central_food_id) where central_food_id is not null
    do update set use_count = public.food_usage.use_count + 1, last_used_at = now();
    update public.foods set popularity = popularity + 1 where id = p_central_food_id;
  elsif p_kind = 'private' and p_user_food_id is not null then
    if exists (select 1 from public.user_foods where id = p_user_food_id and user_id = uid) then
      insert into public.food_usage(user_id, food_kind, user_food_id, use_count, last_used_at)
      values (uid, 'private', p_user_food_id, 1, now())
      on conflict (user_id, user_food_id) where user_food_id is not null
      do update set use_count = public.food_usage.use_count + 1, last_used_at = now();
    end if;
  end if;
end $$;
grant execute on function public.log_food_use(text, bigint, uuid) to authenticated;

-- Rebuilt search RPC
create or replace function public.search_foods(
  q text,
  include_private boolean default true,
  max_results int default 50,
  lang text default 'de'
)
returns table (
  id text, kind text, name text, brand text, barcode text, category text, source text,
  is_verified boolean, is_bodyfuel_verified boolean, language_code text,
  kcal numeric, protein_g numeric, carbohydrates_g numeric, fat_g numeric, fiber_g numeric,
  sugar_g numeric, saturated_fat_g numeric, salt_g numeric, sodium_mg numeric,
  serving_size_g numeric, score real
)
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  qn text := lower(public.immutable_unaccent(coalesce(q, '')));
  lim int := least(greatest(coalesce(max_results, 50), 1), 50);
  uid uuid := auth.uid();
  preferred_lang text := coalesce(nullif(lang, ''), 'de');
begin
  if qn = '' then return; end if;

  return query
  with barcode_rows as (
    select
      f.id::text as id, 'central'::text as kind,
      f.name, f.brand, f.barcode, f.category, f.source,
      f.is_verified, f.is_bodyfuel_verified, f.language_code,
      f.kcal, f.protein_g, f.carbohydrates_g, f.fat_g, f.fiber_g, f.sugar_g,
      f.saturated_fat_g, f.salt_g, f.sodium_mg, f.serving_size_g,
      100.0::real as score
    from public.foods f
    where f.is_active and q ~ '^[0-9]{6,}$' and f.barcode = q
    limit 5
  ),
  private_hits as (
    select
      uf.id::text as id, 'private'::text as kind,
      uf.name, uf.brand, uf.barcode, uf.category, 'user'::text as source,
      true as is_verified, false as is_bodyfuel_verified, 'de'::text as language_code,
      uf.kcal, uf.protein_g, uf.carbohydrates_g, uf.fat_g, uf.fiber_g, uf.sugar_g,
      uf.saturated_fat_g, uf.salt_g, uf.sodium_mg, uf.serving_size_g,
      (
        similarity(uf.name_normalized, qn)
        + 0.6
        + coalesce((select ln(1 + fu.use_count) * 0.1 from public.food_usage fu
                    where fu.user_id = uid and fu.user_food_id = uf.id), 0)
      )::real as score
    from public.user_foods uf
    where include_private and uf.user_id = uid
      and (uf.name_normalized % qn or uf.name_normalized ilike '%' || qn || '%')
    order by score desc
    limit lim
  ),
  central as (
    select
      f.id::text as id, 'central'::text as kind,
      f.name, f.brand, f.barcode, f.category, f.source,
      f.is_verified, f.is_bodyfuel_verified, f.language_code,
      f.kcal, f.protein_g, f.carbohydrates_g, f.fat_g, f.fiber_g, f.sugar_g,
      f.saturated_fat_g, f.salt_g, f.sodium_mg, f.serving_size_g,
      (
        greatest(
          similarity(f.name_normalized, qn),
          coalesce(similarity(lower(public.immutable_unaccent(f.brand)), qn), 0),
          coalesce((select max(similarity(fa.alias_normalized, qn))
                    from public.food_aliases fa where fa.food_id = f.id), 0),
          coalesce((select max(similarity(ft.name_normalized, qn))
                    from public.food_translations ft where ft.food_id = f.id), 0)
        )
        + case when f.is_bodyfuel_verified then 0.6 else 0 end
        + case when f.is_verified then 0.2 else 0 end
        + case when f.language_code = preferred_lang then 0.15 else 0 end
        + case when coalesce(f.quality_score,0) >= 70 then 0.05 else 0 end
        + case when f.source = 'open_food_facts' then -0.1 else 0 end
        + ln(1 + coalesce(f.popularity, 0)) * 0.02
        + coalesce((select ln(1 + fu.use_count) * 0.1 from public.food_usage fu
                    where fu.user_id = uid and fu.central_food_id = f.id), 0)
      )::real as score
    from public.foods f
    where f.is_active
      and (
        f.name_normalized % qn
        or f.name_normalized ilike '%' || qn || '%'
        or coalesce(lower(public.immutable_unaccent(f.brand)), '') ilike '%' || qn || '%'
        or exists (select 1 from public.food_aliases fa
                   where fa.food_id = f.id and fa.alias_normalized % qn)
        or exists (select 1 from public.food_translations ft
                   where ft.food_id = f.id and ft.name_normalized % qn)
      )
    order by score desc
    limit lim
  )
  select * from barcode_rows
  union all select * from private_hits
  union all select * from central
  order by score desc
  limit lim;
end $$;
grant execute on function public.search_foods(text, boolean, int, text) to authenticated;

-- drop the older 3-arg overload to keep API clean
drop function if exists public.search_foods(text, boolean, int);
