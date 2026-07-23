
ALTER TABLE public.user_roles DISABLE TRIGGER USER;
ALTER TABLE public.organization_memberships DISABLE TRIGGER USER;

DELETE FROM public.user_roles
 WHERE user_id = '3c05d81b-f4db-47e8-81be-053a07cb4f20'
   AND role = 'coach';

UPDATE public.organization_memberships
   SET role = 'athlete'
 WHERE user_id = '3c05d81b-f4db-47e8-81be-053a07cb4f20'
   AND role <> 'athlete';

DELETE FROM public.staff_assignments
 WHERE user_id = '3c05d81b-f4db-47e8-81be-053a07cb4f20';

ALTER TABLE public.user_roles ENABLE TRIGGER USER;
ALTER TABLE public.organization_memberships ENABLE TRIGGER USER;
