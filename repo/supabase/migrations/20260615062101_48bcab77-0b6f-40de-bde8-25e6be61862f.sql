
-- 1) app_reviews: restrict the "public" SELECT policy to authenticated users.
DROP POLICY IF EXISTS "Public can read published reviews" ON public.app_reviews;
CREATE POLICY "Authenticated can read published reviews"
  ON public.app_reviews
  FOR SELECT
  TO authenticated
  USING (publish_with_name = true AND approved_for_public = true AND hidden = false);

-- Ensure anon has no table access at all.
REVOKE ALL ON public.app_reviews FROM anon;

-- 2) daily_checks: prevent clients from writing the points column directly.
REVOKE INSERT, UPDATE ON public.daily_checks FROM authenticated;
GRANT INSERT (user_id, check_date, tasks) ON public.daily_checks TO authenticated;
GRANT UPDATE (tasks) ON public.daily_checks TO authenticated;

-- 3) nutrition_plans: enforce file_path is scoped under the client's UUID folder.
CREATE OR REPLACE FUNCTION public.validate_nutrition_plan_file_path()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.file_path IS NOT NULL AND NEW.file_path <> ''
     AND position((NEW.client_id::text || '/') in NEW.file_path) <> 1 THEN
    RAISE EXCEPTION 'file_path % must start with client_id folder %/', NEW.file_path, NEW.client_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_nutrition_plan_file_path ON public.nutrition_plans;
CREATE TRIGGER trg_validate_nutrition_plan_file_path
  BEFORE INSERT OR UPDATE OF file_path, client_id ON public.nutrition_plans
  FOR EACH ROW EXECUTE FUNCTION public.validate_nutrition_plan_file_path();
