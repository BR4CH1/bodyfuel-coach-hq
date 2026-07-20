
-- Macro target computation per training goal.
-- Returns nothing; writes into public.nutrition_targets.
CREATE OR REPLACE FUNCTION public.compute_macro_targets(_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_weight       numeric;
  v_height       numeric;
  v_age          integer;
  v_gender       text;
  v_activity     text;
  v_goal_raw     text;
  v_goal         text;
  v_act_factor   numeric;
  v_bmr          numeric;
  v_tdee         numeric;
  v_kcal_t       integer; v_kcal_r       integer;
  v_protein_t    integer; v_protein_r    integer;
  v_fat_t        integer; v_fat_r        integer;
  v_carbs_t      integer; v_carbs_r      integer;
  v_protein_g_t  numeric; v_protein_g_r  numeric;
  v_fat_g_t      numeric; v_fat_g_r      numeric;
BEGIN
  -- Body data + goal
  SELECT p.height_cm, p.gender, p.activity_level, p.training_goal,
         EXTRACT(YEAR FROM age(p.birthdate))::int
    INTO v_height, v_gender, v_activity, v_goal_raw, v_age
  FROM public.profiles p
  WHERE p.id = _user_id;

  SELECT bm.weight_kg INTO v_weight
  FROM public.body_measurements bm
  WHERE bm.user_id = _user_id AND bm.weight_kg IS NOT NULL
  ORDER BY bm.measured_at DESC
  LIMIT 1;

  IF v_weight IS NULL OR v_goal_raw IS NULL THEN
    RETURN; -- not enough data; leave existing targets alone
  END IF;

  -- Map legacy/alias goals to the 5 official ones
  v_goal := CASE lower(v_goal_raw)
    WHEN 'performance'      THEN 'performance'
    WHEN 'strength'         THEN 'performance'
    WHEN 'lean_bulk'        THEN 'lean_bulk'
    WHEN 'muscle_gain'      THEN 'lean_bulk'
    WHEN 'bulk'             THEN 'lean_bulk'
    WHEN 'fat_loss'         THEN 'fat_loss'
    WHEN 'weight_loss'      THEN 'fat_loss'
    WHEN 'aggressive_cut'   THEN 'aggressive_cut'
    WHEN 'cut'              THEN 'aggressive_cut'
    WHEN 'recovery'         THEN 'recovery'
    WHEN 'rehab'            THEN 'recovery'
    WHEN 'health'           THEN 'recovery'
    WHEN 'maintenance'      THEN 'performance'
    WHEN 'maintain'         THEN 'performance'
    WHEN 'recomposition'    THEN 'performance'
    WHEN 'recomp'           THEN 'performance'
    ELSE 'performance'
  END;

  -- Activity factor
  v_act_factor := CASE lower(coalesce(v_activity, ''))
    WHEN 'sedentary'    THEN 1.3
    WHEN 'light'        THEN 1.45
    WHEN 'moderate'     THEN 1.6
    WHEN 'active'       THEN 1.75
    WHEN 'very_active'  THEN 1.75
    WHEN 'athlete'      THEN 1.9
    ELSE 1.55
  END;

  -- Maintenance kcal: Mifflin-St Jeor if height/age/gender are known,
  -- otherwise weight-only fallback ~33 kcal/kg.
  IF v_height IS NOT NULL AND v_age IS NOT NULL AND v_gender IS NOT NULL THEN
    v_bmr := CASE lower(v_gender)
      WHEN 'female' THEN 10 * v_weight + 6.25 * v_height - 5 * v_age - 161
      ELSE              10 * v_weight + 6.25 * v_height - 5 * v_age + 5
    END;
    v_tdee := v_bmr * v_act_factor;
  ELSE
    v_tdee := v_weight * 33.0;
  END IF;

  -- Per-goal targets (training + rest)
  IF v_goal = 'performance' THEN
    v_kcal_t      := round(v_weight * 37.5);
    v_kcal_r      := round(v_weight * 32.5);
    v_protein_g_t := v_weight * 2.2;  v_protein_g_r := v_weight * 2.2;
    v_fat_g_t     := v_weight * 0.9;  v_fat_g_r     := v_weight * 1.0;

  ELSIF v_goal = 'lean_bulk' THEN
    v_kcal_t      := round(v_weight * 41.5);
    v_kcal_r      := round(v_weight * 37.5);
    v_protein_g_t := v_weight * 2.2;  v_protein_g_r := v_weight * 2.2;
    v_fat_g_t     := v_weight * 0.8;  v_fat_g_r     := v_weight * 0.9;

  ELSIF v_goal = 'fat_loss' THEN
    v_kcal_t      := round(v_tdee * 0.825);            -- ~17.5% Defizit
    v_kcal_r      := greatest(round(v_kcal_t - 250), round(v_weight * 22.0));
    v_protein_g_t := v_weight * 2.5;  v_protein_g_r := v_weight * 2.5;
    v_fat_g_t     := v_weight * 0.7;  v_fat_g_r     := v_weight * 0.8;

  ELSIF v_goal = 'aggressive_cut' THEN
    v_kcal_t      := round(v_tdee * 0.70);             -- ~30% Defizit
    v_kcal_r      := greatest(round(v_kcal_t - 250), round(v_weight * 20.0));
    v_protein_g_t := v_weight * 2.8;  v_protein_g_r := v_weight * 2.8;
    v_fat_g_t     := greatest(v_weight * 0.6, 35);
    v_fat_g_r     := greatest(v_weight * 0.6, 35);

  ELSE -- recovery
    v_kcal_t      := round(v_tdee * 0.95);             -- 0–10% Defizit
    v_kcal_r      := round(v_tdee * 0.92);
    v_protein_g_t := v_weight * 2.8;  v_protein_g_r := v_weight * 2.8;
    v_fat_g_t     := v_weight * 1.0;  v_fat_g_r     := v_weight * 1.0;
  END IF;

  v_protein_t := round(v_protein_g_t);
  v_protein_r := round(v_protein_g_r);
  v_fat_t     := round(v_fat_g_t);
  v_fat_r     := round(v_fat_g_r);
  v_carbs_t   := greatest(40, round((v_kcal_t - v_protein_t * 4 - v_fat_t * 9) / 4.0));
  v_carbs_r   := greatest(30, round((v_kcal_r - v_protein_r * 4 - v_fat_r * 9) / 4.0));

  INSERT INTO public.nutrition_targets
    (user_id, kcal, protein_g, carbs_g, fat_g,
     kcal_rest, protein_g_rest, carbs_g_rest, fat_g_rest, updated_by)
  VALUES
    (_user_id, v_kcal_t, v_protein_t, v_carbs_t, v_fat_t,
     v_kcal_r, v_protein_r, v_carbs_r, v_fat_r, _user_id)
  ON CONFLICT (user_id) DO UPDATE SET
    kcal           = EXCLUDED.kcal,
    protein_g      = EXCLUDED.protein_g,
    carbs_g        = EXCLUDED.carbs_g,
    fat_g          = EXCLUDED.fat_g,
    kcal_rest      = EXCLUDED.kcal_rest,
    protein_g_rest = EXCLUDED.protein_g_rest,
    carbs_g_rest   = EXCLUDED.carbs_g_rest,
    fat_g_rest     = EXCLUDED.fat_g_rest,
    updated_at     = now();
END;
$$;

-- Trigger: recompute when training_goal changes on profile
CREATE OR REPLACE FUNCTION public.trg_profile_goal_recompute()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' OR NEW.training_goal IS DISTINCT FROM OLD.training_goal THEN
    PERFORM public.compute_macro_targets(NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profile_goal_recompute ON public.profiles;
CREATE TRIGGER profile_goal_recompute
AFTER INSERT OR UPDATE OF training_goal ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.trg_profile_goal_recompute();

-- Trigger: recompute when a new weight is recorded
CREATE OR REPLACE FUNCTION public.trg_weight_recompute()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.weight_kg IS NOT NULL THEN
    PERFORM public.compute_macro_targets(NEW.user_id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS weight_recompute ON public.body_measurements;
CREATE TRIGGER weight_recompute
AFTER INSERT OR UPDATE OF weight_kg ON public.body_measurements
FOR EACH ROW EXECUTE FUNCTION public.trg_weight_recompute();

-- Backfill: recompute targets for everyone who already has a training_goal + weight
DO $$
DECLARE u uuid;
BEGIN
  FOR u IN
    SELECT DISTINCT p.id
    FROM public.profiles p
    JOIN public.body_measurements bm ON bm.user_id = p.id AND bm.weight_kg IS NOT NULL
    WHERE p.training_goal IS NOT NULL
  LOOP
    PERFORM public.compute_macro_targets(u);
  END LOOP;
END $$;
