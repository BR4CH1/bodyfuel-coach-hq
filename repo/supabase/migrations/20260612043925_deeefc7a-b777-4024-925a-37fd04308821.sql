
CREATE TABLE public.package_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  request_type TEXT NOT NULL CHECK (request_type IN ('renewal','change','contact')),
  current_package TEXT,
  requested_package TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','declined')),
  note TEXT,
  coach_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.package_requests TO authenticated;
GRANT ALL ON public.package_requests TO service_role;

ALTER TABLE public.package_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own requests"
  ON public.package_requests FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'coach'));

CREATE POLICY "Users can insert own requests"
  ON public.package_requests FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Coach can update requests"
  ON public.package_requests FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'coach'))
  WITH CHECK (public.has_role(auth.uid(), 'coach'));

CREATE POLICY "Coach can delete requests"
  ON public.package_requests FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'coach'));

CREATE TRIGGER update_package_requests_updated_at
  BEFORE UPDATE ON public.package_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_package_requests_status ON public.package_requests(status, created_at DESC);
CREATE INDEX idx_package_requests_user ON public.package_requests(user_id, created_at DESC);
