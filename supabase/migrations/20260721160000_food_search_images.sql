alter table public.nutrition_foods
  add column if not exists image_url text,
  add column if not exists image_source text;

comment on column public.nutrition_foods.image_url is
  'Public thumbnail URL for food search results';

comment on column public.nutrition_foods.image_source is
  'bodyfuel, open_food_facts, brand or manual';
