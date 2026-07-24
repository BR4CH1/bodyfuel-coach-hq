-- Remove broad public SELECT policy on storage.objects for meal-images.
-- Public bucket serves files directly via public URL; SELECT policy only enables listing.
DROP POLICY IF EXISTS "meal images public read" ON storage.objects;