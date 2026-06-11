
-- =====================================================
-- ACHIEVEMENTS / POINTS SYSTEM
-- =====================================================

-- 1. Katalog der Achievements
CREATE TABLE public.achievements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  title text NOT NULL,
  description text NOT NULL,
  icon text NOT NULL DEFAULT 'trophy',
  category text NOT NULL DEFAULT 'general',
  trigger_type text NOT NULL,           -- 'total_points' | 'streak' | 'level' | 'perfect_day' | 'perfect_week' | 'first_check'
  threshold integer NOT NULL DEFAULT 0,
  reward_points integer NOT NULL DEFAULT 0,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.achievements TO authenticated;
GRANT ALL ON public.achievements TO service_role;
ALTER TABLE public.achievements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone authenticated can read achievements"
  ON public.achievements FOR SELECT TO authenticated USING (true);
CREATE POLICY "Coaches manage achievements"
  ON public.achievements FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'coach'))
  WITH CHECK (public.has_role(auth.uid(), 'coach'));
CREATE TRIGGER update_achievements_updated_at
  BEFORE UPDATE ON public.achievements
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. User Punkte / Level / Streak
CREATE TABLE public.user_points (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  total_points integer NOT NULL DEFAULT 0,
  level integer NOT NULL DEFAULT 1,
  current_streak integer NOT NULL DEFAULT 0,
  longest_streak integer NOT NULL DEFAULT 0,
  last_check_date date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.user_points TO authenticated;
GRANT ALL ON public.user_points TO service_role;
ALTER TABLE public.user_points ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own points"
  ON public.user_points FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'coach'));
CREATE POLICY "Users insert own points"
  ON public.user_points FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own points"
  ON public.user_points FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER update_user_points_updated_at
  BEFORE UPDATE ON public.user_points
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. Freigeschaltete Achievements pro User
CREATE TABLE public.user_achievements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  achievement_id uuid NOT NULL REFERENCES public.achievements(id) ON DELETE CASCADE,
  unlocked_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, achievement_id)
);
CREATE INDEX idx_user_achievements_user ON public.user_achievements(user_id, unlocked_at DESC);
GRANT SELECT, INSERT ON public.user_achievements TO authenticated;
GRANT ALL ON public.user_achievements TO service_role;
ALTER TABLE public.user_achievements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own achievements"
  ON public.user_achievements FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'coach'));
CREATE POLICY "Users insert own achievements"
  ON public.user_achievements FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- =====================================================
-- TRIGGER LOGIK: daily_checks -> points/streak/achievements
-- =====================================================

CREATE OR REPLACE FUNCTION public.process_daily_check()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_points_diff integer;
  v_existing public.user_points%ROWTYPE;
  v_new_streak integer;
  v_new_total integer;
  v_new_level integer;
  v_is_perfect boolean;
  v_perfect_week_count integer;
  ach RECORD;
