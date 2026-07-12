INSERT INTO public.player_card_position_weights
  (sport, position_key, label, w_spd, w_acc, w_agi, w_pow, w_str, w_end)
VALUES
  ('basketball', 'PG', 'Point Guard',    0.20, 0.20, 0.25, 0.10, 0.10, 0.15),
  ('basketball', 'SG', 'Shooting Guard', 0.20, 0.20, 0.20, 0.15, 0.10, 0.15),
  ('basketball', 'SF', 'Small Forward',  0.15, 0.15, 0.20, 0.20, 0.15, 0.15),
  ('basketball', 'PF', 'Power Forward',  0.10, 0.10, 0.15, 0.25, 0.25, 0.15),
  ('basketball', 'C',  'Center',         0.05, 0.10, 0.15, 0.25, 0.30, 0.15),
  ('soccer', 'GK', 'Torwart',           0.10, 0.15, 0.20, 0.20, 0.20, 0.15),
  ('soccer', 'CB', 'Innenverteidiger',  0.15, 0.10, 0.15, 0.20, 0.20, 0.20),
  ('soccer', 'FB', 'Außenverteidiger',  0.20, 0.15, 0.15, 0.10, 0.10, 0.30),
  ('soccer', 'DM', 'Def. Mittelfeld',   0.15, 0.10, 0.15, 0.15, 0.15, 0.30),
  ('soccer', 'CM', 'Zentr. Mittelfeld', 0.15, 0.15, 0.15, 0.10, 0.10, 0.35),
  ('soccer', 'AM', 'Off. Mittelfeld',   0.20, 0.20, 0.20, 0.10, 0.05, 0.25),
  ('soccer', 'W',  'Flügelspieler',     0.30, 0.20, 0.20, 0.10, 0.05, 0.15),
  ('soccer', 'ST', 'Stürmer',           0.25, 0.20, 0.15, 0.20, 0.10, 0.10)
ON CONFLICT (sport, position_key) DO NOTHING;