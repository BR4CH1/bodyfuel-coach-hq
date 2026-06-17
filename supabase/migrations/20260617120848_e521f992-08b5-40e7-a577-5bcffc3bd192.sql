
-- 1. Add 'free' to app_role enum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
                 WHERE t.typname = 'app_role' AND e.enumlabel = 'free') THEN
    ALTER TYPE public.app_role ADD VALUE 'free';
  END IF;
END $$;

-- 2. Update handle_new_user
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  chosen_role public.app_role;
  chosen_key TEXT;
  chosen_tier TEXT;
BEGIN
  chosen_tier := NEW.raw_user_meta_data->>'tier';
  IF chosen_tier = 'free' THEN
    chosen_role := 'free'::public.app_role;
  ELSE
    chosen_role := COALESCE((NEW.raw_user_meta_data->>'role')::public.app_role, 'client');
  END IF;

  chosen_key := NEW.raw_user_meta_data->>'demo_client_key';

  INSERT INTO public.profiles (id, display_name, demo_client_key)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)),
    chosen_key
  );

  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, chosen_role);

  RETURN NEW;
END;
$function$;

-- 3. activity_logs
CREATE TABLE IF NOT EXISTS public.activity_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  log_date DATE NOT NULL DEFAULT CURRENT_DATE,
  steps INTEGER,
  training_done BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, log_date)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.activity_logs TO authenticated;
GRANT ALL ON public.activity_logs TO service_role;

ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "activity_logs self all"
  ON public.activity_logs FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "activity_logs coaches read"
  ON public.activity_logs FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'coach'));

CREATE TRIGGER trg_activity_logs_updated
  BEFORE UPDATE ON public.activity_logs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4. free_user_events
CREATE TABLE IF NOT EXISTS public.free_user_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event TEXT NOT NULL,
  details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS free_user_events_user_event_idx
  ON public.free_user_events (user_id, event, created_at DESC);

GRANT SELECT, INSERT ON public.free_user_events TO authenticated;
GRANT ALL ON public.free_user_events TO service_role;

ALTER TABLE public.free_user_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "free_user_events self insert"
  ON public.free_user_events FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "free_user_events self read"
  ON public.free_user_events FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "free_user_events coaches read"
  ON public.free_user_events FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'coach'));

-- 5. Seed achievements
INSERT INTO public.achievements (code, title, description, icon, category, trigger_type, threshold, reward_points)
VALUES
  ('water_100l', '100 Liter Hydration', '100 Liter Wasser getrunken', '💧', 'tracking', 'water_total_liters', 100, 25),
  ('weight_loss_10', '10 kg Transformation', '10 kg Gewichtsverlust dokumentiert', '⚖️', 'tracking', 'weight_loss_kg', 10, 50),
  ('protein_100', 'Protein Centurion', '100 Tage Proteinziel erreicht', '🥩', 'tracking', 'protein_days', 100, 50)
ON CONFLICT (code) DO NOTHING;
