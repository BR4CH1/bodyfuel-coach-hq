
CREATE TABLE public.smart_gift_codes (
  code text PRIMARY KEY,
  label text,
  days integer NOT NULL DEFAULT 30,
  max_uses integer NOT NULL DEFAULT 1,
  uses integer NOT NULL DEFAULT 0,
  expires_at timestamptz,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.smart_gift_codes TO authenticated;
GRANT ALL ON public.smart_gift_codes TO service_role;

ALTER TABLE public.smart_gift_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "coach manages gift codes" ON public.smart_gift_codes
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'coach'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'coach'::public.app_role));

CREATE TABLE public.smart_gift_redemptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL REFERENCES public.smart_gift_codes(code) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  redeemed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (code, user_id)
);

GRANT SELECT, INSERT ON public.smart_gift_redemptions TO authenticated;
GRANT ALL ON public.smart_gift_redemptions TO service_role;

ALTER TABLE public.smart_gift_redemptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "coach reads redemptions" ON public.smart_gift_redemptions
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'coach'::public.app_role));

CREATE POLICY "user reads own redemptions" ON public.smart_gift_redemptions
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());
