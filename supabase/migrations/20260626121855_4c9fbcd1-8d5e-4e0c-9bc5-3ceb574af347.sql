INSERT INTO public.nutrition_foods
  (name, aliases, category, source, kcal_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g, verified_by_coach, notes)
VALUES
  ('Apfelmus ungesüßt', ARRAY['apfelmus','apfelmark','apfelmark ungesüßt','apfelmus ohne zucker','apfelmus ungesuesst','apfelmark ungesuesst'], 'Obst', 'bodyfuel_verified', 52, 0.3, 11.5, 0.2, true, 'Standardwert für ungesüßtes Apfelmus/Apfelmark'),
  ('Beeren gemischt', ARRAY['beeren','gemischte beeren','beerenmix','waldbeeren','tk beeren','tiefkühlbeeren','tiefkuehlbeeren'], 'Obst', 'bodyfuel_verified', 45, 0.9, 7.5, 0.5, true, 'Durchschnitt für gemischte Beeren'),
  ('Erdbeermarmelade', ARRAY['marmelade','konfitüre','konfituere','erdbeer konfitüre','erdbeer konfituere'], 'Süßes', 'bodyfuel_verified', 250, 0.4, 60, 0.1, true, 'Standardwert Konfitüre'),
  ('Protein Pudding', ARRAY['proteinpudding','eiweißpudding','eiweisspudding','high protein pudding'], 'Milch', 'bodyfuel_verified', 76, 10, 5, 1.5, true, 'Durchschnitt High-Protein-Pudding'),
  ('Protein Shake fertig', ARRAY['proteinshake','protein shake','eiweißshake','eiweissshake','proteindrink','skyr drink','skyr-drink'], 'Getränke', 'bodyfuel_verified', 65, 10, 4, 1, true, 'Durchschnitt fertiger Proteinshake'),
  ('Hummus', ARRAY['humus','kichererbsenaufstrich'], 'Aufstrich', 'bodyfuel_verified', 270, 8, 14, 19, true, 'Standardwert Hummus'),
  ('Tzatziki', ARRAY['tsatsiki','zaziki'], 'Aufstrich', 'bodyfuel_verified', 125, 4, 4, 10, true, 'Standardwert Tzatziki'),
  ('Guacamole', ARRAY['guacamole fertig','avocado dip','avocadodip'], 'Aufstrich', 'bodyfuel_verified', 160, 2, 5, 14, true, 'Standardwert Guacamole'),
  ('Beef Jerky', ARRAY['jerky','rindfleisch jerky','trockenfleisch'], 'Protein', 'bodyfuel_verified', 290, 52, 10, 4, true, 'Standardwert Beef Jerky'),
  ('Datteln getrocknet', ARRAY['datteln','medjool datteln','trockenfrüchte datteln','trockenfruechte datteln'], 'Obst', 'bodyfuel_verified', 285, 2, 65, 0.5, true, 'Standardwert getrocknete Datteln')
ON CONFLICT (source, source_id) DO NOTHING;