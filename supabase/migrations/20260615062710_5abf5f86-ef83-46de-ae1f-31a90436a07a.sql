CREATE OR REPLACE FUNCTION public.validate_nutrition_plan_file_path()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  cid text := NEW.client_id::text;
BEGIN
  IF NEW.file_path IS NULL OR NEW.file_path = '' THEN
    RETURN NEW;
  END IF;
  IF position((cid || '/') in NEW.file_path) = 1
     OR position(('ai-generated/' || cid || '/') in NEW.file_path) = 1 THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'file_path % must start with client_id folder %/ or ai-generated/%/',
    NEW.file_path, cid, cid;
END;
$$;