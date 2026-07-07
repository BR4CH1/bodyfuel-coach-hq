REVOKE SELECT, INSERT, UPDATE, DELETE ON public.affiliate_partners FROM authenticated;

DROP POLICY IF EXISTS "Coaches manage partners" ON public.affiliate_partners;
DROP POLICY IF EXISTS "Coaches manage own partners" ON public.affiliate_partners;