
-- 1. Remove privilege-escalation paths on customer_packages
DROP POLICY IF EXISTS "user self-service smart insert" ON public.customer_packages;
DROP POLICY IF EXISTS "user self-service smart update" ON public.customer_packages;

-- 2. Restrict payment_history user inserts to pending payments only
DROP POLICY IF EXISTS "user inserts own pending payment" ON public.payment_history;

CREATE POLICY "user inserts own pending payment"
  ON public.payment_history
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND status = 'pending'
    AND amount_eur > 0
  );

CREATE POLICY "coach inserts payment"
  ON public.payment_history
  FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'coach'::public.app_role));
