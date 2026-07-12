
CREATE TABLE public.player_card_badge_definitions (
  key TEXT PRIMARY KEY,
  sport TEXT NOT NULL DEFAULT 'football',
  category TEXT NOT NULL,
  label TEXT NOT NULL,
  description TEXT NOT NULL,
  icon_key TEXT NOT NULL,
  tier TEXT NOT NULL DEFAULT 'bronze',
  rule JSONB NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 100,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.player_card_badge_definitions TO authenticated;
GRANT ALL ON public.player_card_badge_definitions TO service_role;
ALTER TABLE public.player_card_badge_definitions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Badge defs lesbar für authenticated"
  ON public.player_card_badge_definitions FOR SELECT TO authenticated USING (true);

CREATE TABLE public.player_card_badge_unlocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  badge_key TEXT NOT NULL REFERENCES public.player_card_badge_definitions(key) ON DELETE CASCADE,
  organization_id UUID,
  unlocked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  snapshot_bfr INTEGER,
  seen_at TIMESTAMPTZ,
  UNIQUE(user_id, badge_key)
);
GRANT SELECT ON public.player_card_badge_unlocks TO authenticated;
GRANT ALL ON public.player_card_badge_unlocks TO service_role;
ALTER TABLE public.player_card_badge_unlocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Athlet sieht eigene Unlocks"
  ON public.player_card_badge_unlocks FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Org-Staff sieht Unlocks der Athleten"
  ON public.player_card_badge_unlocks FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.staff_assignments sa
      WHERE sa.user_id = auth.uid()
        AND sa.role IN ('coach','organization_admin')
        AND sa.organization_id = player_card_badge_unlocks.organization_id
    )
    OR public.has_role(auth.uid(), 'coach')
  );

CREATE POLICY "Athlet markiert eigene Unlocks als gesehen"
  ON public.player_card_badge_unlocks FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_pcbu_user ON public.player_card_badge_unlocks(user_id);
CREATE INDEX idx_pcbu_org ON public.player_card_badge_unlocks(organization_id);

INSERT INTO public.player_card_badge_definitions (key, category, label, description, icon_key, tier, rule, sort_order) VALUES
('rookie_card', 'milestone', 'Rookie Card', 'Deine erste Player Card wurde generiert.', 'sparkles', 'bronze', '{"type":"has_card"}'::jsonb, 10),
('tier_silver', 'tier', 'Silber-Status', 'BFR von 60 oder mehr erreicht.', 'award', 'silver', '{"type":"bfr_gte","value":60}'::jsonb, 20),
('tier_gold', 'tier', 'Gold-Status', 'BFR von 70 oder mehr erreicht.', 'award', 'gold', '{"type":"bfr_gte","value":70}'::jsonb, 21),
('tier_elite', 'tier', 'Elite-Status', 'BFR von 80 oder mehr erreicht.', 'crown', 'elite', '{"type":"bfr_gte","value":80}'::jsonb, 22),
('tier_legendary', 'tier', 'Legendary', 'BFR von 90 oder mehr erreicht.', 'crown', 'legendary', '{"type":"bfr_gte","value":90}'::jsonb, 23),
('speed_demon', 'attribute', 'Speed Demon', 'SPD von 85 oder mehr.', 'rocket', 'gold', '{"type":"attr_gte","attribute":"SPD","value":85}'::jsonb, 30),
('rocket_start', 'attribute', 'Rocket Start', 'ACC von 85 oder mehr.', 'zap', 'gold', '{"type":"attr_gte","attribute":"ACC","value":85}'::jsonb, 31),
('agility_ace', 'attribute', 'Agility Ace', 'AGI von 85 oder mehr.', 'activity', 'gold', '{"type":"attr_gte","attribute":"AGI","value":85}'::jsonb, 32),
('explosive_power', 'attribute', 'Explosive Power', 'POW von 85 oder mehr.', 'flame', 'gold', '{"type":"attr_gte","attribute":"POW","value":85}'::jsonb, 33),
('iron_beast', 'attribute', 'Iron Beast', 'STR von 85 oder mehr.', 'dumbbell', 'gold', '{"type":"attr_gte","attribute":"STR","value":85}'::jsonb, 34),
('endurance_king', 'attribute', 'Ausdauermaschine', 'END von 85 oder mehr.', 'heart-pulse', 'gold', '{"type":"attr_gte","attribute":"END","value":85}'::jsonb, 35),
('complete_athlete', 'special', 'Complete Athlete', 'Alle sechs Attribute mindestens 70.', 'shield', 'elite', '{"type":"all_attrs_gte","value":70}'::jsonb, 40),
('big_leap', 'progress', 'Großer Sprung', 'BFR ist seit erster Messung um mindestens 5 gestiegen.', 'trending-up', 'silver', '{"type":"bfr_delta_gte","value":5}'::jsonb, 50),
('consistent', 'progress', 'Konstanz', 'Fünf oder mehr Kartenaktualisierungen im Verlauf.', 'calendar-check', 'silver', '{"type":"history_count_gte","value":5}'::jsonb, 51)
ON CONFLICT (key) DO NOTHING;
