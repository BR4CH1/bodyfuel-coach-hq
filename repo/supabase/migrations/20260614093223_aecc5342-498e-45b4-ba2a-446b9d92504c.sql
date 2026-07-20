
ALTER TABLE public.nutrition_plans
  ADD COLUMN IF NOT EXISTS scheduled_start_date date,
  ADD COLUMN IF NOT EXISTS scheduled_end_date date,
  ADD COLUMN IF NOT EXISTS activated_at timestamptz,
  ADD COLUMN IF NOT EXISTS archived_at timestamptz,
  ADD COLUMN IF NOT EXISTS kcal int,
  ADD COLUMN IF NOT EXISTS protein_g int,
  ADD COLUMN IF NOT EXISTS carbs_g int,
  ADD COLUMN IF NOT EXISTS fat_g int,
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'upload';

UPDATE public.nutrition_plans
   SET status = CASE
     WHEN is_active = true THEN 'active'
     WHEN status = 'active' AND is_active = false THEN 'archived'
     ELSE COALESCE(status, 'archived')
   END;

-- Collapse duplicates: keep newest draft/approved/published per client+type, archive rest
WITH ranked AS (
  SELECT id,
         row_number() OVER (PARTITION BY client_id, plan_type ORDER BY created_at DESC) AS rn
    FROM public.nutrition_plans
   WHERE status IN ('draft','approved','published')
)
UPDATE public.nutrition_plans p
   SET status = 'archived'
  FROM ranked r
 WHERE p.id = r.id AND r.rn > 1;

-- Same for active (defensive)
WITH ranked AS (
  SELECT id,
         row_number() OVER (PARTITION BY client_id, plan_type ORDER BY created_at DESC) AS rn
    FROM public.nutrition_plans
   WHERE status = 'active'
)
UPDATE public.nutrition_plans p
   SET status = 'archived'
  FROM ranked r
 WHERE p.id = r.id AND r.rn > 1;

ALTER TABLE public.nutrition_plans
  DROP CONSTRAINT IF EXISTS nutrition_plans_status_check;
ALTER TABLE public.nutrition_plans
  ADD CONSTRAINT nutrition_plans_status_check
  CHECK (status IN ('draft','approved','published','active','archived'));

ALTER TABLE public.nutrition_plans
  DROP CONSTRAINT IF EXISTS nutrition_plans_source_check;
ALTER TABLE public.nutrition_plans
  ADD CONSTRAINT nutrition_plans_source_check
  CHECK (source IN ('upload','smart_ai','manual'));

DROP INDEX IF EXISTS nutrition_plans_one_active_per_client;
CREATE UNIQUE INDEX nutrition_plans_one_active_per_client
  ON public.nutrition_plans (client_id, plan_type)
  WHERE status = 'active';

DROP INDEX IF EXISTS nutrition_plans_one_next_per_client;
CREATE UNIQUE INDEX nutrition_plans_one_next_per_client
  ON public.nutrition_plans (client_id, plan_type)
  WHERE status IN ('draft','approved','published');

CREATE OR REPLACE FUNCTION public.np_sync_is_active()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.is_active := (NEW.status = 'active');
  IF NEW.status = 'active' AND (TG_OP = 'INSERT' OR OLD.status <> 'active') THEN
    NEW.activated_at := COALESCE(NEW.activated_at, now());
  END IF;
  IF NEW.status = 'archived' AND (TG_OP = 'INSERT' OR OLD.status <> 'archived') THEN
    NEW.archived_at := COALESCE(NEW.archived_at, now());
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS np_sync_is_active_trg ON public.nutrition_plans;
CREATE TRIGGER np_sync_is_active_trg
  BEFORE INSERT OR UPDATE ON public.nutrition_plans
  FOR EACH ROW EXECUTE FUNCTION public.np_sync_is_active();
