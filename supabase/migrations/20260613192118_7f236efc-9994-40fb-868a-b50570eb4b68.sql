CREATE TABLE public.app_reviews (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  rating SMALLINT NOT NULL CHECK (rating >= 0 AND rating <= 5),
  comment TEXT,
  publish_with_name BOOLEAN NOT NULL DEFAULT false,
  first_name TEXT,
  approved_for_public BOOLEAN NOT NULL DEFAULT true,
  hidden BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.app_reviews TO authenticated;
GRANT SELECT ON public.app_reviews TO anon;
GRANT ALL ON public.app_reviews TO service_role;

ALTER TABLE public.app_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read published reviews"
  ON public.app_reviews FOR SELECT
  USING (publish_with_name = true AND approved_for_public = true AND hidden = false);

CREATE POLICY "Users can read own review"
  ON public.app_reviews FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Coach can read all reviews"
  ON public.app_reviews FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'coach'));

CREATE POLICY "Users can insert own review"
  ON public.app_reviews FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own review"
  ON public.app_reviews FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Coach can update reviews"
  ON public.app_reviews FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'coach'))
  WITH CHECK (public.has_role(auth.uid(), 'coach'));

CREATE TRIGGER trg_app_reviews_updated_at
  BEFORE UPDATE ON public.app_reviews
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_app_reviews_public ON public.app_reviews(created_at DESC)
  WHERE publish_with_name = true AND approved_for_public = true AND hidden = false;