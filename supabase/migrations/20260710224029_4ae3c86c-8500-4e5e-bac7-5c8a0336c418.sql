-- Phase 4: Trigger food_entries -> recompute Bulls nutrition day (nur für Bulls-Athleten)
CREATE OR REPLACE FUNCTION public.trg_bulls_food_entry_recompute()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _bulls_org uuid := 'b86f49ab-20b7-42ca-bba4-f65ca8757c4c';
  _uid uuid;
  _day date;
  _is_bulls boolean;
BEGIN
  IF (TG_OP = 'DELETE') THEN
    _uid := OLD.user_id;
    _day := OLD.entry_date;
  ELSE
    _uid := NEW.user_id;
    _day := NEW.entry_date;
  END IF;

  IF _uid IS NULL OR _day IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.organization_memberships
    WHERE user_id = _uid AND organization_id = _bulls_org
  ) INTO _is_bulls;

  IF _is_bulls THEN
    PERFORM public.recompute_bulls_nutrition_day(_uid, _bulls_org, _day);
    -- Also update streak because a full-tracked day contributes to it
    PERFORM public.recompute_bulls_streak(_uid, _bulls_org);
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_bulls_food_entry_recompute ON public.food_entries;
CREATE TRIGGER trg_bulls_food_entry_recompute
AFTER INSERT OR UPDATE OR DELETE ON public.food_entries
FOR EACH ROW EXECUTE FUNCTION public.trg_bulls_food_entry_recompute();
