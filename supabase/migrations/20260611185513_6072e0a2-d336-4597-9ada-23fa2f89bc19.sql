
CREATE TABLE public.bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text NOT NULL,
  phone text,
  package text NOT NULL,
  price_eur numeric(10,2) NOT NULL,
  payment_status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT INSERT ON public.bookings TO anon;
GRANT INSERT ON public.bookings TO authenticated;
GRANT SELECT, UPDATE ON public.bookings TO authenticated;
GRANT ALL ON public.bookings TO service_role;

ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anyone can create booking" ON public.bookings
  FOR INSERT TO anon, authenticated WITH CHECK (true);

CREATE POLICY "coach reads bookings" ON public.bookings
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'coach'::public.app_role));

CREATE POLICY "coach updates bookings" ON public.bookings
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'coach'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'coach'::public.app_role));

CREATE TRIGGER bookings_set_updated_at
  BEFORE UPDATE ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
