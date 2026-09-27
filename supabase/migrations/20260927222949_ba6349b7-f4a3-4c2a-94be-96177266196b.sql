CREATE TABLE public.food_log_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  raw_text text NOT NULL,
  text_hash text NOT NULL,
  input_mode text NOT NULL DEFAULT 'text' CHECK (input_mode IN ('text','voice')),
  status text NOT NULL DEFAULT 'parsed' CHECK (status IN ('parsed','committed','discarded')),
  parsed jsonb NOT NULL DEFAULT '{}'::jsonb,
  resolved_date date,
  parser_version text NOT NULL DEFAULT 'v1',
  committed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.food_log_drafts TO authenticated;
GRANT ALL ON public.food_log_drafts TO service_role;
ALTER TABLE public.food_log_drafts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own food log drafts" ON public.food_log_drafts FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX food_log_drafts_user_created_idx ON public.food_log_drafts (user_id, created_at DESC);
CREATE INDEX food_log_drafts_user_hash_idx ON public.food_log_drafts (user_id, text_hash);

CREATE OR REPLACE FUNCTION public.food_log_drafts_touch() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
CREATE TRIGGER food_log_drafts_touch BEFORE UPDATE ON public.food_log_drafts FOR EACH ROW EXECUTE FUNCTION public.food_log_drafts_touch();

ALTER TABLE public.food_entries
  ADD COLUMN IF NOT EXISTS log_draft_id uuid REFERENCES public.food_log_drafts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS log_item_key text,
  ADD COLUMN IF NOT EXISTS estimate_level text CHECK (estimate_level IS NULL OR estimate_level IN ('exact','matched','estimated')),
  ADD COLUMN IF NOT EXISTS raw_phrase text;
CREATE UNIQUE INDEX IF NOT EXISTS food_entries_log_item_uniq ON public.food_entries (log_draft_id, log_item_key)
  WHERE log_draft_id IS NOT NULL;

-- Atomarer, idempotenter Commit. Läuft als aufrufender Nutzer (RLS gilt).
CREATE OR REPLACE FUNCTION public.commit_food_log(_draft_id uuid, _items jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE
  _uid uuid := auth.uid();
  _draft public.food_log_drafts%ROWTYPE;
  _inserted int := 0;
  _item jsonb;
  _food uuid;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  SELECT * INTO _draft FROM public.food_log_drafts WHERE id = _draft_id AND user_id = _uid FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'draft not found'; END IF;
  IF _draft.status = 'committed' THEN
    RETURN jsonb_build_object('inserted', 0, 'already_committed', true);
  END IF;
  IF _draft.status <> 'parsed' THEN RAISE EXCEPTION 'draft not committable'; END IF;
  IF jsonb_typeof(_items) <> 'array' OR jsonb_array_length(_items) = 0 OR jsonb_array_length(_items) > 60 THEN
    RAISE EXCEPTION 'invalid items';
  END IF;

  FOR _item IN SELECT * FROM jsonb_array_elements(_items) LOOP
    _food := NULLIF(_item->>'food_id','')::uuid;
    IF _food IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.nutrition_foods WHERE id = _food) THEN
      _food := NULL;
    END IF;
    INSERT INTO public.food_entries (user_id, entry_date, meal, name, brand, food_id, serving_amount, amount_unit,
      serving_g, kcal, protein_g, carbs_g, fat_g, source, log_draft_id, log_item_key, estimate_level, raw_phrase)
    VALUES (_uid, (_item->>'entry_date')::date, _item->>'meal', left(_item->>'name',120), NULLIF(_item->>'brand',''), _food,
      (_item->>'amount')::numeric, _item->>'unit', (_item->>'grams')::numeric,
      (_item->>'kcal')::numeric, (_item->>'protein_g')::numeric, (_item->>'carbs_g')::numeric, (_item->>'fat_g')::numeric,
      'quick_log', _draft_id, _item->>'key', _item->>'estimate_level', left(_item->>'raw_phrase', 300))
    ON CONFLICT (log_draft_id, log_item_key) WHERE log_draft_id IS NOT NULL DO NOTHING;
    IF FOUND THEN _inserted := _inserted + 1; END IF;
  END LOOP;

  UPDATE public.food_log_drafts SET status = 'committed', committed_at = now() WHERE id = _draft_id;
  RETURN jsonb_build_object('inserted', _inserted, 'already_committed', false);
END; $$;
REVOKE ALL ON FUNCTION public.commit_food_log(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.commit_food_log(uuid, jsonb) TO authenticated;

-- Aufräumen: unbestätigte Entwürfe nach 7 Tagen, Rohtext bestätigter Entwürfe nach 7 Tagen leeren.
CREATE OR REPLACE FUNCTION public.cleanup_food_log_drafts() RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  DELETE FROM public.food_log_drafts WHERE status <> 'committed' AND created_at < now() - interval '7 days';
  UPDATE public.food_log_drafts SET raw_text = '', parsed = '{}'::jsonb
    WHERE status = 'committed' AND created_at < now() - interval '7 days' AND raw_text <> '';
$$;
REVOKE ALL ON FUNCTION public.cleanup_food_log_drafts() FROM PUBLIC, anon, authenticated;
DO $$ BEGIN
  PERFORM cron.schedule('cleanup-food-log-drafts', '17 3 * * *', 'select public.cleanup_food_log_drafts()');
EXCEPTION WHEN others THEN NULL; END $$;