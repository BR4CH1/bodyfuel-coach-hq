
-- Fix 1: Staff invite hijack — require email match
CREATE OR REPLACE FUNCTION public.accept_organization_invite(_token text, _user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _inv public.organization_invites%ROWTYPE;
  _caller_email text;
BEGIN
  IF _user_id IS NULL OR _user_id <> auth.uid() THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  SELECT lower(email) INTO _caller_email FROM auth.users WHERE id = _user_id;
  IF _caller_email IS NULL THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  SELECT * INTO _inv FROM public.organization_invites
  WHERE invite_token = _token
    AND status = 'pending'
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'invite not found or already used';
  END IF;

  IF _inv.email IS NULL OR lower(_inv.email) <> _caller_email THEN
    RAISE EXCEPTION 'invite email mismatch';
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
$function$;

-- Fix 2: security_invoker on foods_search view
ALTER VIEW public.foods_search SET (security_invoker = true);
