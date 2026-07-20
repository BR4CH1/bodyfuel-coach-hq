
ALTER TABLE public.player_card_design
  ADD COLUMN IF NOT EXISTS organization_slug text,
  ADD COLUMN IF NOT EXISTS name text;

DELETE FROM public.player_card_design;

INSERT INTO public.player_card_design
  (scope, organization_slug, name, template_url, template_uploaded_at, layout_json, is_published, published_at)
VALUES (
  'bulls',
  'bulls',
  'Elite',
  '/__l5e/assets-v1/3f240036-2679-4623-8447-eee37b5ad1c3/bulls-player-card-elite.png',
  now(),
  '{}'::jsonb,
  true,
  now()
);
