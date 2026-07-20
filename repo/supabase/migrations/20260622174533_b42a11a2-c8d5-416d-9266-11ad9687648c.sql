CREATE OR REPLACE FUNCTION public.compute_macro_targets(_user_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_weight       numeric;
  v_goal_weight  numeric;
  v_target_date  date;
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
  v_kg_diff      numeric;
  v_weeks        numeric;
  v_rate_kg_w    numeric;
  v_kcal_delta   numeric;
  v_max_deficit  numeric;
  v_max_surplus  numeric;
  v_min_kcal     integer;
  v_max_kcal     integer;
  v_protein_ref_kg numeric;
BEGIN
  SELECT p.height_cm, p.gender, p.activity_level, p.training_goal, p.goal_weight_kg, p.goal_target_date,
         EXTRACT(YEAR FROM age(p.birthdate))::int
    INTO v_height, v_gender, v_activity, v_goal_raw, v_goal_weight, v_target_date, v_age
  FROM public.profiles p
  WHERE p.id = _user_id;

  SELECT bm.weight_kg INTO v_weight
  FROM public.body_measurements bm
  WHERE bm.user_id = _user_id AND bm.weight_kg IS NOT NULL
  ORDER BY bm.measured_at DESC
  LIMIT 1;

  IF v_weight IS NULL OR v_goal_raw IS NULL THEN
    RETURN;
  END IF;

  -- Map raw training_goal to internal bucket
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

  -- SANITY OVERRIDE: goal_weight enforces the direction.
  -- If the client wants to lose ≥3% of body weight, never run a surplus
  -- regardless of training_goal. If the gap is huge (>15% BW) and no
  -- realistic target date set, use aggressive_cut for protein/fat targets.
  IF v_goal_weight IS NOT NULL AND v_goal_weight > 0 THEN
    IF v_goal_weight < v_weight * 0.97 THEN
      IF v_goal_weight < v_weight * 0.85 THEN
        v_goal := 'aggressive_cut';
      ELSE
        v_goal := 'fat_loss';
      END IF;
    ELSIF v_goal_weight > v_weight * 1.03 AND v_goal IN ('fat_loss','aggressive_cut') THEN
      v_goal := 'lean_bulk';
    END IF;
  END IF;

  v_act_factor := CASE lower(coalesce(v_activity, ''))
    WHEN 'sedentary'    THEN 1.3
    WHEN 'light'        THEN 1.45
    WHEN 'moderate'     THEN 1.6
    WHEN 'active'       THEN 1.75
    WHEN 'very_active'  THEN 1.75
    WHEN 'athlete'      THEN 1.9
    ELSE 1.55
  END;

  -- TDEE: prefer Mifflin–St Jeor on lean reference weight when very overweight,
  -- so a 150 kg client doesn't get TDEE inflated by carrying fat mass.
  -- Reference weight = min(actual, goal+10, 1.2 × goal) when goal is meaningfully lower.
  DECLARE v_ref_weight numeric := v_weight;
  BEGIN
    IF v_goal_weight IS NOT NULL AND v_goal_weight < v_weight * 0.95 THEN
      v_ref_weight := LEAST(v_weight, GREATEST(v_goal_weight + 10, v_goal_weight * 1.2));
    END IF;

    IF v_height IS NOT NULL AND v_age IS NOT NULL AND v_gender IS NOT NULL THEN
      v_bmr := CASE lower(v_gender)
        WHEN 'female' THEN 10 * v_ref_weight + 6.25 * v_height - 5 * v_age - 161
        ELSE              10 * v_ref_weight + 6.25 * v_height - 5 * v_age + 5
      END;
      v_tdee := v_bmr * v_act_factor;
    ELSE
      v_tdee := v_ref_weight * 31.0;
    END IF;
  END;

  -- Protein/fat reference weight: cap at goal_weight + 10 when cutting,
  -- so we don't prescribe 330 g protein for someone whose target is 90 kg.
  v_protein_ref_kg := v_weight;
  IF v_goal IN ('fat_loss','aggressive_cut') AND v_goal_weight IS NOT NULL THEN
    v_protein_ref_kg := LEAST(v_weight, v_goal_weight + 10);
  END IF;

  IF v_goal = 'performance' THEN
    v_protein_g_t := v_protein_ref_kg * 2.2;  v_protein_g_r := v_protein_ref_kg * 2.2;
    v_fat_g_t     := v_protein_ref_kg * 0.9;  v_fat_g_r     := v_protein_ref_kg * 1.0;
  ELSIF v_goal = 'lean_bulk' THEN
    v_protein_g_t := v_protein_ref_kg * 2.2;  v_protein_g_r := v_protein_ref_kg * 2.2;
    v_fat_g_t     := v_protein_ref_kg * 0.8;  v_fat_g_r     := v_protein_ref_kg * 0.9;
  ELSIF v_goal = 'fat_loss' THEN
    v_protein_g_t := v_protein_ref_kg * 2.2;  v_protein_g_r := v_protein_ref_kg * 2.2;
    v_fat_g_t     := v_protein_ref_kg * 0.8;  v_fat_g_r     := v_protein_ref_kg * 0.9;
  ELSIF v_goal = 'aggressive_cut' THEN
    v_protein_g_t := v_protein_ref_kg * 2.4;  v_protein_g_r := v_protein_ref_kg * 2.4;
    v_fat_g_t     := greatest(v_protein_ref_kg * 0.6, 35);
    v_fat_g_r     := greatest(v_protein_ref_kg * 0.6, 35);
  ELSE
    v_protein_g_t := v_protein_ref_kg * 2.0;  v_protein_g_r := v_protein_ref_kg * 2.0;
    v_fat_g_t     := v_protein_ref_kg * 1.0;  v_fat_g_r     := v_protein_ref_kg * 1.0;
  END IF;

  -- Calorie target
  IF v_goal_weight IS NOT NULL AND v_target_date IS NOT NULL AND v_target_date > current_date THEN
    v_kg_diff   := v_goal_weight - v_weight;
    v_weeks     := greatest(2.0, (v_target_date - current_date)::numeric / 7.0);
    v_rate_kg_w := v_kg_diff / v_weeks;
    v_kcal_delta := v_rate_kg_w * 7700.0 / 7.0;

    v_max_deficit := -(v_weight * 0.01) * 7700.0 / 7.0;
    v_max_surplus :=  (v_weight * 0.005) * 7700.0 / 7.0;
    IF v_kcal_delta < v_max_deficit THEN v_kcal_delta := v_max_deficit; END IF;
    IF v_kcal_delta > v_max_surplus THEN v_kcal_delta := v_max_surplus; END IF;

    v_kcal_t := round((v_tdee + v_kcal_delta) / 50.0) * 50;
    v_kcal_r := round((v_tdee + v_kcal_delta - 250) / 50.0) * 50;

  ELSIF v_goal_weight IS NOT NULL AND v_goal_weight < v_weight * 0.97 THEN
    -- Cutting without target date: derive a sensible default deficit
    -- (~0.5–0.75% BW/week loss) from TDEE, never above maintenance.
    v_kcal_delta := -(v_weight * 0.0065) * 7700.0 / 7.0;
    v_kcal_t := round((v_tdee + v_kcal_delta) / 50.0) * 50;
    v_kcal_r := round((v_tdee + v_kcal_delta - 250) / 50.0) * 50;

  ELSIF v_goal_weight IS NOT NULL AND v_goal_weight > v_weight * 1.03 THEN
    -- Bulking without target date: ~0.25% BW/week gain
    v_kcal_delta := (v_weight * 0.0025) * 7700.0 / 7.0;
    v_kcal_t := round((v_tdee + v_kcal_delta) / 50.0) * 50;
    v_kcal_r := round((v_tdee + v_kcal_delta - 250) / 50.0) * 50;

  ELSE
    -- No goal weight: use per-goal fallbacks anchored on TDEE
    IF v_goal = 'performance' THEN
      v_kcal_t := round(v_tdee / 50.0) * 50;
      v_kcal_r := round((v_tdee - 250) / 50.0) * 50;
    ELSIF v_goal = 'lean_bulk' THEN
      v_kcal_t := round((v_tdee * 1.10) / 50.0) * 50;
      v_kcal_r := round((v_tdee * 1.05) / 50.0) * 50;
    ELSIF v_goal = 'fat_loss' THEN
      v_kcal_t := round((v_tdee * 0.82) / 50.0) * 50;
      v_kcal_r := round((v_tdee * 0.78) / 50.0) * 50;
    ELSIF v_goal = 'aggressive_cut' THEN
      v_kcal_t := round((v_tdee * 0.70) / 50.0) * 50;
      v_kcal_r := round((v_tdee * 0.68) / 50.0) * 50;
    ELSE
      v_kcal_t := round((v_tdee * 0.95) / 50.0) * 50;
      v_kcal_r := round((v_tdee * 0.92) / 50.0) * 50;
    END IF;
  END IF;

  -- HARD SAFETY RAILS
  -- 1) Minimum floor: never below physiological minimum
  v_min_kcal := CASE lower(coalesce(v_gender,'')) WHEN 'female' THEN 1200 ELSE 1500 END;
  IF v_kcal_t < v_min_kcal THEN v_kcal_t := round(v_min_kcal / 50.0) * 50; END IF;
  IF v_kcal_r < v_min_kcal - 100 THEN v_kcal_r := round((v_min_kcal - 100) / 50.0) * 50; END IF;

  -- 2) Maximum ceiling: never above what makes physiological sense
  --    - When cutting: never above TDEE
  --    - When bulking: never above TDEE + 600
  --    - When maintaining: never above TDEE + 300
  IF v_goal IN ('fat_loss','aggressive_cut') THEN
    v_max_kcal := round(v_tdee / 50.0) * 50;
  ELSIF v_goal = 'lean_bulk' THEN
    v_max_kcal := round((v_tdee + 600) / 50.0) * 50;
  ELSE
    v_max_kcal := round((v_tdee + 300) / 50.0) * 50;
  END IF;
  IF v_kcal_t > v_max_kcal THEN v_kcal_t := v_max_kcal; END IF;
  IF v_kcal_r > v_max_kcal - 200 THEN v_kcal_r := v_max_kcal - 200; END IF;

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
$function$;

-- Recompute for ALL existing users so the fix lands immediately,
-- not just for the next weight log / profile edit.
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT DISTINCT p.id
    FROM public.profiles p
    WHERE p.training_goal IS NOT NULL
      AND EXISTS (SELECT 1 FROM public.body_measurements bm WHERE bm.user_id = p.id AND bm.weight_kg IS NOT NULL)
  LOOP
    PERFORM public.compute_macro_targets(r.id);
  END LOOP;
END $$;