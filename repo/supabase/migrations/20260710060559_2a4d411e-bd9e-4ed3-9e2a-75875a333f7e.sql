
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'platform_owner';

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS short_name text,
  ADD COLUMN IF NOT EXISTS sport text,
  ADD COLUMN IF NOT EXISTS accent_color text,
  ADD COLUMN IF NOT EXISTS background_color text,
  ADD COLUMN IF NOT EXISTS text_color text,
  ADD COLUMN IF NOT EXISTS alt_logo_url text,
  ADD COLUMN IF NOT EXISTS claim text;
