-- Hubs catalog for gift links (Smart, Bulls, future providers)
CREATE TABLE IF NOT EXISTS public.gift_hubs (
  code text PRIMARY KEY,
  label text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('smart','group')),
  group_name text,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 100,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT gift_hubs_group_requires_name CHECK (
    (kind = 'group' AND group_name IS NOT NULL) OR (kind <> 'group')
  )
);

GRANT SELECT ON public.gift_hubs TO authenticated;
GRANT ALL ON public.gift_hubs TO service_role;
ALTER TABLE public.gift_hubs ENABLE ROW LEVEL SECURITY;

-- Any signed-in coach can read; managed via service_role / migrations
CREATE POLICY "Authenticated read gift_hubs"
  ON public.gift_hubs FOR SELECT TO authenticated
  USING (is_active = true OR public.has_role(auth.uid(), 'coach'));

-- Seed initial hubs
INSERT INTO public.gift_hubs (code, label, kind, group_name, description, sort_order)
VALUES
  ('smart', 'BodyFuel Smart', 'smart', NULL, 'Smart-Paket (KI Ernährungsplan, Tracking)', 10),
  ('bulls', 'Bulls Hub', 'group', 'bulls', 'Exklusiver Bulls-Bereich', 20)
ON CONFLICT (code) DO NOTHING;

-- Link gift codes to a hub (default smart for backward compatibility)
ALTER TABLE public.smart_gift_codes
  ADD COLUMN IF NOT EXISTS hub_code text NOT NULL DEFAULT 'smart'
  REFERENCES public.gift_hubs(code) ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS smart_gift_codes_hub_idx ON public.smart_gift_codes(hub_code);
