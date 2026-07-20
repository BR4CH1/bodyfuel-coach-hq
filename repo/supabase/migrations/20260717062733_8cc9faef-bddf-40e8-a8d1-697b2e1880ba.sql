DROP POLICY IF EXISTS "player_card_design readable by everyone" ON public.player_card_design;

CREATE POLICY "player_card_design published readable by everyone"
ON public.player_card_design
FOR SELECT
TO anon, authenticated
USING (is_published = true);

CREATE POLICY "player_card_design coaches read all"
ON public.player_card_design
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'coach'::app_role) OR has_role(auth.uid(), 'platform_owner'::app_role));