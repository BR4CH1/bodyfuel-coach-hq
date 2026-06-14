
CREATE TABLE IF NOT EXISTS public.shopping_lists (
  plan_id uuid PRIMARY KEY REFERENCES public.nutrition_plans(id) ON DELETE CASCADE,
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  days integer NOT NULL DEFAULT 7,
  generated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.shopping_lists TO authenticated;
GRANT ALL ON public.shopping_lists TO service_role;

ALTER TABLE public.shopping_lists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "client reads own shopping lists"
  ON public.shopping_lists FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.nutrition_plans np
       WHERE np.id = shopping_lists.plan_id
         AND (np.client_id = auth.uid() OR public.has_role(auth.uid(), 'coach'))
    )
  );

CREATE POLICY "client writes own shopping lists"
  ON public.shopping_lists FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.nutrition_plans np
       WHERE np.id = shopping_lists.plan_id
         AND (np.client_id = auth.uid() OR public.has_role(auth.uid(), 'coach'))
    )
  );

CREATE POLICY "client updates own shopping lists"
  ON public.shopping_lists FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.nutrition_plans np
       WHERE np.id = shopping_lists.plan_id
         AND (np.client_id = auth.uid() OR public.has_role(auth.uid(), 'coach'))
    )
  );

CREATE POLICY "coach deletes shopping lists"
  ON public.shopping_lists FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'coach'));
