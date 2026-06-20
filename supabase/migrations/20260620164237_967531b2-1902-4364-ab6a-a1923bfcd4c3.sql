-- 1) CHECK-Constraint erweitern um 'smart' (und auch nicht-aktive Pakete dulden)
ALTER TABLE public.customer_packages
  DROP CONSTRAINT IF EXISTS customer_packages_package_check;
ALTER TABLE public.customer_packages
  ADD CONSTRAINT customer_packages_package_check
  CHECK (package IN ('starter','coaching','premium','smart'));

-- 2) Defaults für die Self-Service-Insert-Pfade
ALTER TABLE public.customer_packages
  ALTER COLUMN price_eur SET DEFAULT 0,
  ALTER COLUMN end_date  DROP NOT NULL;

-- 3) Quelle und Status-Spalten (idempotent)
ALTER TABLE public.customer_packages
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS ended_at TIMESTAMPTZ;

-- 4) Webhook-Upsert: braucht eindeutigen Schlüssel je Nutzer+Paket
CREATE UNIQUE INDEX IF NOT EXISTS customer_packages_user_pkg_uidx
  ON public.customer_packages (user_id, package);

-- 5) Nutzer dürfen ihr Smart-Self-Service-Abo selbst anlegen/aktualisieren
DROP POLICY IF EXISTS "user self-service smart insert" ON public.customer_packages;
CREATE POLICY "user self-service smart insert"
  ON public.customer_packages FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND package = 'smart');
DROP POLICY IF EXISTS "user self-service smart update" ON public.customer_packages;
CREATE POLICY "user self-service smart update"
  ON public.customer_packages FOR UPDATE TO authenticated
  USING (user_id = auth.uid() AND package = 'smart')
  WITH CHECK (user_id = auth.uid() AND package = 'smart');