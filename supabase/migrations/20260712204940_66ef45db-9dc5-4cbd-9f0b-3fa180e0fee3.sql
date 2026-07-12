ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_cutout_url TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_cutout_source TEXT;