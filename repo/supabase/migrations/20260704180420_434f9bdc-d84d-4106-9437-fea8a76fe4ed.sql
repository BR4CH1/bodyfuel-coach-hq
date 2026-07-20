ALTER TABLE public.strength_checks
  ADD COLUMN IF NOT EXISTS scoring_bodyweight_kg numeric(5,1);

COMMENT ON COLUMN public.strength_checks.scoring_bodyweight_kg IS
  'Körpergewicht, das für Strength Score V2 verwendet wurde. Priorität: bodyweight_kg am Check → letzte body_measurement <= performed_at → nächstgelegene body_measurement.';

-- Backfill: pro Check historisch passendes Körpergewicht bestimmen.
WITH resolved AS (
  SELECT sc.id,
    COALESCE(
      sc.bodyweight_kg,
      (SELECT bm.weight_kg FROM public.body_measurements bm
        WHERE bm.user_id = sc.user_id AND bm.weight_kg IS NOT NULL
          AND bm.measured_at <= sc.performed_at
        ORDER BY bm.measured_at DESC LIMIT 1),
      (SELECT bm.weight_kg FROM public.body_measurements bm
        WHERE bm.user_id = sc.user_id AND bm.weight_kg IS NOT NULL
        ORDER BY ABS(EXTRACT(EPOCH FROM (bm.measured_at::timestamp - sc.performed_at::timestamp))) ASC
        LIMIT 1)
    ) AS bw
  FROM public.strength_checks sc
  WHERE sc.status = 'completed'
)
UPDATE public.strength_checks sc
   SET scoring_bodyweight_kg = resolved.bw
  FROM resolved
 WHERE sc.id = resolved.id
   AND sc.scoring_bodyweight_kg IS DISTINCT FROM resolved.bw;