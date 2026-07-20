
ALTER TABLE public.affiliate_partners
  ADD COLUMN IF NOT EXISTS discount_code text,
  ADD COLUMN IF NOT EXISTS discount_pct numeric;

-- unique when set (case-insensitive)
CREATE UNIQUE INDEX IF NOT EXISTS affiliate_partners_discount_code_uidx
  ON public.affiliate_partners (lower(discount_code))
  WHERE discount_code IS NOT NULL;

CREATE OR REPLACE FUNCTION public.attach_referral_by_code(_user_id uuid, _code text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_partner_id uuid;
  v_slug text;
BEGIN
  IF _code IS NULL OR length(trim(_code)) = 0 THEN RETURN; END IF;
  SELECT id, slug INTO v_partner_id, v_slug
    FROM public.affiliate_partners
    WHERE lower(discount_code) = lower(trim(_code))
      AND is_active = true
    LIMIT 1;
  IF v_partner_id IS NULL THEN RETURN; END IF;

  UPDATE public.profiles
     SET referred_by_partner_id = v_partner_id
   WHERE id = _user_id AND referred_by_partner_id IS NULL;

  INSERT INTO public.affiliate_referrals (partner_id, referred_user_id, source_slug, commission_status)
  VALUES (v_partner_id, _user_id, v_slug, 'pending')
  ON CONFLICT (referred_user_id) DO NOTHING;
END $$;
