DO $$
DECLARE v_user uuid := '3c05d81b-f4db-47e8-81be-053a07cb4f20';
BEGIN
  ALTER TABLE public.organization_memberships DISABLE TRIGGER USER;
  UPDATE public.organization_memberships SET role = 'coach' WHERE user_id = v_user;
  ALTER TABLE public.organization_memberships ENABLE TRIGGER USER;
  INSERT INTO public.user_roles (user_id, role) VALUES (v_user, 'coach')
  ON CONFLICT (user_id, role) DO NOTHING;
END $$;