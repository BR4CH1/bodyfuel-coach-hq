
ALTER TABLE public.day_type_overrides DROP CONSTRAINT IF EXISTS day_type_overrides_kind_check;
ALTER TABLE public.day_type_overrides ADD CONSTRAINT day_type_overrides_kind_check
  CHECK (kind IN ('training','rest','strength','football_training','game_day','double_session'));
ALTER TABLE public.day_type_overrides ADD COLUMN IF NOT EXISTS session_intensity TEXT;
ALTER TABLE public.day_type_overrides DROP CONSTRAINT IF EXISTS day_type_overrides_session_intensity_check;
ALTER TABLE public.day_type_overrides ADD CONSTRAINT day_type_overrides_session_intensity_check
  CHECK (session_intensity IS NULL OR session_intensity IN ('LIGHT','MODERATE','HARD'));
