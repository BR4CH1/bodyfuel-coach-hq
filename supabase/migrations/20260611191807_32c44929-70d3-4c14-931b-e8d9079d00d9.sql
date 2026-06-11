
-- Drop alte bookings (war Teil des entfernten PayPal-Flows)
DROP TABLE IF EXISTS public.bookings CASCADE;

-- profiles: phone hinzufügen
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone TEXT;

-- customer_packages: ein aktives Paket pro Kunde mit indiv. Preis
CREATE TABLE public.customer_packages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  package TEXT NOT NULL CHECK (package IN ('starter','coaching','premium')),
  price_eur NUMERIC(10,2) NOT NULL,
  start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  end_date DATE NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_packages TO authenticated;
GRANT ALL ON public.customer_packages TO service_role;
ALTER TABLE public.customer_packages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "customer reads own package" ON public.customer_packages FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'coach'));
CREATE POLICY "coach inserts package" ON public.customer_packages FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'coach'));
CREATE POLICY "coach updates package" ON public.customer_packages FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'coach')) WITH CHECK (public.has_role(auth.uid(),'coach'));
CREATE POLICY "coach deletes package" ON public.customer_packages FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'coach'));
CREATE TRIGGER cp_updated_at BEFORE UPDATE ON public.customer_packages
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX cp_user_active_idx ON public.customer_packages(user_id, is_active);

-- payment_history
CREATE TABLE public.payment_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  customer_package_id UUID REFERENCES public.customer_packages(id) ON DELETE SET NULL,
  amount_eur NUMERIC(10,2) NOT NULL,
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  method TEXT NOT NULL DEFAULT 'paypal_me' CHECK (method IN ('paypal_me','bank','cash','other')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','confirmed','cancelled')),
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payment_history TO authenticated;
GRANT ALL ON public.payment_history TO service_role;
ALTER TABLE public.payment_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user reads own payments" ON public.payment_history FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'coach'));
CREATE POLICY "user inserts own pending payment" ON public.payment_history FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() OR public.has_role(auth.uid(),'coach'));
CREATE POLICY "coach updates payment" ON public.payment_history FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'coach')) WITH CHECK (public.has_role(auth.uid(),'coach'));
CREATE POLICY "coach deletes payment" ON public.payment_history FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'coach'));
CREATE TRIGGER ph_updated_at BEFORE UPDATE ON public.payment_history
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX ph_user_idx ON public.payment_history(user_id, payment_date DESC);

-- leads: Erstgespräch-Anfragen
CREATE TABLE public.leads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  goal TEXT,
  current_weight TEXT,
  desired_package TEXT CHECK (desired_package IN ('starter','coaching','premium','unsure')),
  message TEXT,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new','contacted','converted','declined')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.leads TO authenticated;
GRANT INSERT ON public.leads TO anon;
GRANT ALL ON public.leads TO service_role;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anyone creates lead" ON public.leads FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "coach reads leads" ON public.leads FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'coach'));
CREATE POLICY "coach updates leads" ON public.leads FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'coach')) WITH CHECK (public.has_role(auth.uid(),'coach'));
CREATE POLICY "coach deletes leads" ON public.leads FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'coach'));
CREATE TRIGGER leads_updated_at BEFORE UPDATE ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
