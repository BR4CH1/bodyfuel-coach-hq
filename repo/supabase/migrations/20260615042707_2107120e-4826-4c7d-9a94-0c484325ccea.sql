
-- ============ ENUMS ============
DO $$ BEGIN
  CREATE TYPE public.strength_test_key AS ENUM (
    'leg_press','leg_curl','chest_press','shoulder_press','lat_pulldown','cable_row','plank'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.strength_check_status AS ENUM ('draft','completed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.strength_reminder_kind AS ENUM ('upcoming','due');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============ TABLES ============
CREATE TABLE IF NOT EXISTS public.strength_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  performed_at date NOT NULL DEFAULT (now()::date),
  status public.strength_check_status NOT NULL DEFAULT 'draft',
  bodyweight_kg numeric(5,1),
  notes text,
  score_lower smallint,
  score_push smallint,
  score_pull smallint,
  score_core smallint,
  score_total smallint,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.strength_checks TO authenticated;
GRANT ALL ON public.strength_checks TO service_role;
ALTER TABLE public.strength_checks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sc_owner_select" ON public.strength_checks FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(),'coach'));
CREATE POLICY "sc_owner_insert" ON public.strength_checks FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "sc_owner_update" ON public.strength_checks FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "sc_owner_delete" ON public.strength_checks FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS strength_checks_user_perf_idx
  ON public.strength_checks (user_id, performed_at DESC);

CREATE TABLE IF NOT EXISTS public.strength_check_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  check_id uuid NOT NULL REFERENCES public.strength_checks(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  test_key public.strength_test_key NOT NULL,
  weight_kg numeric(6,2),
  reps smallint,
  duration_seconds smallint,
  rpe smallint,
  pain_note text,
  e1rm_kg numeric(7,2) GENERATED ALWAYS AS (
    CASE WHEN weight_kg IS NOT NULL AND reps IS NOT NULL AND reps > 0
      THEN ROUND((weight_kg * (1 + reps::numeric/30))::numeric, 2)
      ELSE NULL END
  ) STORED,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (check_id, test_key)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.strength_check_results TO authenticated;
GRANT ALL ON public.strength_check_results TO service_role;
ALTER TABLE public.strength_check_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "scr_owner_select" ON public.strength_check_results FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(),'coach'));
CREATE POLICY "scr_owner_insert" ON public.strength_check_results FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "scr_owner_update" ON public.strength_check_results FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "scr_owner_delete" ON public.strength_check_results FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.strength_check_reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  due_at date NOT NULL,
  kind public.strength_reminder_kind NOT NULL,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.strength_check_reminders TO authenticated;
GRANT ALL ON public.strength_check_reminders TO service_role;
ALTER TABLE public.strength_check_reminders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "scrm_owner_select" ON public.strength_check_reminders FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(),'coach'));
CREATE POLICY "scrm_service_write" ON public.strength_check_reminders FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS strength_check_reminders_user_due_idx
  ON public.strength_check_reminders (user_id, due_at);

-- ============ updated_at triggers ============
DROP TRIGGER IF EXISTS trg_strength_checks_updated ON public.strength_checks;
CREATE TRIGGER trg_strength_checks_updated BEFORE UPDATE ON public.strength_checks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_strength_check_results_updated ON public.strength_check_results;
CREATE TRIGGER trg_strength_check_results_updated BEFORE UPDATE ON public.strength_check_results
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ Score helper ============
-- piecewise-linear interp between (ratio, score) anchors
CREATE OR REPLACE FUNCTION public.sc_interp(_value numeric, _anchors numeric[][])
RETURNS smallint LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
  i int;
  x1 numeric; y1 numeric; x2 numeric; y2 numeric;
  out_val numeric;
BEGIN
  IF _value IS NULL THEN RETURN NULL; END IF;
  IF _value <= _anchors[1][1] THEN RETURN GREATEST(0, _anchors[1][2])::smallint; END IF;
  FOR i IN 1 .. (array_length(_anchors,1) - 1) LOOP
    x1 := _anchors[i][1]; y1 := _anchors[i][2];
    x2 := _anchors[i+1][1]; y2 := _anchors[i+1][2];
    IF _value <= x2 THEN
      out_val := y1 + (y2 - y1) * (_value - x1) / NULLIF(x2 - x1, 0);
      RETURN LEAST(100, GREATEST(0, round(out_val)))::smallint;
    END IF;
  END LOOP;
  RETURN 100::smallint;
END $$;

CREATE OR REPLACE FUNCTION public.sc_score_for_test(
  _test public.strength_test_key,
  _gender text,
  _bodyweight numeric,
  _e1rm numeric,
  _duration_seconds smallint
) RETURNS smallint LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
  ratio numeric;
  is_female boolean := lower(coalesce(_gender,'')) IN ('female','frau','w','f');
  anchors numeric[][];
  result smallint;
