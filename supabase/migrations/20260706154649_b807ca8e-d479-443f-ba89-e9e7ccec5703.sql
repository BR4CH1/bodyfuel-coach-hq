
-- Staff invite: permission-set persistence + default expiry + email-lookup helpers
ALTER TABLE public.organization_invites
  ADD COLUMN IF NOT EXISTS permissions text[] NOT NULL DEFAULT '{}';

ALTER TABLE public.organization_invites
  ALTER COLUMN expires_at SET DEFAULT (now() + interval '14 days');

UPDATE public.organization_invites
  SET expires_at = created_at + interval '14 days'
  WHERE expires_at IS NULL;

-- SECURITY DEFINER lookup: caller must be platform coach OR org admin OR have manage_members
CREATE OR REPLACE FUNCTION public.find_user_id_by_email(_email text)
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid;
  _caller uuid := auth.uid();
  _authorized boolean := false;
BEGIN
  IF _caller IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT public.has_role(_caller, 'coach'::app_role) INTO _authorized;

  IF NOT _authorized THEN
    SELECT EXISTS (
      SELECT 1 FROM public.staff_assignments
      WHERE user_id = _caller
    ) INTO _authorized;
  END IF;

  IF NOT _authorized THEN
    RETURN NULL;
  END IF;

  SELECT id INTO _uid FROM auth.users WHERE lower(email) = lower(_email) LIMIT 1;
  RETURN _uid;
END;
$$;

REVOKE ALL ON FUNCTION public.find_user_id_by_email(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.find_user_id_by_email(text) TO authenticated, service_role;

-- Accept a staff invite: converts invite → staff_assignment for the caller
CREATE OR REPLACE FUNCTION public.accept_organization_invite(_token text, _user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _inv public.organization_invites%ROWTYPE;
BEGIN
  IF _user_id IS NULL OR _user_id <> auth.uid() THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  SELECT * INTO _inv FROM public.organization_invites
  WHERE invite_token = _token
    AND status = 'pending'
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'invite not found or already used';
  END IF;

  IF _inv.expires_at IS NOT NULL AND _inv.expires_at < now() THEN
    UPDATE public.organization_invites
      SET status = 'expired', updated_at = now()
      WHERE id = _inv.id;
    RAISE EXCEPTION 'invite expired';
  END IF;

  INSERT INTO public.staff_assignments (user_id, organization_id, team_id, role, permissions)
  VALUES (_user_id, _inv.organization_id, _inv.team_id, _inv.assigned_role, COALESCE(_inv.permissions, '{}'))
  ON CONFLICT (user_id, organization_id, team_id) DO UPDATE
    SET role = EXCLUDED.role,
        permissions = EXCLUDED.permissions;

  UPDATE public.organization_invites
    SET status = 'accepted',
        accepted_by = _user_id,
        accepted_at = now(),
        updated_at = now()
    WHERE id = _inv.id;

  RETURN jsonb_build_object(
    'organization_id', _inv.organization_id,
    'team_id', _inv.team_id,
    'role', _inv.assigned_role
  );
END;
$$;

REVOKE ALL ON FUNCTION public.accept_organization_invite(text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.accept_organization_invite(text, uuid) TO authenticated, service_role;
