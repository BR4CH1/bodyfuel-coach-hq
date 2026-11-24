ALTER POLICY "Badge defs lesbar für authenticated" ON public.player_card_badge_definitions USING (auth.uid() IS NOT NULL);
ALTER POLICY "benchmarks readable by all authenticated" ON public.player_card_benchmarks USING (auth.uid() IS NOT NULL);
ALTER POLICY "food_versions readable" ON public.food_versions USING (auth.uid() IS NOT NULL);
ALTER POLICY "Anyone authenticated can read achievements" ON public.achievements USING (auth.uid() IS NOT NULL);
ALTER POLICY "food_aliases readable" ON public.food_aliases USING (auth.uid() IS NOT NULL);
ALTER POLICY "food_nutrients readable" ON public.food_nutrients USING (auth.uid() IS NOT NULL);
ALTER POLICY "nutrients readable" ON public.nutrients USING (auth.uid() IS NOT NULL);
ALTER POLICY "position weights readable by all authenticated" ON public.player_card_position_weights USING (auth.uid() IS NOT NULL);
ALTER POLICY "food_translations readable" ON public.food_translations USING (auth.uid() IS NOT NULL);