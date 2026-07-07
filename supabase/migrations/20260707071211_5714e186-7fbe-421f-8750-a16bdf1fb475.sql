-- Restore narrow anonymous read access on organizations for the public
-- landing pages / invite links. Only rows with status='active' are exposed,
-- and only the safe branding columns are ever queried by the server
-- publishable client (name, slug, logo_url, primary_color, ...).
GRANT SELECT ON public.organizations TO anon;

DROP POLICY IF EXISTS "orgs anon read active" ON public.organizations;
CREATE POLICY "orgs anon read active"
ON public.organizations
FOR SELECT
TO anon
USING (status = 'active');