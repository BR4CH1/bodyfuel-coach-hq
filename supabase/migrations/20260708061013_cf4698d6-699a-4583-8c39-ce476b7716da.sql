-- Reactivate Bulls Performance plans that were incorrectly archived by
-- plan-rotation because it ignored performance_context. Newest performance
-- plan per client is restored to 'active'; the trigger np_sync_is_active
-- syncs is_active accordingly.
WITH ranked AS (
  SELECT id, client_id,
         row_number() OVER (PARTITION BY client_id ORDER BY created_at DESC) AS rn
  FROM public.nutrition_plans
  WHERE performance_context = true
    AND plan_type = 'nutrition'
    AND status = 'archived'
    AND (scheduled_end_date IS NULL OR scheduled_end_date >= CURRENT_DATE)
)
UPDATE public.nutrition_plans np
SET status = 'active'
FROM ranked
WHERE np.id = ranked.id AND ranked.rn = 1;