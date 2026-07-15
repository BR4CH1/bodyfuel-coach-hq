
ALTER TABLE public.player_cards
  ADD COLUMN IF NOT EXISTS custom_card_image_url TEXT;

-- Storage RLS on storage.objects for the private "player-card-images" bucket.
-- Path convention enforced by app: "<user_id>/<filename>"

DROP POLICY IF EXISTS "pci: athlete reads own" ON storage.objects;
CREATE POLICY "pci: athlete reads own"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'player-card-images'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "pci: coach reads all" ON storage.objects;
CREATE POLICY "pci: coach reads all"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'player-card-images'
  AND (
    public.has_role(auth.uid(), 'coach')
    OR EXISTS (SELECT 1 FROM public.organization_memberships m WHERE m.user_id = auth.uid() AND m.status = 'active' AND m.role = 'organization_admin')
    OR EXISTS (SELECT 1 FROM public.staff_assignments s WHERE s.user_id = auth.uid() AND s.role IN ('coach','organization_admin'))
  )
);

DROP POLICY IF EXISTS "pci: coach inserts" ON storage.objects;
CREATE POLICY "pci: coach inserts"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'player-card-images'
  AND (
    public.has_role(auth.uid(), 'coach')
    OR EXISTS (SELECT 1 FROM public.organization_memberships m WHERE m.user_id = auth.uid() AND m.status = 'active' AND m.role = 'organization_admin')
    OR EXISTS (SELECT 1 FROM public.staff_assignments s WHERE s.user_id = auth.uid() AND s.role IN ('coach','organization_admin'))
  )
);

DROP POLICY IF EXISTS "pci: coach updates" ON storage.objects;
CREATE POLICY "pci: coach updates"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'player-card-images'
  AND (
    public.has_role(auth.uid(), 'coach')
    OR EXISTS (SELECT 1 FROM public.organization_memberships m WHERE m.user_id = auth.uid() AND m.status = 'active' AND m.role = 'organization_admin')
    OR EXISTS (SELECT 1 FROM public.staff_assignments s WHERE s.user_id = auth.uid() AND s.role IN ('coach','organization_admin'))
  )
);

DROP POLICY IF EXISTS "pci: coach deletes" ON storage.objects;
CREATE POLICY "pci: coach deletes"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'player-card-images'
  AND (
    public.has_role(auth.uid(), 'coach')
    OR EXISTS (SELECT 1 FROM public.organization_memberships m WHERE m.user_id = auth.uid() AND m.status = 'active' AND m.role = 'organization_admin')
    OR EXISTS (SELECT 1 FROM public.staff_assignments s WHERE s.user_id = auth.uid() AND s.role IN ('coach','organization_admin'))
  )
);
