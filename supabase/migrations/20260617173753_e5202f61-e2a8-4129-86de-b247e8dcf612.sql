-- Mahlzeitenwünsche um Slot (Frühstück/Mittag/Abend/Snack) und optionale Personenzuordnung (Partner) erweitern.
ALTER TABLE public.meal_wishes
  ADD COLUMN IF NOT EXISTS meal_slot text NOT NULL DEFAULT 'any',
  ADD COLUMN IF NOT EXISTS for_person text;

ALTER TABLE public.meal_wishes
  DROP CONSTRAINT IF EXISTS meal_wishes_meal_slot_check;
ALTER TABLE public.meal_wishes
  ADD CONSTRAINT meal_wishes_meal_slot_check
  CHECK (meal_slot IN ('breakfast','lunch','dinner','snack','any'));

-- Freitext-Notiz, die der Coach/Nutzer beim Anstoßen der Plangenerierung mitgeben kann.
ALTER TABLE public.nutrition_plans
  ADD COLUMN IF NOT EXISTS pre_plan_note text;

-- Partner-Plan: Name pro Person (für UI-Auswahl und Mahlzeit-Zuordnung).
ALTER TABLE public.nutrition_partners
  ADD COLUMN IF NOT EXISTS partner_a_name text,
  ADD COLUMN IF NOT EXISTS partner_b_name text;

-- Mahlzeit-Zuordnung im Partner-Plan: 'a' | 'b' | 'both' (NULL = unspezifisch / Einzelplan).
ALTER TABLE public.nutrition_plan_meals
  ADD COLUMN IF NOT EXISTS assigned_to text;

ALTER TABLE public.nutrition_plan_meals
  DROP CONSTRAINT IF EXISTS nutrition_plan_meals_assigned_to_check;
ALTER TABLE public.nutrition_plan_meals
  ADD CONSTRAINT nutrition_plan_meals_assigned_to_check
  CHECK (assigned_to IS NULL OR assigned_to IN ('a','b','both'));