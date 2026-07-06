
-- =====================================================================
-- Multi-Organization foundation
-- =====================================================================

-- ---------- Enums ----------
DO $$ BEGIN
  CREATE TYPE public.organization_type AS ENUM ('sports_club','team','gym','company','other');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.organization_status AS ENUM ('active','inactive','archived');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.organization_team_status AS ENUM ('active','inactive','archived');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.organization_role AS ENUM ('athlete','member','staff','coach','organization_admin');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.organization_membership_status AS ENUM ('active','invited','inactive','removed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.team_membership_status AS ENUM ('active','inactive','removed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.organization_invite_status AS ENUM ('pending','accepted','expired','revoked');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------- Reserved slugs ----------
CREATE OR REPLACE FUNCTION public.organizations_validate_slug()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = 'public'
AS $$
DECLARE
  reserved text[] := ARRAY[
    'auth','login','logout','dashboard','nutrition','training','messages','community',
    'profile','coach','admin','tracker','smart','ranking','achievements','checkout',
    'impressum','datenschutz','trust','welcome','api','app','mcp','lovable','well-known',
    'onboarding','measurements','progress','strength-check','check-in','training-import',
    'daily-checklist','unsubscribe','guardian-consent','org','organizations','teams',
    'staff','invite','invites','settings','account','notifications','support','help',
    'about','pricing','contact','signup','signin','register'
  ];
BEGIN
  IF NEW.slug IS NULL OR length(trim(NEW.slug)) = 0 THEN
    RAISE EXCEPTION 'Slug darf nicht leer sein.' USING ERRCODE = '22023';
  END IF;
  NEW.slug := lower(trim(NEW.slug));
  IF NEW.slug !~ '^[a-z0-9][a-z0-9-]{1,49}$' THEN
    RAISE EXCEPTION 'Ungültiger Slug: %. Nur a-z, 0-9 und - erlaubt (2–50 Zeichen).', NEW.slug USING ERRCODE = '22023';
  END IF;
  IF NEW.slug = ANY(reserved) THEN
    RAISE EXCEPTION 'Slug "%" ist reserviert.', NEW.slug USING ERRCODE = '22023';
  END IF;
  RETURN NEW;
END;
$$;

-- ---------- Tables ----------

-- organizations
CREATE TABLE IF NOT EXISTS public.organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  organization_type public.organization_type NOT NULL DEFAULT 'sports_club',
  logo_url text,
  primary_color text,
  secondary_color text,
  status public.organization_status NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.organizations TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.organizations TO authenticated;
GRANT ALL ON public.organizations TO service_role;
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER trg_organizations_slug BEFORE INSERT OR UPDATE OF slug ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.organizations_validate_slug();
CREATE TRIGGER trg_organizations_updated_at BEFORE UPDATE ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- organization_teams
CREATE TABLE IF NOT EXISTS public.organization_teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  slug text NOT NULL,
  sport text,
  age_group text,
  status public.organization_team_status NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, slug)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.organization_teams TO authenticated;
GRANT ALL ON public.organization_teams TO service_role;
ALTER TABLE public.organization_teams ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_organization_teams_updated_at BEFORE UPDATE ON public.organization_teams
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- organization_memberships
CREATE TABLE IF NOT EXISTS public.organization_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  role public.organization_role NOT NULL DEFAULT 'athlete',
  status public.organization_membership_status NOT NULL DEFAULT 'active',
  onboarding_completed boolean NOT NULL DEFAULT false,
  joined_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, organization_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.organization_memberships TO authenticated;
GRANT ALL ON public.organization_memberships TO service_role;
ALTER TABLE public.organization_memberships ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_organization_memberships_updated_at BEFORE UPDATE ON public.organization_memberships
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX IF NOT EXISTS idx_org_memberships_user ON public.organization_memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_org_memberships_org  ON public.organization_memberships(organization_id);

-- team_memberships
CREATE TABLE IF NOT EXISTS public.team_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  team_id uuid NOT NULL REFERENCES public.organization_teams(id) ON DELETE CASCADE,
  position text,
  secondary_position text,
  jersey_number int,
  status public.team_membership_status NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, team_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.team_memberships TO authenticated;
