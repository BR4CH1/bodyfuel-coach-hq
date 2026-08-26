CREATE OR REPLACE FUNCTION public.training_set_logs_set_training_date()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.training_date IS NULL THEN
    NEW.training_date := (NEW.performed_at AT TIME ZONE 'UTC')::date;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS training_set_logs_set_training_date_trigger ON public.training_set_logs;
CREATE TRIGGER training_set_logs_set_training_date_trigger
BEFORE INSERT OR UPDATE OF performed_at, training_date ON public.training_set_logs
FOR EACH ROW
EXECUTE FUNCTION public.training_set_logs_set_training_date();