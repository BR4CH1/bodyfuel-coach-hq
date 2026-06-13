
-- Groups
DO $$ BEGIN
  CREATE TYPE public.app_group AS ENUM ('bulls', 'running_team', 'sgz', 'premium');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.user_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  group_name public.app_group NOT NULL,
  granted_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, group_name)
);
GRANT SELECT ON public.user_groups TO authenticated;
GRANT ALL ON public.user_groups TO service_role;
ALTER TABLE public.user_groups ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_group(_user_id uuid, _group public.app_group)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.user_groups WHERE user_id = _user_id AND group_name = _group); $$;

CREATE POLICY "Users view own groups" ON public.user_groups
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Coaches view all groups" ON public.user_groups
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'coach'));
CREATE POLICY "Coaches manage groups" ON public.user_groups
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'coach'))
  WITH CHECK (public.has_role(auth.uid(), 'coach'));

-- Bulls profiles
DO $$ BEGIN
  CREATE TYPE public.bulls_position AS ENUM ('QB','RB','WR','TE','OL','DL','LB','DB','KP','COACH');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE public.bulls_goal AS ENUM ('fat_loss','muscle_gain','performance','general_fitness');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.bulls_profiles (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  first_name text NOT NULL,
  last_name text NOT NULL,
  email text NOT NULL,
  weight_kg numeric NOT NULL CHECK (weight_kg > 0 AND weight_kg < 400),
  height_cm numeric NOT NULL CHECK (height_cm > 0 AND height_cm < 300),
  position public.bulls_position NOT NULL,
  main_goal public.bulls_goal NOT NULL,
  onboarded_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bulls_profiles TO authenticated;
GRANT ALL ON public.bulls_profiles TO service_role;
ALTER TABLE public.bulls_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Bulls users manage own profile" ON public.bulls_profiles
  FOR ALL TO authenticated
  USING (auth.uid() = user_id AND public.has_group(auth.uid(), 'bulls'))
  WITH CHECK (auth.uid() = user_id AND public.has_group(auth.uid(), 'bulls'));
CREATE POLICY "Coaches read bulls profiles" ON public.bulls_profiles
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'coach'));
CREATE TRIGGER trg_bulls_profiles_updated_at
BEFORE UPDATE ON public.bulls_profiles
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Weight logs
CREATE TABLE IF NOT EXISTS public.bulls_weight_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  log_date date NOT NULL DEFAULT CURRENT_DATE,
  weight_kg numeric NOT NULL CHECK (weight_kg > 0 AND weight_kg < 400),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, log_date)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bulls_weight_logs TO authenticated;
GRANT ALL ON public.bulls_weight_logs TO service_role;
ALTER TABLE public.bulls_weight_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Bulls users manage own weight logs" ON public.bulls_weight_logs
  FOR ALL TO authenticated
  USING (auth.uid() = user_id AND public.has_group(auth.uid(), 'bulls'))
  WITH CHECK (auth.uid() = user_id AND public.has_group(auth.uid(), 'bulls'));
CREATE POLICY "Coaches read bulls weight logs" ON public.bulls_weight_logs
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'coach'));

-- Progress photos
CREATE TABLE IF NOT EXISTS public.bulls_progress_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  photo_date date NOT NULL DEFAULT CURRENT_DATE,
  front_path text,
  side_path text,
  back_path text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bulls_progress_photos TO authenticated;
GRANT ALL ON public.bulls_progress_photos TO service_role;
ALTER TABLE public.bulls_progress_photos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Bulls users manage own photos" ON public.bulls_progress_photos
  FOR ALL TO authenticated
  USING (auth.uid() = user_id AND public.has_group(auth.uid(), 'bulls'))
  WITH CHECK (auth.uid() = user_id AND public.has_group(auth.uid(), 'bulls'));

-- Hub events for starter score
CREATE TABLE IF NOT EXISTS public.bulls_hub_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, kind)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bulls_hub_events TO authenticated;
GRANT ALL ON public.bulls_hub_events TO service_role;
ALTER TABLE public.bulls_hub_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Bulls users manage own events" ON public.bulls_hub_events
  FOR ALL TO authenticated
  USING (auth.uid() = user_id AND public.has_group(auth.uid(), 'bulls'))
  WITH CHECK (auth.uid() = user_id AND public.has_group(auth.uid(), 'bulls'));

-- Storage RLS for bulls-progress-photos bucket
CREATE POLICY "Bulls users upload own progress photos"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'bulls-progress-photos'
  AND (storage.foldername(name))[1] = auth.uid()::text
  AND public.has_group(auth.uid(), 'bulls')
);
CREATE POLICY "Bulls users read own progress photos"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'bulls-progress-photos'
  AND (storage.foldername(name))[1] = auth.uid()::text
);
CREATE POLICY "Bulls users delete own progress photos"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'bulls-progress-photos'
  AND (storage.foldername(name))[1] = auth.uid()::text
);
