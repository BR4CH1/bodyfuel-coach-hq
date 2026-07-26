UPDATE public.nutrition_foods
SET aliases = ARRAY(SELECT DISTINCT unnest(coalesce(aliases, ARRAY[]::text[]) || ARRAY['vollei','vollei roh'])),
    updated_at = now()
WHERE id = 'c17c8974-9aa9-4343-98a0-bca9a1abc903';

UPDATE public.nutrition_foods
SET is_active = false,
    updated_at = now()
WHERE id = '9add37b8-67c3-4c2a-95c5-4ccfc21f13a5';