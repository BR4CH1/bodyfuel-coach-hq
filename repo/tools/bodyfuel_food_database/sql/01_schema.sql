create extension if not exists pg_trgm;

create table if not exists public.foods (
    id bigserial primary key,
    source text not null,
    source_id text not null,
    barcode text,
    name text not null,
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
    is_verified boolean default false,
    is_active boolean default true,

    source_updated_at timestamptz,
    imported_at timestamptz not null default now(),
    raw_data jsonb,

    unique(source, source_id)
);

create unique index if not exists foods_barcode_unique
on public.foods(barcode)
where barcode is not null and barcode <> '';

create index if not exists foods_name_trgm_idx
on public.foods using gin (name gin_trgm_ops);

create index if not exists foods_brand_idx on public.foods(brand);
create index if not exists foods_source_idx on public.foods(source);
create index if not exists foods_category_idx on public.foods(category);

create table if not exists public.nutrients (
    id bigserial primary key,
    canonical_code text not null unique,
    name_de text not null,
    name_en text,
    default_unit text not null
);

create table if not exists public.food_nutrients (
    food_id bigint not null references public.foods(id) on delete cascade,
    nutrient_id bigint not null references public.nutrients(id) on delete cascade,
    amount_per_100g numeric(16,6),
    unit text not null,
    source_value text,
    primary key(food_id, nutrient_id)
);

create table if not exists public.food_aliases (
    id bigserial primary key,
    food_id bigint not null references public.foods(id) on delete cascade,
    alias text not null,
    language_code text default 'de',
    unique(food_id, alias, language_code)
);

create table if not exists public.import_runs (
    id bigserial primary key,
    source text not null,
    started_at timestamptz not null default now(),
    finished_at timestamptz,
    rows_read bigint default 0,
    rows_imported bigint default 0,
    rows_rejected bigint default 0,
    notes text
);

create or replace view public.foods_search as
select
    id, name, brand, barcode, category, source, quality_score,
    kcal, protein_g, carbohydrates_g, fat_g, fiber_g, sugar_g,
    saturated_fat_g, salt_g, sodium_mg
from public.foods
where is_active = true;
