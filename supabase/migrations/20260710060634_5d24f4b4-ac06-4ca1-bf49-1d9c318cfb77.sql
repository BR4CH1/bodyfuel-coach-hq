
-- Owner-Rolle an Manu vergeben (idempotent)
INSERT INTO public.user_roles (user_id, role)
VALUES ('5d5c808b-0893-45f3-9c1a-fee343df60d9', 'platform_owner'::public.app_role)
ON CONFLICT (user_id, role) DO NOTHING;

-- Policies: Plattform-Owner darf jede Organisation lesen/anlegen/aktualisieren
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='organizations' AND policyname='Platform owners can view all organizations') THEN
    CREATE POLICY "Platform owners can view all organizations"
      ON public.organizations FOR SELECT TO authenticated
      USING (public.has_role(auth.uid(), 'platform_owner'::public.app_role));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='organizations' AND policyname='Platform owners can insert organizations') THEN
    CREATE POLICY "Platform owners can insert organizations"
      ON public.organizations FOR INSERT TO authenticated
      WITH CHECK (public.has_role(auth.uid(), 'platform_owner'::public.app_role));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='organizations' AND policyname='Platform owners can update organizations') THEN
    CREATE POLICY "Platform owners can update organizations"
      ON public.organizations FOR UPDATE TO authenticated
      USING (public.has_role(auth.uid(), 'platform_owner'::public.app_role))
      WITH CHECK (public.has_role(auth.uid(), 'platform_owner'::public.app_role));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='staff_assignments' AND policyname='Platform owners manage staff assignments') THEN
    CREATE POLICY "Platform owners manage staff assignments"
      ON public.staff_assignments FOR ALL TO authenticated
      USING (public.has_role(auth.uid(), 'platform_owner'::public.app_role))
      WITH CHECK (public.has_role(auth.uid(), 'platform_owner'::public.app_role));
  END IF;
END $$;
