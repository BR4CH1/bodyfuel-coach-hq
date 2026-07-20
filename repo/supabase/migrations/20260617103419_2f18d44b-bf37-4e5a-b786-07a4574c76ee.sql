
-- Allow coaches to upsert smart_nutrition_profile rows for their customers
-- (e.g. toggling auto_publish from the coach plan-management view).
CREATE POLICY "snp coach insert" ON public.smart_nutrition_profile
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'coach'));

CREATE POLICY "snp coach update" ON public.smart_nutrition_profile
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'coach'))
  WITH CHECK (public.has_role(auth.uid(), 'coach'));

-- Extend the nutrition_plans file_path validation trigger so partner plans
-- (path prefix "ai-generated/partner/<client_id>/...") are also accepted.
CREATE OR REPLACE FUNCTION public.validate_nutrition_plan_file_path()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  cid text := NEW.client_id::text;
BEGIN
  IF NEW.file_path IS NULL OR NEW.file_path = '' THEN
    RETURN NEW;
  END IF;
  IF position((cid || '/') in NEW.file_path) = 1
     OR position(('ai-generated/' || cid || '/') in NEW.file_path) = 1
     OR position(('ai-generated/partner/' || cid || '/') in NEW.file_path) = 1 THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'file_path % must start with client_id folder %/ or ai-generated/%/ or ai-generated/partner/%/',
    NEW.file_path, cid, cid, cid;
END;
$function$;
