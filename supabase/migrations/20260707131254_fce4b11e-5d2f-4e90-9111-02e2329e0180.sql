REVOKE ALL ON public.affiliate_partners FROM anon;
REVOKE ALL ON public.affiliate_partners FROM PUBLIC;
GRANT ALL ON public.affiliate_partners TO service_role;