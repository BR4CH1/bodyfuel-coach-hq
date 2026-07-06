-- Phase A: Vereinsleitung/Staff aus organization_memberships in staff_assignments
-- verschieben und Memberships auf 'member' normalisieren. Idempotent.

-- 1) Backfill staff_assignments für alle Nicht-Athleten-Memberships.
INSERT INTO public.staff_assignments (user_id, organization_id, team_id, role, permissions)
SELECT
  m.user_id,
  m.organization_id,
  NULL::uuid,
  m.role,  -- organization_role -> organization_role (kein Cast nötig)
  COALESCE(
    (
      SELECT i.permissions
      FROM public.organization_invites i
      WHERE i.accepted_by = m.user_id
        AND i.organization_id = m.organization_id
        AND i.status = 'accepted'
        AND i.assigned_role = m.role
      ORDER BY i.accepted_at DESC NULLS LAST
      LIMIT 1
    ),
    CASE m.role::text
      WHEN 'organization_admin' THEN ARRAY[
        'view_members','manage_members',
        'view_training','manage_training',
        'view_performance','manage_performance',
        'view_checkins','view_nutrition',
        'manage_challenges','manage_ranking',
        'manage_community','manage_staff','manage_organization'
      ]
      WHEN 'coach' THEN ARRAY[
        'view_members','view_training','manage_training',
        'view_checkins','manage_challenges','manage_community'
      ]
      WHEN 'staff'  THEN ARRAY['view_members']
      WHEN 'member' THEN ARRAY['view_members']
      ELSE ARRAY[]::text[]
    END
  )
FROM public.organization_memberships m
WHERE m.role::text IN ('organization_admin','coach','staff','member')
  AND NOT EXISTS (
    SELECT 1 FROM public.staff_assignments s
    WHERE s.user_id = m.user_id
      AND s.organization_id = m.organization_id
      AND s.team_id IS NULL
  );

-- 2) Memberships mit Staff-Rollen auf 'member' normalisieren (nicht löschen —
--    Zugehörigkeit / Community / RLS bleibt erhalten). 'member' wird von
--    deriveOrgRole NIE als Athlet interpretiert.
UPDATE public.organization_memberships
SET role = 'member'::organization_role
WHERE role::text IN ('organization_admin','coach','staff');
