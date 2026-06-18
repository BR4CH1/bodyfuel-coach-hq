CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  chosen_role public.app_role;
  chosen_key text;
  chosen_tier text;
  v_height numeric;
  v_weight numeric;
  v_gender text;
  v_birthdate date;
  v_goal text;
  v_age integer;
  v_bmr numeric;
  v_kcal_t integer;
  v_kcal_r integer;
  v_protein integer;
  v_fat_t integer;
  v_fat_r integer;
  v_carbs_t integer;
  v_carbs_r integer;
  v_goal_t_mult numeric;
  v_goal_r_mult numeric;
  v_protein_per_kg numeric;
BEGIN
  chosen_tier := NEW.raw_user_meta_data->>'tier';

  IF chosen_tier = 'free' THEN
    chosen_role := 'free'::public.app_role;
  ELSIF NEW.raw_user_meta_data->>'role' IN ('coach', 'client', 'free') THEN
    chosen_role := (NEW.raw_user_meta_data->>'role')::public.app_role;
  ELSE
    chosen_role := 'client'::public.app_role;
  END IF;

  chosen_key := NEW.raw_user_meta_data->>'demo_client_key';

  IF coalesce(NEW.raw_user_meta_data->>'seed_height_cm', '') ~ '^[0-9]+(\.[0-9]+)?$' THEN
    v_height := (NEW.raw_user_meta_data->>'seed_height_cm')::numeric;
  END IF;

  IF coalesce(NEW.raw_user_meta_data->>'seed_weight_kg', '') ~ '^[0-9]+([\.,][0-9]+)?$' THEN
    v_weight := replace(NEW.raw_user_meta_data->>'seed_weight_kg', ',', '.')::numeric;
  END IF;

  IF NEW.raw_user_meta_data->>'seed_gender' IN ('male', 'female', 'other') THEN
    v_gender := NEW.raw_user_meta_data->>'seed_gender';
  END IF;

  IF coalesce(NEW.raw_user_meta_data->>'seed_birthdate', '') ~ '^\d{4}-\d{2}-\d{2}$' THEN
    v_birthdate := (NEW.raw_user_meta_data->>'seed_birthdate')::date;
  END IF;

  IF NEW.raw_user_meta_data->>'seed_goal' IN ('fat_loss', 'maintain', 'lean_bulk') THEN
    v_goal := NEW.raw_user_meta_data->>'seed_goal';
  ELSIF chosen_role = 'free' THEN
    v_goal := 'maintain';
  END IF;

  INSERT INTO public.profiles (
    id,
    display_name,
    demo_client_key,
    height_cm,
    gender,
    birthdate,
    training_goal
  )
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)),
    chosen_key,
    v_height,
    v_gender,
    v_birthdate,
    v_goal
  )
  ON CONFLICT (id) DO UPDATE SET
    display_name = COALESCE(public.profiles.display_name, EXCLUDED.display_name),
    demo_client_key = COALESCE(public.profiles.demo_client_key, EXCLUDED.demo_client_key),
    height_cm = COALESCE(public.profiles.height_cm, EXCLUDED.height_cm),
    gender = COALESCE(public.profiles.gender, EXCLUDED.gender),
    birthdate = COALESCE(public.profiles.birthdate, EXCLUDED.birthdate),
    training_goal = COALESCE(public.profiles.training_goal, EXCLUDED.training_goal);

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, chosen_role)
  ON CONFLICT (user_id, role) DO NOTHING;

  IF chosen_role = 'free'::public.app_role AND v_weight IS NOT NULL THEN
    INSERT INTO public.body_measurements (user_id, weight_kg, measured_at)
    VALUES (NEW.id, v_weight, current_date);

    v_goal := COALESCE(v_goal, 'maintain');
    v_age := CASE
      WHEN v_birthdate IS NULL THEN NULL
      ELSE GREATEST(15, EXTRACT(YEAR FROM age(v_birthdate))::int)
    END;

    IF v_height IS NOT NULL AND v_age IS NOT NULL THEN
      v_bmr := CASE
        WHEN v_gender = 'female' THEN 10 * v_weight + 6.25 * v_height - 5 * v_age - 161
        ELSE 10 * v_weight + 6.25 * v_height - 5 * v_age + 5
      END;
    ELSE
      v_bmr := v_weight * 24;
    END IF;

    v_goal_t_mult := CASE v_goal
      WHEN 'fat_loss' THEN 0.80
      WHEN 'lean_bulk' THEN 1.10
      ELSE 1.00
    END;
    v_goal_r_mult := CASE v_goal
      WHEN 'fat_loss' THEN 0.78
      WHEN 'lean_bulk' THEN 1.05
      ELSE 1.00
    END;
    v_protein_per_kg := CASE v_goal
      WHEN 'fat_loss' THEN 2.2
      WHEN 'lean_bulk' THEN 2.0
      ELSE 1.8
    END;

    v_kcal_t := GREATEST(1000, round((v_bmr * 1.6 * v_goal_t_mult) / 50.0) * 50)::int;
    v_kcal_r := GREATEST(1000, round((v_bmr * 1.4 * v_goal_r_mult) / 50.0) * 50)::int;
    v_protein := round(v_weight * v_protein_per_kg)::int;
    v_fat_t := round(v_weight * CASE WHEN v_goal = 'fat_loss' THEN 0.8 ELSE 0.9 END)::int;
    v_fat_r := round(v_weight * CASE WHEN v_goal = 'fat_loss' THEN 0.9 ELSE 1.0 END)::int;
    v_carbs_t := GREATEST(0, round((v_kcal_t - v_protein * 4 - v_fat_t * 9) / 4.0))::int;
    v_carbs_r := GREATEST(0, round((v_kcal_r - v_protein * 4 - v_fat_r * 9) / 4.0))::int;

    INSERT INTO public.nutrition_targets (
      user_id,
      kcal,
      protein_g,
      carbs_g,
      fat_g,
      water_glasses,
      kcal_rest,
      protein_g_rest,
      carbs_g_rest,
      fat_g_rest,
      updated_by
    )
    VALUES (
      NEW.id,
      v_kcal_t,
      v_protein,
      v_carbs_t,
      v_fat_t,
      8,
      v_kcal_r,
      v_protein,
      v_carbs_r,
      v_fat_r,
      NEW.id
    )
    ON CONFLICT (user_id) DO UPDATE SET
      kcal = EXCLUDED.kcal,
      protein_g = EXCLUDED.protein_g,
      carbs_g = EXCLUDED.carbs_g,
      fat_g = EXCLUDED.fat_g,
      water_glasses = EXCLUDED.water_glasses,
      kcal_rest = EXCLUDED.kcal_rest,
      protein_g_rest = EXCLUDED.protein_g_rest,
      carbs_g_rest = EXCLUDED.carbs_g_rest,
      fat_g_rest = EXCLUDED.fat_g_rest,
      updated_by = EXCLUDED.updated_by,
      updated_at = now();
  END IF;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO service_role;