BEGIN
  IF _test = 'plank' THEN
    IF _duration_seconds IS NULL THEN RETURN NULL; END IF;
    -- seconds -> score; same for both genders
    anchors := ARRAY[[0,0],[20,30],[30,40],[60,70],[90,85],[120,100]];
    RETURN public.sc_interp(_duration_seconds::numeric, anchors);
  END IF;

  IF _e1rm IS NULL OR _bodyweight IS NULL OR _bodyweight <= 0 THEN RETURN NULL; END IF;
  ratio := _e1rm / _bodyweight;

  -- anchors are (ratio_of_bodyweight, score) — male defaults
  CASE _test
    WHEN 'leg_press'       THEN anchors := ARRAY[[1.0,30],[1.5,50],[2.0,70],[2.5,85],[3.0,100]];
    WHEN 'leg_curl'        THEN anchors := ARRAY[[0.4,30],[0.6,50],[0.8,70],[1.0,85],[1.2,100]];
    WHEN 'chest_press'     THEN anchors := ARRAY[[0.6,30],[0.9,50],[1.2,70],[1.5,85],[1.8,100]];
    WHEN 'shoulder_press'  THEN anchors := ARRAY[[0.4,30],[0.6,50],[0.8,70],[1.0,85],[1.2,100]];
    WHEN 'lat_pulldown'    THEN anchors := ARRAY[[0.6,30],[0.9,50],[1.1,70],[1.3,85],[1.5,100]];
    WHEN 'cable_row'       THEN anchors := ARRAY[[0.6,30],[0.9,50],[1.1,70],[1.3,85],[1.5,100]];
    ELSE RETURN NULL;
  END CASE;

  -- female: scale ratios down by 30%
  IF is_female THEN
    FOR i IN 1..array_length(anchors,1) LOOP
      anchors[i][1] := anchors[i][1] * 0.7;
    END LOOP;
  END IF;

  result := public.sc_interp(ratio, anchors);
  RETURN result;
END $$;

-- ============ Process trigger ============
CREATE OR REPLACE FUNCTION public.process_strength_check()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_gender text;
  v_bw numeric;
  v_s_leg_press smallint; v_s_leg_curl smallint;
  v_s_chest smallint; v_s_shoulder smallint;
  v_s_lat smallint; v_s_row smallint; v_s_plank smallint;
  v_lower smallint; v_push smallint; v_pull smallint; v_core smallint; v_total smallint;
  v_prev_total smallint; v_prev RECORD;
  v_pr_count int := 0;
  v_quarter_count int;
