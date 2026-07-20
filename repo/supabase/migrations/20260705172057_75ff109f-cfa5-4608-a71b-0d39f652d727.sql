
-- Validate & auto-correct profiles.height_cm / goal_weight_kg
CREATE OR REPLACE FUNCTION public.profiles_validate_body_metrics()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- Height: auto-convert meters (e.g. 1.7) to centimeters
  IF NEW.height_cm IS NOT NULL THEN
    IF NEW.height_cm > 0 AND NEW.height_cm < 3 THEN
      NEW.height_cm := round(NEW.height_cm * 100);
    END IF;
    IF NEW.height_cm < 90 OR NEW.height_cm > 250 THEN
      RAISE EXCEPTION 'Ungültige Körpergröße: % cm. Bitte einen Wert zwischen 90 und 250 cm angeben.', NEW.height_cm
        USING ERRCODE = '22023';
    END IF;
  END IF;

  IF NEW.goal_weight_kg IS NOT NULL THEN
    IF NEW.goal_weight_kg < 25 OR NEW.goal_weight_kg > 400 THEN
      RAISE EXCEPTION 'Ungültiges Wunschgewicht: % kg. Bitte einen Wert zwischen 25 und 400 kg angeben.', NEW.goal_weight_kg
        USING ERRCODE = '22023';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_validate_body_metrics_trg ON public.profiles;
CREATE TRIGGER profiles_validate_body_metrics_trg
  BEFORE INSERT OR UPDATE OF height_cm, goal_weight_kg ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.profiles_validate_body_metrics();

-- Validate body_measurements.weight_kg
CREATE OR REPLACE FUNCTION public.body_measurements_validate()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.weight_kg IS NOT NULL AND (NEW.weight_kg < 25 OR NEW.weight_kg > 400) THEN
    RAISE EXCEPTION 'Ungültiges Gewicht: % kg. Bitte einen Wert zwischen 25 und 400 kg angeben.', NEW.weight_kg
      USING ERRCODE = '22023';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS body_measurements_validate_trg ON public.body_measurements;
CREATE TRIGGER body_measurements_validate_trg
  BEFORE INSERT OR UPDATE OF weight_kg ON public.body_measurements
  FOR EACH ROW EXECUTE FUNCTION public.body_measurements_validate();

-- Recompute macros whenever height changes on profiles
CREATE OR REPLACE FUNCTION public.trg_profile_height_recompute()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.height_cm IS DISTINCT FROM OLD.height_cm THEN
    PERFORM public.compute_macro_targets(NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_height_recompute_trg ON public.profiles;
CREATE TRIGGER profiles_height_recompute_trg
  AFTER UPDATE OF height_cm ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.trg_profile_height_recompute();
