
ALTER TABLE public.meal_wishes
  ADD COLUMN IF NOT EXISTS applies_to text NOT NULL DEFAULT 'self'
    CHECK (applies_to IN ('self','partner','both'));

ALTER TABLE public.smart_nutrition_profile
  ADD COLUMN IF NOT EXISTS kitchen_equipment text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS kitchen_equipment_notes text;

-- Coaches dürfen Wunschgerichte für jeden Kunden anlegen
DROP POLICY IF EXISTS "Coach can insert meal wishes for any user" ON public.meal_wishes;
CREATE POLICY "Coach can insert meal wishes for any user"
  ON public.meal_wishes
  FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'coach'));

-- Coaches dürfen Wunschgerichte ihrer Kunden ändern (z. B. applies_to setzen)
DROP POLICY IF EXISTS "Coach can update any meal wish" ON public.meal_wishes;
CREATE POLICY "Coach can update any meal wish"
  ON public.meal_wishes
  FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'coach'))
  WITH CHECK (public.has_role(auth.uid(), 'coach'));
