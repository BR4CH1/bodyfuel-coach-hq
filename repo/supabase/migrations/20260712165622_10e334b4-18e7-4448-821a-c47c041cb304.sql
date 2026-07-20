-- Player Card Position Weights
CREATE TABLE public.player_card_position_weights (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sport TEXT NOT NULL,
  position_key TEXT NOT NULL,
  label TEXT NOT NULL,
  w_spd NUMERIC NOT NULL,
  w_acc NUMERIC NOT NULL,
  w_agi NUMERIC NOT NULL,
  w_pow NUMERIC NOT NULL,
  w_str NUMERIC NOT NULL,
  w_end NUMERIC NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (sport, position_key)
);
GRANT SELECT ON public.player_card_position_weights TO authenticated;
GRANT ALL ON public.player_card_position_weights TO service_role;
ALTER TABLE public.player_card_position_weights ENABLE ROW LEVEL SECURITY;
CREATE POLICY "position weights readable by all authenticated"
  ON public.player_card_position_weights FOR SELECT TO authenticated USING (true);

-- Player Card Benchmarks
CREATE TABLE public.player_card_benchmarks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sport TEXT NOT NULL,
  attribute_key TEXT NOT NULL,
  metric_key TEXT NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('higher_is_better','lower_is_better','ratio_higher_is_better')),
  anchors JSONB NOT NULL,
  weight NUMERIC NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (sport, attribute_key, metric_key)
);
GRANT SELECT ON public.player_card_benchmarks TO authenticated;
GRANT ALL ON public.player_card_benchmarks TO service_role;
ALTER TABLE public.player_card_benchmarks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "benchmarks readable by all authenticated"
  ON public.player_card_benchmarks FOR SELECT TO authenticated USING (true);

-- Player Cards
CREATE TABLE public.player_cards (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  organization_id UUID,
  sport TEXT NOT NULL DEFAULT 'football',
  position_key TEXT,
  bfr INTEGER,
  spd INTEGER, acc INTEGER, agi INTEGER,
  pow INTEGER, str INTEGER, end_score INTEGER,
  tier TEXT CHECK (tier IN ('bronze','silver','gold','elite','legendary')),
  is_provisional BOOLEAN NOT NULL DEFAULT false,
  missing_tests JSONB NOT NULL DEFAULT '[]'::jsonb,
  attributes_detail JSONB NOT NULL DEFAULT '{}'::jsonb,
  strongest_attribute TEXT,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);
GRANT SELECT ON public.player_cards TO authenticated;
GRANT ALL ON public.player_cards TO service_role;
ALTER TABLE public.player_cards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "player cards own read"
  ON public.player_cards FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "player cards org staff read"
  ON public.player_cards FOR SELECT TO authenticated
  USING (
    organization_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.organization_memberships om
      WHERE om.organization_id = player_cards.organization_id
        AND om.user_id = auth.uid()
        AND om.role IN ('organization_admin','coach','staff')
    )
  );

CREATE POLICY "player cards coach global read"
  ON public.player_cards FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'platform_owner'::app_role) OR public.has_role(auth.uid(), 'coach'::app_role));

-- Player Card History
CREATE TABLE public.player_card_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  organization_id UUID,
  sport TEXT NOT NULL DEFAULT 'football',
  position_key TEXT,
  bfr INTEGER,
  spd INTEGER, acc INTEGER, agi INTEGER,
  pow INTEGER, str INTEGER, end_score INTEGER,
  tier TEXT,
  is_provisional BOOLEAN NOT NULL DEFAULT false,
  attributes_detail JSONB NOT NULL DEFAULT '{}'::jsonb,
  snapshot_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX player_card_history_user_snapshot_idx ON public.player_card_history (user_id, snapshot_at DESC);
GRANT SELECT ON public.player_card_history TO authenticated;
GRANT ALL ON public.player_card_history TO service_role;
ALTER TABLE public.player_card_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "player card history own read"
  ON public.player_card_history FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "player card history org staff read"
  ON public.player_card_history FOR SELECT TO authenticated
  USING (
    organization_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.organization_memberships om
      WHERE om.organization_id = player_card_history.organization_id
        AND om.user_id = auth.uid()
        AND om.role IN ('organization_admin','coach','staff')
    )
  );

CREATE POLICY "player card history coach global read"
  ON public.player_card_history FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'platform_owner'::app_role) OR public.has_role(auth.uid(), 'coach'::app_role));

