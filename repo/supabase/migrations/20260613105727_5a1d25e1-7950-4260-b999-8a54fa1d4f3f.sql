
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS trial_status text NOT NULL DEFAULT 'none'
    CHECK (trial_status IN ('none','trial','trial_expired','active')),
  ADD COLUMN IF NOT EXISTS trial_start date,
  ADD COLUMN IF NOT EXISTS trial_end date;

-- Bestehende Kunden mit aktivem Paket = active
UPDATE public.profiles p
SET trial_status = 'active'
WHERE trial_status = 'none'
  AND EXISTS (
    SELECT 1 FROM public.customer_packages cp
    WHERE cp.user_id = p.id AND cp.is_active = true
  );

CREATE INDEX IF NOT EXISTS profiles_trial_status_idx ON public.profiles(trial_status);
CREATE INDEX IF NOT EXISTS profiles_trial_end_idx ON public.profiles(trial_end);
