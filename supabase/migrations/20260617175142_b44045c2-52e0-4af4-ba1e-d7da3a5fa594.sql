
-- Helper: are two users currently linked as nutrition partners?
CREATE OR REPLACE FUNCTION public.are_nutrition_partners(_a uuid, _b uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.nutrition_partners
    WHERE (user_a = _a AND user_b = _b) OR (user_a = _b AND user_b = _a)
  );
$$;

-- Partners can read each other's wishes
DROP POLICY IF EXISTS "Partners read each others wishes" ON public.meal_wishes;
CREATE POLICY "Partners read each others wishes"
ON public.meal_wishes
FOR SELECT
TO authenticated
USING (public.are_nutrition_partners(auth.uid(), user_id));

-- Partners can update assignment (for_person + meal_slot) of each other's pending wishes
DROP POLICY IF EXISTS "Partners update assignment of pending wishes" ON public.meal_wishes;
CREATE POLICY "Partners update assignment of pending wishes"
ON public.meal_wishes
FOR UPDATE
TO authenticated
USING (
  public.are_nutrition_partners(auth.uid(), user_id)
  AND status = 'pending'
  AND consumed_at IS NULL
)
WITH CHECK (
  public.are_nutrition_partners(auth.uid(), user_id)
  AND status = 'pending'
  AND consumed_at IS NULL
);
