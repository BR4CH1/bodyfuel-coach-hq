-- ============================================================
-- Strength Score V2 — DB-Persistenz & Trigger-Entkopplung
-- ============================================================

-- 1) Neue Spalten für V2-Ergebnisse.
ALTER TABLE public.strength_checks
  ADD COLUMN IF NOT EXISTS score_algorithm_version smallint,
  ADD COLUMN IF NOT EXISTS category_confidence jsonb,
  ADD COLUMN IF NOT EXISTS exercise_calcs jsonb,
  ADD COLUMN IF NOT EXISTS score_calculated_at timestamptz;

-- 2) Trigger neu: keine Score-Berechnung mehr. Nur noch Punkte, PR-Bonus,
--    Quartals-Bonus, Reminder & completed_at. Score_* werden vom Server
--    im gleichen UPDATE geschrieben und der Trigger liest sie aus NEW.
CREATE OR REPLACE FUNCTION public.process_strength_check()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_prev RECORD;
  v_pr_count int := 0;
  v_quarter_count int;
BEGIN
  IF NEW.status <> 'completed' THEN RETURN NEW; END IF;
  IF OLD.status = 'completed' THEN RETURN NEW; END IF; -- already processed

  NEW.completed_at := COALESCE(NEW.completed_at, now());

  -- Points: +25 for completion
  INSERT INTO public.performance_points(user_id, training_date, kind, points, details, approved)
  VALUES (NEW.user_id, NEW.performed_at, 'strength_check_done', 25,
          jsonb_build_object('check_id', NEW.id, 'total', NEW.score_total,
                             'algorithm_version', NEW.score_algorithm_version),
          true);

  -- Previous completed check for delta / PR bonus
  SELECT * INTO v_prev FROM public.strength_checks
    WHERE user_id = NEW.user_id AND status = 'completed' AND id <> NEW.id
    ORDER BY performed_at DESC, completed_at DESC NULLS LAST LIMIT 1;

  IF v_prev.id IS NOT NULL THEN
    IF NEW.score_total IS NOT NULL AND v_prev.score_total IS NOT NULL
       AND NEW.score_total > v_prev.score_total THEN
      INSERT INTO public.performance_points(user_id, training_date, kind, points, details, approved)
      VALUES (NEW.user_id, NEW.performed_at, 'strength_score_up', 10,
              jsonb_build_object('prev', v_prev.score_total, 'new', NEW.score_total), true);
    END IF;
    IF NEW.score_lower IS NOT NULL AND COALESCE(v_prev.score_lower, -1) < NEW.score_lower THEN v_pr_count := v_pr_count + 1; END IF;
    IF NEW.score_push  IS NOT NULL AND COALESCE(v_prev.score_push,  -1) < NEW.score_push  THEN v_pr_count := v_pr_count + 1; END IF;
    IF NEW.score_pull  IS NOT NULL AND COALESCE(v_prev.score_pull,  -1) < NEW.score_pull  THEN v_pr_count := v_pr_count + 1; END IF;
    IF NEW.score_core  IS NOT NULL AND COALESCE(v_prev.score_core,  -1) < NEW.score_core  THEN v_pr_count := v_pr_count + 1; END IF;
    IF v_pr_count > 0 THEN
      INSERT INTO public.performance_points(user_id, training_date, kind, points, details, approved)
      VALUES (NEW.user_id, NEW.performed_at, 'strength_pr', v_pr_count * 5,
              jsonb_build_object('categories', v_pr_count), true);
    END IF;
  END IF;

  -- Quarter bonus
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

  -- Reminders
  DELETE FROM public.strength_check_reminders
    WHERE user_id = NEW.user_id AND resolved_at IS NULL;
  INSERT INTO public.strength_check_reminders(user_id, due_at, kind)
  VALUES
    (NEW.user_id, NEW.performed_at + INTERVAL '30 days', 'upcoming'),
    (NEW.user_id, NEW.performed_at + INTERVAL '42 days', 'due');

  RETURN NEW;
END $$;

-- 3) Alte V1-Hilfsfunktionen entfernen (nicht mehr referenziert).
DROP FUNCTION IF EXISTS public.sc_score_for_test(public.strength_test_key, text, numeric, numeric, smallint);
DROP FUNCTION IF EXISTS public.sc_interp(numeric, numeric[]);
DROP FUNCTION IF EXISTS public.sc_interp(numeric, numeric[][]);