BEGIN
  -- Punkt-Differenz (bei UPDATE alter Wert subtrahieren)
  IF TG_OP = 'INSERT' THEN
    v_points_diff := NEW.points;
  ELSE
    v_points_diff := NEW.points - OLD.points;
  END IF;

  -- user_points-Zeile sicherstellen
  INSERT INTO public.user_points (user_id, total_points)
  VALUES (NEW.user_id, 0)
  ON CONFLICT (user_id) DO NOTHING;

  SELECT * INTO v_existing FROM public.user_points WHERE user_id = NEW.user_id FOR UPDATE;

  -- Streak nur bei INSERT neu berechnen
  IF TG_OP = 'INSERT' THEN
    IF v_existing.last_check_date IS NULL THEN
      v_new_streak := 1;
    ELSIF NEW.check_date = v_existing.last_check_date + INTERVAL '1 day' THEN
      v_new_streak := v_existing.current_streak + 1;
    ELSIF NEW.check_date = v_existing.last_check_date THEN
      v_new_streak := GREATEST(v_existing.current_streak, 1);
    ELSE
      v_new_streak := 1;
    END IF;
  ELSE
    v_new_streak := v_existing.current_streak;
  END IF;

  v_new_total := v_existing.total_points + v_points_diff;
  v_new_level := GREATEST(1, 1 + (v_new_total / 100));  -- 100 Pkt = 1 Level

  UPDATE public.user_points
  SET total_points = v_new_total,
      level = v_new_level,
      current_streak = v_new_streak,
      longest_streak = GREATEST(longest_streak, v_new_streak),
      last_check_date = GREATEST(COALESCE(last_check_date, NEW.check_date), NEW.check_date)
  WHERE user_id = NEW.user_id;

  -- Perfekter Tag = alle Punkte des Tages erreicht (>=15)
  v_is_perfect := NEW.points >= 15;

  -- Perfekte Woche: 7 perfekte Tage in den letzten 7 Tagen
  SELECT COUNT(*) INTO v_perfect_week_count
  FROM public.daily_checks
  WHERE user_id = NEW.user_id
    AND check_date > NEW.check_date - INTERVAL '7 days'
    AND check_date <= NEW.check_date
    AND points >= 15;

  -- Achievements freischalten
  FOR ach IN
    SELECT a.* FROM public.achievements a
    WHERE NOT EXISTS (
      SELECT 1 FROM public.user_achievements ua
      WHERE ua.user_id = NEW.user_id AND ua.achievement_id = a.id
    )
    AND (
      (a.trigger_type = 'first_check')
      OR (a.trigger_type = 'total_points' AND v_new_total >= a.threshold)
      OR (a.trigger_type = 'streak' AND v_new_streak >= a.threshold)
      OR (a.trigger_type = 'level' AND v_new_level >= a.threshold)
      OR (a.trigger_type = 'perfect_day' AND v_is_perfect)
      OR (a.trigger_type = 'perfect_week' AND v_perfect_week_count >= 7)
    )
  LOOP
    INSERT INTO public.user_achievements (user_id, achievement_id)
    VALUES (NEW.user_id, ach.id)
    ON CONFLICT DO NOTHING;

    -- Bonus-Punkte
    IF ach.reward_points > 0 THEN
      UPDATE public.user_points
      SET total_points = total_points + ach.reward_points,
          level = GREATEST(1, 1 + ((total_points + ach.reward_points) / 100))
      WHERE user_id = NEW.user_id;
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_process_daily_check
  AFTER INSERT OR UPDATE OF points ON public.daily_checks
  FOR EACH ROW EXECUTE FUNCTION public.process_daily_check();

-- =====================================================
-- SEED ACHIEVEMENTS
-- =====================================================
INSERT INTO public.achievements (code, title, description, icon, category, trigger_type, threshold, reward_points, sort_order) VALUES
  ('first_check',      'Erste Schritte',     'Deinen ersten Tagescheck abgeschlossen.',      'sparkles', 'milestone', 'first_check',   0,    5,  1),
  ('streak_3',         '3 Tage in Folge',    'Drei Tage hintereinander eingecheckt.',         'flame',    'streak',    'streak',        3,    5,  10),
  ('streak_7',         '7-Tage-Streak',      'Eine ganze Woche dran geblieben!',              'flame',    'streak',    'streak',        7,    10, 11),
  ('streak_30',        '30-Tage-Streak',     'Einen ganzen Monat täglich aktiv.',             'flame',    'streak',    'streak',        30,   50, 12),
  ('points_100',       'Hundertstel',        '100 Punkte gesammelt.',                         'star',     'points',    'total_points',  100,  0,  20),
  ('points_500',       'Halbtausend',        '500 Punkte gesammelt.',                         'star',     'points',    'total_points',  500,  0,  21),
  ('points_1000',      'Tausendsassa',       '1000 Punkte gesammelt.',                        'crown',    'points',    'total_points',  1000, 0,  22),
  ('level_5',          'Level 5',            'Level 5 erreicht.',                             'trophy',   'level',     'level',         5,    0,  30),
  ('level_10',         'Level 10',           'Level 10 erreicht.',                            'trophy',   'level',     'level',         10,   0,  31),
  ('perfect_day',      'Perfekter Tag',      'Alle Tagesziele an einem Tag erreicht.',        'check',    'daily',     'perfect_day',   0,    5,  40),
  ('perfect_week',     'Perfekte Woche',     '7 perfekte Tage in Folge.',                     'medal',    'weekly',    'perfect_week',  0,    25, 41);
