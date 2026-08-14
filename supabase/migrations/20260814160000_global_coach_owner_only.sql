-- The global app_role `coach` grants access to the personal BodyFuel coaching
-- workspace across multiple RLS policies. Organization/team coaches use their
-- scoped organization roles instead and must never inherit global customer access.
--
-- Reserve the global coach role for the verified BodyFuel owner account.

do $$
begin
  if exists (
    select 1
    from public.user_roles
    where role = 'coach'::public.app_role
      and user_id <> '5d5c808b-0893-45f3-9c1a-fee343df60d9'::uuid
  ) then
    raise exception 'Cannot enforce BodyFuel owner-only coach role: unexpected global coach account exists';
  end if;
end
$$;

alter table public.user_roles
  drop constraint if exists user_roles_global_coach_owner_only;

alter table public.user_roles
  add constraint user_roles_global_coach_owner_only
  check (
    role <> 'coach'::public.app_role
    or user_id = '5d5c808b-0893-45f3-9c1a-fee343df60d9'::uuid
  );

comment on constraint user_roles_global_coach_owner_only on public.user_roles is
  'Global BodyFuel coach access is reserved for the verified owner account; organization coaches use scoped org roles.';