BEGIN
  IF NEW.status <> 'completed' THEN RETURN NEW; END IF;
  IF OLD.status = 'completed' THEN RETURN NEW; END IF; -- already processed

  SELECT gender INTO v_gender FROM public.profiles WHERE id = NEW.user_id;
  v_bw := NEW.bodyweight_kg;
  IF v_bw IS NULL THEN
    SELECT weight_kg INTO v_bw FROM public.body_measurements
      WHERE user_id = NEW.user_id AND weight_kg IS NOT NULL
      ORDER BY measured_at DESC LIMIT 1;
  END IF;

  -- per-test scores
  SELECT public.sc_score_for_test('leg_press', v_gender, v_bw, e1rm_kg, NULL) INTO v_s_leg_press
    FROM public.strength_check_results WHERE check_id = NEW.id AND test_key = 'leg_press';
  SELECT public.sc_score_for_test('leg_curl', v_gender, v_bw, e1rm_kg, NULL) INTO v_s_leg_curl
    FROM public.strength_check_results WHERE check_id = NEW.id AND test_key = 'leg_curl';
  SELECT public.sc_score_for_test('chest_press', v_gender, v_bw, e1rm_kg, NULL) INTO v_s_chest
    FROM public.strength_check_results WHERE check_id = NEW.id AND test_key = 'chest_press';
  SELECT public.sc_score_for_test('shoulder_press', v_gender, v_bw, e1rm_kg, NULL) INTO v_s_shoulder
    FROM public.strength_check_results WHERE check_id = NEW.id AND test_key = 'shoulder_press';
  SELECT public.sc_score_for_test('lat_pulldown', v_gender, v_bw, e1rm_kg, NULL) INTO v_s_lat
    FROM public.strength_check_results WHERE check_id = NEW.id AND test_key = 'lat_pulldown';
  SELECT public.sc_score_for_test('cable_row', v_gender, v_bw, e1rm_kg, NULL) INTO v_s_row
    FROM public.strength_check_results WHERE check_id = NEW.id AND test_key = 'cable_row';
  SELECT public.sc_score_for_test('plank', v_gender, v_bw, NULL, duration_seconds) INTO v_s_plank
    FROM public.strength_check_results WHERE check_id = NEW.id AND test_key = 'plank';

  v_lower := COALESCE(((COALESCE(v_s_leg_press,0) + COALESCE(v_s_leg_curl,0)) /
                       NULLIF(((v_s_leg_press IS NOT NULL)::int + (v_s_leg_curl IS NOT NULL)::int),0))::smallint, NULL);
  v_push  := COALESCE(((COALESCE(v_s_chest,0) + COALESCE(v_s_shoulder,0)) /
                       NULLIF(((v_s_chest IS NOT NULL)::int + (v_s_shoulder IS NOT NULL)::int),0))::smallint, NULL);
  v_pull  := COALESCE(((COALESCE(v_s_lat,0) + COALESCE(v_s_row,0)) /
                       NULLIF(((v_s_lat IS NOT NULL)::int + (v_s_row IS NOT NULL)::int),0))::smallint, NULL);
  v_core  := v_s_plank;

  v_total := (
    (COALESCE(v_lower,0) + COALESCE(v_push,0) + COALESCE(v_pull,0) + COALESCE(v_core,0))
    / NULLIF(((v_lower IS NOT NULL)::int + (v_push IS NOT NULL)::int +
              (v_pull IS NOT NULL)::int + (v_core IS NOT NULL)::int), 0)
  )::smallint;

  NEW.score_lower := v_lower;
  NEW.score_push := v_push;
  NEW.score_pull := v_pull;
  NEW.score_core := v_core;
  NEW.score_total := v_total;
  NEW.completed_at := COALESCE(NEW.completed_at, now());

  -- ===== Points =====
  -- +25 first time / on completion
  INSERT INTO public.performance_points(user_id, training_date, kind, points, details, approved)
  VALUES (NEW.user_id, NEW.performed_at, 'strength_check_done', 25,
          jsonb_build_object('check_id', NEW.id, 'total', v_total), true);

  -- Previous completed check (before this one)
  SELECT * INTO v_prev FROM public.strength_checks
    WHERE user_id = NEW.user_id AND status = 'completed' AND id <> NEW.id
    ORDER BY performed_at DESC, completed_at DESC NULLS LAST LIMIT 1;

  IF v_prev.id IS NOT NULL THEN
    IF v_total IS NOT NULL AND v_prev.score_total IS NOT NULL AND v_total > v_prev.score_total THEN
      INSERT INTO public.performance_points(user_id, training_date, kind, points, details, approved)
      VALUES (NEW.user_id, NEW.performed_at, 'strength_score_up', 10,
              jsonb_build_object('prev', v_prev.score_total, 'new', v_total), true);
    END IF;
    IF v_lower IS NOT NULL AND COALESCE(v_prev.score_lower, -1) < v_lower THEN v_pr_count := v_pr_count + 1; END IF;
    IF v_push  IS NOT NULL AND COALESCE(v_prev.score_push,  -1) < v_push  THEN v_pr_count := v_pr_count + 1; END IF;
    IF v_pull  IS NOT NULL AND COALESCE(v_prev.score_pull,  -1) < v_pull  THEN v_pr_count := v_pr_count + 1; END IF;
    IF v_core  IS NOT NULL AND COALESCE(v_prev.score_core,  -1) < v_core  THEN v_pr_count := v_pr_count + 1; END IF;
    IF v_pr_count > 0 THEN
      INSERT INTO public.performance_points(user_id, training_date, kind, points, details, approved)
      VALUES (NEW.user_id, NEW.performed_at, 'strength_pr', v_pr_count * 5,
              jsonb_build_object('categories', v_pr_count), true);
    END IF;
  END IF;

  -- Quarter bonus: >= 2 completed in this quarter
  SELECT COUNT(*) INTO v_quarter_count FROM public.strength_checks
    WHERE user_id = NEW.user_id AND status = 'completed'
      AND date_trunc('quarter', performed_at) = date_trunc('quarter', NEW.performed_at);
  IF v_quarter_count >= 2 AND NOT EXISTS (
    SELECT 1 FROM public.performance_points
      WHERE user_id = NEW.user_id AND kind = 'strength_quarter_bonus'
        AND date_trunc('quarter', training_date) = date_trunc('quarter', NEW.performed_at)
  ) THEN
    INSERT INTO public.performance_points(user_id, training_date, kind, points, details, approved)
    VALUES (NEW.user_id, NEW.performed_at, 'strength_quarter_bonus', 20,
            jsonb_build_object('checks_in_quarter', v_quarter_count), true);
  END IF;

  PERFORM public.recompute_user_points(NEW.user_id);

  -- ===== Reminders =====
  -- Clear unresolved future reminders for this user, then schedule new ones.
  DELETE FROM public.strength_check_reminders
    WHERE user_id = NEW.user_id AND resolved_at IS NULL;
  INSERT INTO public.strength_check_reminders(user_id, due_at, kind)
  VALUES
    (NEW.user_id, NEW.performed_at + INTERVAL '30 days', 'upcoming'),
    (NEW.user_id, NEW.performed_at + INTERVAL '42 days', 'due');

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_process_strength_check ON public.strength_checks;
CREATE TRIGGER trg_process_strength_check
  BEFORE UPDATE ON public.strength_checks
  FOR EACH ROW
  WHEN (NEW.status = 'completed' AND OLD.status IS DISTINCT FROM 'completed')
  EXECUTE FUNCTION public.process_strength_check();
