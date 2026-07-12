ALTER TABLE public.player_cards
  ADD COLUMN IF NOT EXISTS manual_overrides jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS is_published boolean NOT NULL DEFAULT false;

DROP POLICY IF EXISTS "player cards coach update" ON public.player_cards;
CREATE POLICY "player cards coach update"
  ON public.player_cards FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'platform_owner'::app_role)
    OR public.has_role(auth.uid(), 'coach'::app_role)
    OR (
      organization_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.organization_memberships om
        WHERE om.organization_id = player_cards.organization_id
          AND om.user_id = auth.uid()
          AND om.role IN ('organization_admin','coach','staff')
      )
    )
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'platform_owner'::app_role)
    OR public.has_role(auth.uid(), 'coach'::app_role)
    OR (
      organization_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.organization_memberships om
        WHERE om.organization_id = player_cards.organization_id
          AND om.user_id = auth.uid()
          AND om.role IN ('organization_admin','coach','staff')
      )
    )
  );

GRANT UPDATE ON public.player_cards TO authenticated;