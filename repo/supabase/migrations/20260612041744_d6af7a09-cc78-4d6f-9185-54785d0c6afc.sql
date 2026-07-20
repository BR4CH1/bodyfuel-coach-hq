ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS coaching_goal TEXT,
  ADD COLUMN IF NOT EXISTS checkin_reminder BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notifications_enabled BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS next_checkin_date DATE;