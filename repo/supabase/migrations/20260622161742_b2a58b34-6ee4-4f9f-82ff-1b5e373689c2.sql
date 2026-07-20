
-- ============ AFFILIATE PARTNERS ============
CREATE TABLE public.affiliate_partners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text,
  slug text NOT NULL UNIQUE,
  commission_pct numeric NOT NULL DEFAULT 10,
  is_active boolean NOT NULL DEFAULT true,
  stripe_connect_account_id text,
  payouts_enabled boolean NOT NULL DEFAULT false,
  created_by uuid NOT NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.affiliate_partners TO authenticated;
GRANT ALL ON public.affiliate_partners TO service_role;

ALTER TABLE public.affiliate_partners ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Coaches manage partners" ON public.affiliate_partners
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'coach'))
  WITH CHECK (public.has_role(auth.uid(), 'coach'));

CREATE TRIGGER trg_affiliate_partners_updated
  BEFORE UPDATE ON public.affiliate_partners
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ AFFILIATE REFERRALS ============
CREATE TABLE public.affiliate_referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid NOT NULL REFERENCES public.affiliate_partners(id) ON DELETE CASCADE,
  referred_user_id uuid NOT NULL UNIQUE,
  signup_at timestamptz NOT NULL DEFAULT now(),
  source_slug text,
  first_payment_id uuid,
  payment_amount_eur numeric,
  commission_pct numeric,
  commission_amount_eur numeric,
  commission_status text NOT NULL DEFAULT 'pending'
    CHECK (commission_status IN ('pending','payable','paid','void')),
  paid_at timestamptz,
  stripe_transfer_id text,
  payout_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_affiliate_referrals_partner ON public.affiliate_referrals(partner_id);
CREATE INDEX idx_affiliate_referrals_status ON public.affiliate_referrals(commission_status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.affiliate_referrals TO authenticated;
GRANT ALL ON public.affiliate_referrals TO service_role;

ALTER TABLE public.affiliate_referrals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Coaches manage referrals" ON public.affiliate_referrals
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'coach'))
  WITH CHECK (public.has_role(auth.uid(), 'coach'));

CREATE TRIGGER trg_affiliate_referrals_updated
  BEFORE UPDATE ON public.affiliate_referrals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ PROFILES: referred_by ============
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS referred_by_partner_id uuid REFERENCES public.affiliate_partners(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_referred_by ON public.profiles(referred_by_partner_id);

-- ============ FUNCTION: attach_referral ============
CREATE OR REPLACE FUNCTION public.attach_referral(_user_id uuid, _slug text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_partner_id uuid;
BEGIN
  IF _slug IS NULL OR length(trim(_slug)) = 0 THEN RETURN; END IF;
  SELECT id INTO v_partner_id FROM public.affiliate_partners
    WHERE slug = lower(trim(_slug)) AND is_active = true LIMIT 1;
  IF v_partner_id IS NULL THEN RETURN; END IF;

  UPDATE public.profiles
     SET referred_by_partner_id = v_partner_id
   WHERE id = _user_id AND referred_by_partner_id IS NULL;

  INSERT INTO public.affiliate_referrals (partner_id, referred_user_id, source_slug, commission_status)
  VALUES (v_partner_id, _user_id, lower(trim(_slug)), 'pending')
  ON CONFLICT (referred_user_id) DO NOTHING;
END $$;

-- ============ TRIGGER: commission on confirmed payment ============
CREATE OR REPLACE FUNCTION public.affiliate_on_payment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_partner_id uuid;
  v_pct numeric;
  v_existing_paid boolean;
  v_amount numeric;
BEGIN
  IF NEW.status <> 'confirmed' THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = 'confirmed' THEN RETURN NEW; END IF;
  v_amount := COALESCE(NEW.amount_eur, 0);
  IF v_amount <= 0 THEN RETURN NEW; END IF;

  SELECT referred_by_partner_id INTO v_partner_id
    FROM public.profiles WHERE id = NEW.user_id;
  IF v_partner_id IS NULL THEN RETURN NEW; END IF;

  SELECT EXISTS(
    SELECT 1 FROM public.affiliate_referrals
     WHERE referred_user_id = NEW.user_id
       AND commission_status IN ('payable','paid')
  ) INTO v_existing_paid;
  IF v_existing_paid THEN RETURN NEW; END IF;

  SELECT commission_pct INTO v_pct
    FROM public.affiliate_partners WHERE id = v_partner_id;
  v_pct := COALESCE(v_pct, 10);

  INSERT INTO public.affiliate_referrals (
    partner_id, referred_user_id, first_payment_id,
    payment_amount_eur, commission_pct, commission_amount_eur, commission_status
  ) VALUES (
    v_partner_id, NEW.user_id, NEW.id,
    v_amount, v_pct, round((v_amount * v_pct / 100.0)::numeric, 2), 'payable'
  )
  ON CONFLICT (referred_user_id) DO UPDATE SET
    first_payment_id = EXCLUDED.first_payment_id,
    payment_amount_eur = EXCLUDED.payment_amount_eur,
    commission_pct = EXCLUDED.commission_pct,
    commission_amount_eur = EXCLUDED.commission_amount_eur,
    commission_status = 'payable',
    updated_at = now()
  WHERE public.affiliate_referrals.commission_status = 'pending';

  RETURN NEW;
END $$;

CREATE TRIGGER trg_affiliate_on_payment
  AFTER INSERT OR UPDATE ON public.payment_history
  FOR EACH ROW EXECUTE FUNCTION public.affiliate_on_payment();