-- Triggers
CREATE TRIGGER player_cards_updated_at
  BEFORE UPDATE ON public.player_cards
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER player_card_position_weights_updated_at
  BEFORE UPDATE ON public.player_card_position_weights
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER player_card_benchmarks_updated_at
  BEFORE UPDATE ON public.player_card_benchmarks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed position weights (football)
INSERT INTO public.player_card_position_weights (sport, position_key, label, w_spd, w_acc, w_agi, w_pow, w_str, w_end) VALUES
  ('football','QB','Quarterback',       0.20, 0.20, 0.20, 0.15, 0.15, 0.10),
  ('football','RB','Running Back',      0.25, 0.25, 0.15, 0.15, 0.10, 0.10),
  ('football','WR','Wide Receiver',     0.30, 0.20, 0.20, 0.10, 0.05, 0.15),
  ('football','TE','Tight End',         0.15, 0.15, 0.15, 0.20, 0.20, 0.15),
  ('football','OL','Offensive Line',    0.05, 0.10, 0.10, 0.25, 0.35, 0.15),
  ('football','DL','Defensive Line',    0.10, 0.15, 0.10, 0.25, 0.30, 0.10),
  ('football','LB','Linebacker',        0.20, 0.15, 0.15, 0.20, 0.20, 0.10),
  ('football','CB','Cornerback',        0.30, 0.25, 0.20, 0.05, 0.05, 0.15),
  ('football','S', 'Safety',            0.25, 0.20, 0.20, 0.10, 0.10, 0.15);

-- Seed benchmarks
INSERT INTO public.player_card_benchmarks (sport, attribute_key, metric_key, direction, anchors, weight) VALUES
  ('football','SPD','sprint_40yd','lower_is_better',
    '[{"value":4.30,"score":99},{"value":4.50,"score":90},{"value":4.70,"score":80},{"value":4.90,"score":70},{"value":5.10,"score":60},{"value":5.30,"score":50},{"value":5.60,"score":40},{"value":6.00,"score":25}]'::jsonb, 1.0),
  ('football','ACC','sprint_10yd','lower_is_better',
    '[{"value":1.45,"score":99},{"value":1.55,"score":90},{"value":1.65,"score":80},{"value":1.75,"score":70},{"value":1.85,"score":60},{"value":1.95,"score":50},{"value":2.10,"score":40},{"value":2.30,"score":25}]'::jsonb, 1.0),
  ('football','AGI','a505_avg','lower_is_better',
    '[{"value":2.10,"score":99},{"value":2.25,"score":90},{"value":2.40,"score":80},{"value":2.55,"score":70},{"value":2.70,"score":60},{"value":2.90,"score":50},{"value":3.10,"score":40},{"value":3.40,"score":25}]'::jsonb, 1.0),
  ('football','POW','broad_jump','higher_is_better',
    '[{"value":180,"score":25},{"value":210,"score":40},{"value":240,"score":55},{"value":265,"score":70},{"value":285,"score":80},{"value":305,"score":90},{"value":325,"score":99}]'::jsonb, 0.5),
  ('football','POW','cmj_height','higher_is_better',
    '[{"value":25,"score":25},{"value":35,"score":40},{"value":45,"score":55},{"value":55,"score":70},{"value":65,"score":80},{"value":75,"score":90},{"value":85,"score":99}]'::jsonb, 0.5),
  ('football','STR','bench_press_5rm','ratio_higher_is_better',
    '[{"value":0.70,"score":25},{"value":0.90,"score":40},{"value":1.10,"score":55},{"value":1.30,"score":70},{"value":1.50,"score":80},{"value":1.70,"score":90},{"value":1.90,"score":99}]'::jsonb, 0.5),
  ('football','STR','trap_bar_5rm','ratio_higher_is_better',
    '[{"value":1.20,"score":25},{"value":1.50,"score":40},{"value":1.80,"score":55},{"value":2.10,"score":70},{"value":2.40,"score":80},{"value":2.70,"score":90},{"value":3.00,"score":99}]'::jsonb, 0.5),
  ('football','END','rast_6x35m','lower_is_better',
    '[{"value":28,"score":99},{"value":30,"score":90},{"value":32,"score":80},{"value":34,"score":70},{"value":36,"score":60},{"value":38,"score":50},{"value":41,"score":40},{"value":45,"score":25}]'::jsonb, 1.0);