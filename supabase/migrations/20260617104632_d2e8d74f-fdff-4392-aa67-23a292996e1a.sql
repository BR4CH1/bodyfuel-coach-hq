
CREATE TABLE IF NOT EXISTS public.meal_wishes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  wish text NOT NULL CHECK (length(wish) BETWEEN 1 AND 300),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  coach_note text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.meal_wishes TO authenticated;
GRANT ALL ON public.meal_wishes TO service_role;

ALTER TABLE public.meal_wishes ENABLE ROW LEVEL SECURITY;

-- Client: read own
CREATE POLICY "Clients read own wishes"
ON public.meal_wishes FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'coach'));

-- Client: insert own (only as pending)
CREATE POLICY "Clients insert own wishes"
ON public.meal_wishes FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid() AND status = 'pending' AND consumed_at IS NULL);

-- Client: update own pending+unconsumed wishes (text only)
CREATE POLICY "Clients update own pending wishes"
ON public.meal_wishes FOR UPDATE TO authenticated
USING (user_id = auth.uid() AND status = 'pending' AND consumed_at IS NULL)
WITH CHECK (user_id = auth.uid() AND status = 'pending' AND consumed_at IS NULL);

-- Client: delete own pending+unconsumed
CREATE POLICY "Clients delete own pending wishes"
ON public.meal_wishes FOR DELETE TO authenticated
USING (user_id = auth.uid() AND consumed_at IS NULL);

-- Coach: update any
CREATE POLICY "Coaches update wishes"
ON public.meal_wishes FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'coach'))
WITH CHECK (public.has_role(auth.uid(), 'coach'));

-- Coach: delete any
CREATE POLICY "Coaches delete wishes"
ON public.meal_wishes FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'coach'));

CREATE INDEX meal_wishes_user_idx ON public.meal_wishes(user_id, consumed_at, status);

CREATE TRIGGER update_meal_wishes_updated_at
BEFORE UPDATE ON public.meal_wishes
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