GRANT ALL ON public.team_memberships TO service_role;
ALTER TABLE public.team_memberships ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_team_memberships_updated_at BEFORE UPDATE ON public.team_memberships
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- organization_invites
CREATE TABLE IF NOT EXISTS public.organization_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  team_id uuid REFERENCES public.organization_teams(id) ON DELETE SET NULL,
  email text,
  assigned_role public.organization_role NOT NULL DEFAULT 'athlete',
  invite_token text NOT NULL UNIQUE,
  expires_at timestamptz,
  status public.organization_invite_status NOT NULL DEFAULT 'pending',
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  accepted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  accepted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.organization_invites TO authenticated;
GRANT ALL ON public.organization_invites TO service_role;
ALTER TABLE public.organization_invites ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_organization_invites_updated_at BEFORE UPDATE ON public.organization_invites
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- staff_assignments
CREATE TABLE IF NOT EXISTS public.staff_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  team_id uuid REFERENCES public.organization_teams(id) ON DELETE CASCADE,
  role public.organization_role NOT NULL DEFAULT 'staff',
  permissions text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_staff_assignments_scope
  ON public.staff_assignments(user_id, organization_id, COALESCE(team_id, '00000000-0000-0000-0000-000000000000'::uuid));
GRANT SELECT, INSERT, UPDATE, DELETE ON public.staff_assignments TO authenticated;
GRANT ALL ON public.staff_assignments TO service_role;
ALTER TABLE public.staff_assignments ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_staff_assignments_updated_at BEFORE UPDATE ON public.staff_assignments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- organization_features
CREATE TABLE IF NOT EXISTS public.organization_features (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  feature text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, feature)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.organization_features TO authenticated;
GRANT ALL ON public.organization_features TO service_role;
ALTER TABLE public.organization_features ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_organization_features_updated_at BEFORE UPDATE ON public.organization_features
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ---------- Security definer helpers ----------
CREATE OR REPLACE FUNCTION public.is_org_member(_user uuid, _org uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_memberships
    WHERE user_id = _user AND organization_id = _org AND status = 'active'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_org_staff(_user uuid, _org uuid, _permission text DEFAULT NULL)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.staff_assignments s
    WHERE s.user_id = _user
      AND s.organization_id = _org
      AND (_permission IS NULL OR _permission = ANY(s.permissions) OR s.role IN ('organization_admin','coach'))
  );
$$;

CREATE OR REPLACE FUNCTION public.is_org_admin(_user uuid, _org uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT
    public.has_role(_user, 'coach'::public.app_role)
    OR EXISTS (
      SELECT 1 FROM public.staff_assignments
      WHERE user_id = _user AND organization_id = _org
        AND role IN ('organization_admin','coach')
    );
$$;

-- ---------- Policies ----------

-- organizations
CREATE POLICY "orgs public read active"
  ON public.organizations FOR SELECT
  TO anon
  USING (status = 'active');

CREATE POLICY "orgs authenticated read"
  ON public.organizations FOR SELECT
  TO authenticated
  USING (
    status = 'active'
    OR public.has_role(auth.uid(), 'coach'::public.app_role)
    OR public.is_org_member(auth.uid(), id)
    OR public.is_org_admin(auth.uid(), id)
  );

CREATE POLICY "orgs super admin manage"
  ON public.organizations FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'coach'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'coach'::public.app_role));

CREATE POLICY "orgs admin update"
  ON public.organizations FOR UPDATE
  TO authenticated
  USING (public.is_org_admin(auth.uid(), id))
  WITH CHECK (public.is_org_admin(auth.uid(), id));

-- organization_teams
CREATE POLICY "org teams read for members and staff"
  ON public.organization_teams FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'coach'::public.app_role)
    OR public.is_org_member(auth.uid(), organization_id)
    OR public.is_org_staff(auth.uid(), organization_id, NULL)
  );

CREATE POLICY "org teams manage admin"
  ON public.organization_teams FOR ALL
  TO authenticated
  USING (public.is_org_admin(auth.uid(), organization_id))
  WITH CHECK (public.is_org_admin(auth.uid(), organization_id));

-- organization_memberships
CREATE POLICY "org memberships read own or staff"
  ON public.organization_memberships FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR public.has_role(auth.uid(), 'coach'::public.app_role)
    OR public.is_org_staff(auth.uid(), organization_id, 'view_members')
    OR public.is_org_admin(auth.uid(), organization_id)
  );

CREATE POLICY "org memberships update own onboarding"
  ON public.organization_memberships FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "org memberships manage by admin"
  ON public.organization_memberships FOR ALL
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'coach'::public.app_role)
    OR public.is_org_admin(auth.uid(), organization_id)
    OR public.is_org_staff(auth.uid(), organization_id, 'manage_members')
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'coach'::public.app_role)
    OR public.is_org_admin(auth.uid(), organization_id)
    OR public.is_org_staff(auth.uid(), organization_id, 'manage_members')
  );

-- team_memberships
CREATE POLICY "team memberships read own or staff"
  ON public.team_memberships FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR public.has_role(auth.uid(), 'coach'::public.app_role)
    OR EXISTS (
      SELECT 1 FROM public.organization_teams t
      WHERE t.id = team_id
        AND (
          public.is_org_admin(auth.uid(), t.organization_id)
          OR public.is_org_staff(auth.uid(), t.organization_id, 'view_members')
        )
    )
  );

