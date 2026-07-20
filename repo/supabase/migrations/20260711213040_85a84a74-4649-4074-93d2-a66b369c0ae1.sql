-- payment_history: add WITH CHECK to coach UPDATE policy
DROP POLICY IF EXISTS "coach updates payment" ON public.payment_history;
CREATE POLICY "coach updates payment"
  ON public.payment_history
  FOR UPDATE
  USING (coach_can_access_user(auth.uid(), user_id))
  WITH CHECK (coach_can_access_user(auth.uid(), user_id));

-- progress_photos: restrict DELETE to owner only (coaches must not delete client photos)
DROP POLICY IF EXISTS "progress_photos owner delete" ON public.progress_photos;
CREATE POLICY "progress_photos owner delete"
  ON public.progress_photos
  FOR DELETE
  USING (user_id = auth.uid());
