
DO $$
DECLARE
  d RECORD;
  m RECORD;
  total INT;
  labels TEXT[];
  idx INT;
BEGIN
  FOR d IN
    SELECT day_id, COUNT(*) AS cnt
    FROM public.nutrition_plan_meals
    WHERE name ~* '^\s*mahlzeit\s*\d+\s*$'
    GROUP BY day_id
  LOOP
    -- Gesamtzahl aller Mahlzeiten am Tag (auch nicht-generische), für korrektes Slot-Mapping
    SELECT COUNT(*) INTO total FROM public.nutrition_plan_meals WHERE day_id = d.day_id;
    labels := CASE total
      WHEN 1 THEN ARRAY['Frühstück']
      WHEN 2 THEN ARRAY['Frühstück','Abendessen']
      WHEN 3 THEN ARRAY['Frühstück','Mittag','Abendessen']
      WHEN 4 THEN ARRAY['Frühstück','Mittag','Snack','Abendessen']
      WHEN 5 THEN ARRAY['Frühstück','Snack','Mittag','Snack','Abendessen']
      WHEN 6 THEN ARRAY['Frühstück','Snack','Mittag','Snack','Abendessen','Spätsnack']
      WHEN 7 THEN ARRAY['Frühstück','Snack','Mittag','Snack','Abendessen','Snack','Spätsnack']
      ELSE ARRAY['Frühstück','Snack','Mittag','Snack','Abendessen','Snack','Spätsnack','Snack','Snack','Snack','Snack','Snack','Snack','Snack','Snack']
    END;

    idx := 0;
    FOR m IN
      SELECT id FROM public.nutrition_plan_meals
      WHERE day_id = d.day_id
      ORDER BY sort_order, created_at
    LOOP
      idx := idx + 1;
      UPDATE public.nutrition_plan_meals
      SET name = labels[LEAST(idx, array_length(labels,1))]
      WHERE id = m.id
        AND name ~* '^\s*mahlzeit\s*\d+\s*$';
    END LOOP;
  END LOOP;
END $$;