CREATE POLICY "team memberships manage own"
  ON public.team_memberships FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "team memberships manage by admin"
  ON public.team_memberships FOR ALL
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'coach'::public.app_role)
    OR EXISTS (
      SELECT 1 FROM public.organization_teams t
      WHERE t.id = team_id
        AND (
          public.is_org_admin(auth.uid(), t.organization_id)
          OR public.is_org_staff(auth.uid(), t.organization_id, 'manage_members')
        )
    )
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'coach'::public.app_role)
    OR EXISTS (
      SELECT 1 FROM public.organization_teams t
      WHERE t.id = team_id
        AND (
          public.is_org_admin(auth.uid(), t.organization_id)
          OR public.is_org_staff(auth.uid(), t.organization_id, 'manage_members')
        )
    )
  );

-- organization_invites — only staff sees full row (with token). Redemption via server function.
CREATE POLICY "org invites staff read"
  ON public.organization_invites FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'coach'::public.app_role)
    OR public.is_org_admin(auth.uid(), organization_id)
    OR public.is_org_staff(auth.uid(), organization_id, 'manage_members')
  );

CREATE POLICY "org invites staff manage"
  ON public.organization_invites FOR ALL
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'coach'::public.app_role)
    OR public.is_org_admin(auth.uid(), organization_id)
    OR public.is_org_staff(auth.uid(), organization_id, 'manage_members')
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'coach'::public.app_role)
    OR public.is_org_admin(auth.uid(), organization_id)
    OR public.is_org_staff(auth.uid(), organization_id, 'manage_members')
  );

-- staff_assignments
CREATE POLICY "staff read own or admin"
  ON public.staff_assignments FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR public.has_role(auth.uid(), 'coach'::public.app_role)
    OR public.is_org_admin(auth.uid(), organization_id)
  );

CREATE POLICY "staff manage admin"
  ON public.staff_assignments FOR ALL
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'coach'::public.app_role)
    OR public.is_org_admin(auth.uid(), organization_id)
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'coach'::public.app_role)
    OR public.is_org_admin(auth.uid(), organization_id)
  );

-- organization_features
CREATE POLICY "org features read"
  ON public.organization_features FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'coach'::public.app_role)
    OR public.is_org_member(auth.uid(), organization_id)
    OR public.is_org_staff(auth.uid(), organization_id, NULL)
  );

CREATE POLICY "org features manage admin"
  ON public.organization_features FOR ALL
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'coach'::public.app_role)
    OR public.is_org_admin(auth.uid(), organization_id)
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'coach'::public.app_role)
    OR public.is_org_admin(auth.uid(), organization_id)
  );

-- ---------- Bulls bootstrap ----------
DO $$
DECLARE
  v_org uuid;
  v_team uuid;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.organizations WHERE slug = 'bulls') THEN
    INSERT INTO public.organizations (name, slug, organization_type, primary_color, secondary_color, status)
    VALUES ('Coesfeld Bulls', 'bulls', 'sports_club', '#c8102e', '#111111', 'active')
    RETURNING id INTO v_org;
  ELSE
    SELECT id INTO v_org FROM public.organizations WHERE slug = 'bulls';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.organization_teams WHERE organization_id = v_org AND slug = 'seniors') THEN
    INSERT INTO public.organization_teams (organization_id, name, slug, sport, status)
    VALUES (v_org, 'Seniors', 'seniors', 'football', 'active')
    RETURNING id INTO v_team;
  ELSE
    SELECT id INTO v_team FROM public.organization_teams WHERE organization_id = v_org AND slug = 'seniors';
  END IF;

  INSERT INTO public.organization_features (organization_id, feature, enabled)
  VALUES
    (v_org, 'training', true),
    (v_org, 'nutrition', true),
    (v_org, 'performance', true),
    (v_org, 'ranking', true),
    (v_org, 'community', true),
    (v_org, 'checkins', true)
  ON CONFLICT (organization_id, feature) DO NOTHING;

  -- Backfill memberships from existing user_groups='bulls'
  INSERT INTO public.organization_memberships (user_id, organization_id, role, status, onboarding_completed)
  SELECT ug.user_id, v_org, 'athlete', 'active',
         EXISTS (SELECT 1 FROM public.bulls_profiles bp WHERE bp.user_id = ug.user_id)
  FROM public.user_groups ug
  WHERE ug.group_name = 'bulls'
  ON CONFLICT (user_id, organization_id) DO NOTHING;
END $$;
