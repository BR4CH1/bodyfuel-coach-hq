
-- Erweiterte Kategorien: 'stretch' als eigene Kategorie zulassen
ALTER TABLE public.coach_exercise_library DROP CONSTRAINT IF EXISTS coach_exercise_library_category_check;
ALTER TABLE public.coach_exercise_library ADD CONSTRAINT coach_exercise_library_category_check
  CHECK (category IN ('barbell','dumbbell','machine','cable','bodyweight','core','cardio','stretch'));

ALTER TABLE public.coach_exercise_library DROP CONSTRAINT IF EXISTS coach_exercise_library_movement_pattern_check;
ALTER TABLE public.coach_exercise_library ADD CONSTRAINT coach_exercise_library_movement_pattern_check
  CHECK (movement_pattern IN ('squat','hinge','lunge','push_h','push_v','pull_h','pull_v','carry','core','cardio','isolation','mobility'));

-- Unique auf Name, damit Re-Runs sicher sind
CREATE UNIQUE INDEX IF NOT EXISTS coach_exercise_library_name_uniq ON public.coach_exercise_library(name);

-- Zusätzliche gängige Studio-Übungen
INSERT INTO public.coach_exercise_library (name, category, primary_muscle, secondary_muscles, equipment, movement_pattern, is_unilateral, difficulty, default_sets, default_reps, default_rest_seconds, notes) VALUES
-- BRUST
('Schrägbankdrücken Kurzhantel','dumbbell','upper_chest','{triceps,front_delts}','{dumbbells,incline_bench}','push_h',false,'intermediate',3,'8-10',120,NULL),
('Negativbankdrücken','barbell','chest','{triceps}','{barbell,decline_bench}','push_h',false,'intermediate',3,'8-10',120,NULL),
('Cable Fly (Brust)','cable','chest','{front_delts}','{cable}','isolation',false,'beginner',3,'12-15',60,NULL),
('Kurzhantel Fly Flachbank','dumbbell','chest','{front_delts}','{dumbbells,bench}','isolation',false,'beginner',3,'10-12',60,NULL),
('Schrägbank Fly Kurzhantel','dumbbell','upper_chest','{front_delts}','{dumbbells,incline_bench}','isolation',false,'beginner',3,'10-12',60,NULL),
('Enges Bankdrücken','barbell','triceps','{chest,front_delts}','{barbell,bench}','push_h',false,'intermediate',3,'8-10',90,'Ellbogen nah am Körper.'),
('Liegestütz enger Griff','bodyweight','triceps','{chest,core}','{}','push_h',false,'intermediate',3,'8-15',60,NULL),
('Chest Press Maschine (Hammer)','machine','chest','{triceps,front_delts}','{chest_press}','push_h',false,'beginner',3,'8-10',90,NULL),
-- RÜCKEN
('Klimmzug enger Griff','bodyweight','back','{biceps}','{pull_up_bar}','pull_v',false,'advanced',3,'6-10',120,NULL),
('Klimmzug Neutralgriff','bodyweight','back','{biceps}','{pull_up_bar}','pull_v',false,'advanced',3,'6-10',120,NULL),
('Assisted Pull-Up Maschine','machine','back','{biceps}','{assisted_pullup}','pull_v',false,'beginner',3,'8-10',90,NULL),
('Kabelzug einarmig','cable','back','{biceps}','{cable}','pull_h',true,'beginner',3,'12 je Seite',75,NULL),
('Straight Arm Pulldown','cable','lats','{triceps}','{cable}','isolation',false,'beginner',3,'12-15',60,NULL),
('Reverse Fly Maschine','machine','rear_delts','{back}','{reverse_fly}','isolation',false,'beginner',3,'12-15',60,NULL),
('Face Pull','cable','rear_delts','{back,traps}','{cable,rope}','isolation',false,'beginner',3,'12-15',60,NULL),
('Hyperextension','bodyweight','lower_back','{glutes,hamstrings}','{hyper_bench}','hinge',false,'beginner',3,'12-15',60,NULL),
('Rack Pulls','barbell','back','{glutes,hamstrings}','{barbell,rack}','hinge',false,'advanced',3,'5-8',150,NULL),
('Meadows Row','dumbbell','back','{biceps,rear_delts}','{barbell}','pull_h',true,'advanced',3,'10 je Seite',90,NULL),
-- SCHULTERN
('Frontheben Kurzhantel','dumbbell','front_delts','{}','{dumbbells}','isolation',false,'beginner',3,'12-15',60,NULL),
('Reverse Pec Deck','machine','rear_delts','{}','{pec_deck}','isolation',false,'beginner',3,'12-15',60,NULL),
('Arnold Press','dumbbell','shoulders','{triceps}','{dumbbells}','push_v',false,'intermediate',3,'8-10',90,NULL),
('Aufrechtes Rudern Kabel','cable','shoulders','{traps}','{cable}','pull_v',false,'intermediate',3,'10-12',75,NULL),
('Shrugs Kurzhantel','dumbbell','traps','{}','{dumbbells}','isolation',false,'beginner',3,'12-15',60,NULL),
('Shrugs Langhantel','barbell','traps','{}','{barbell}','isolation',false,'beginner',3,'10-12',60,NULL),
('Landmine Press','barbell','shoulders','{triceps,core}','{landmine}','push_v',true,'intermediate',3,'10 je Seite',90,NULL),
-- BEINE
('Beinstrecker','machine','quads','{}','{leg_extension}','isolation',false,'beginner',3,'12-15',60,NULL),
('Beinbeuger sitzend','machine','hamstrings','{}','{leg_curl}','isolation',false,'beginner',3,'12-15',60,NULL),
('Wadenheben stehend','machine','calves','{}','{standing_calf}','isolation',false,'beginner',4,'12-15',60,NULL),
('Wadenheben sitzend','machine','calves','{}','{seated_calf}','isolation',false,'beginner',4,'12-15',60,NULL),
('Adduktoren Maschine','machine','adductors','{}','{adductor}','isolation',false,'beginner',3,'12-15',60,NULL),
('Abduktoren Maschine','machine','abductors','{glutes}','{abductor}','isolation',false,'beginner',3,'12-15',60,NULL),
('Goblet Squat','dumbbell','quads','{glutes,core}','{dumbbells,kettlebell}','squat',false,'beginner',3,'10-12',90,NULL),
('Sumo Kreuzheben','barbell','glutes','{hamstrings,adductors,back}','{barbell}','hinge',false,'advanced',3,'5-8',180,NULL),
('Beinpresse einbeinig','machine','quads','{glutes}','{leg_press}','squat',true,'intermediate',3,'10 je Seite',90,NULL),
('Step-Ups','dumbbell','quads','{glutes}','{dumbbells,box}','lunge',true,'beginner',3,'10 je Seite',75,NULL),
('Walking Lunges','dumbbell','quads','{glutes,hamstrings}','{dumbbells}','lunge',true,'intermediate',3,'12 je Seite',90,NULL),
('Glute Bridge','bodyweight','glutes','{hamstrings}','{}','hinge',false,'beginner',3,'12-15',60,NULL),
('Single Leg Hip Thrust','bodyweight','glutes','{hamstrings}','{bench}','hinge',true,'intermediate',3,'10 je Seite',75,NULL),
('Nordic Curl','bodyweight','hamstrings','{glutes}','{}','isolation',false,'advanced',3,'6-8',90,NULL),
('Good Mornings','barbell','hamstrings','{glutes,lower_back}','{barbell}','hinge',false,'intermediate',3,'8-10',120,NULL),
-- ARME
('Hammer Curls','dumbbell','biceps','{forearms}','{dumbbells}','isolation',false,'beginner',3,'10-12',60,NULL),
('Konzentrationscurls','dumbbell','biceps','{}','{dumbbells,bench}','isolation',true,'beginner',3,'10-12',60,NULL),
('Langhantelcurls','barbell','biceps','{}','{barbell}','isolation',false,'beginner',3,'8-10',60,NULL),
('SZ-Curls','barbell','biceps','{}','{ez_bar}','isolation',false,'beginner',3,'10-12',60,NULL),
('Preacher Curls','machine','biceps','{}','{preacher_bench}','isolation',false,'beginner',3,'10-12',60,NULL),
('Reverse Curls','barbell','forearms','{biceps}','{ez_bar}','isolation',false,'beginner',3,'10-12',60,NULL),
('Trizeps French Press','dumbbell','triceps','{}','{dumbbells}','isolation',false,'intermediate',3,'8-10',60,NULL),
('Trizeps Kickback','dumbbell','triceps','{}','{dumbbells}','isolation',true,'beginner',3,'10-12',60,NULL),
('Overhead Trizeps Kabel','cable','triceps','{}','{cable,rope}','isolation',false,'beginner',3,'10-12',60,NULL),
('Skull Crusher','barbell','triceps','{}','{ez_bar,bench}','isolation',false,'intermediate',3,'8-10',75,NULL),
('Diamond Push-Ups','bodyweight','triceps','{chest}','{}','push_h',false,'intermediate',3,'8-12',60,NULL),
('Handgelenks-Curls','dumbbell','forearms','{}','{dumbbells}','isolation',false,'beginner',3,'12-15',45,NULL),
-- BAUCH
('Crunches','bodyweight','core','{}','{}','core',false,'beginner',3,'15-20',45,NULL),
('Reverse Crunches','bodyweight','core','{}','{}','core',false,'beginner',3,'12-15',45,NULL),
('Russian Twist','bodyweight','obliques','{core}','{}','core',false,'beginner',3,'20 gesamt',45,NULL),
('Bicycle Crunches','bodyweight','core','{obliques}','{}','core',false,'beginner',3,'20 gesamt',45,NULL),
('Mountain Climbers','bodyweight','core','{shoulders}','{}','core',false,'beginner',3,'30s',45,NULL),
('Side Plank','bodyweight','obliques','{core}','{}','core',true,'beginner',3,'30s je Seite',45,NULL),
('Toes to Bar','bodyweight','core','{}','{pull_up_bar}','core',false,'advanced',3,'6-10',60,NULL),
('Cable Crunch','cable','core','{}','{cable,rope}','core',false,'intermediate',3,'12-15',60,NULL),
('Bauchmaschine','machine','core','{}','{ab_machine}','core',false,'beginner',3,'12-15',60,NULL),
('Hollow Body Hold','bodyweight','core','{}','{}','core',false,'intermediate',3,'30s',60,NULL),
-- CARDIO
('Crosstrainer','cardio','cardio','{}','{crosstrainer}','cardio',false,'beginner',1,'20 min',0,NULL),
('Stairmaster','cardio','cardio','{glutes}','{stairmaster}','cardio',false,'intermediate',1,'15 min',0,NULL),
('Assault Bike','cardio','cardio','{}','{assault_bike}','cardio',false,'intermediate',1,'10 min',0,NULL),
('Skierg','cardio','cardio','{back}','{skierg}','cardio',false,'intermediate',1,'10 min',0,NULL),
('Seilspringen','cardio','cardio','{calves}','{jump_rope}','cardio',false,'beginner',3,'2 min',60,NULL),
('Burpees','bodyweight','cardio','{core,chest}','{}','cardio',false,'intermediate',3,'10-15',60,NULL),
('HIIT Laufband','cardio','cardio','{}','{treadmill}','cardio',false,'advanced',1,'15 min',0,'10×30s Sprint / 60s Pause.'),
('Zone-2 Cardio (LISS)','cardio','cardio','{}','{treadmill,bike,rower}','cardio',false,'beginner',1,'30-45 min',0,'Puls ca. 60-70% max.'),
-- DEHNUNG / MOBILITÄT
('Katze-Kuh','stretch','back','{core}','{mat}','mobility',false,'beginner',2,'8-10',30,'Wirbelsäulenmobilität.'),
('Kindposition','stretch','back','{lats,hips}','{mat}','mobility',false,'beginner',2,'45s',30,NULL),
('World''s Greatest Stretch','stretch','hips','{back,shoulders}','{mat}','mobility',true,'beginner',2,'6 je Seite',30,NULL),
('Hüftbeuger-Dehnung (Kneeling)','stretch','hips','{quads}','{mat}','mobility',true,'beginner',2,'30s je Seite',30,NULL),
('Taube (Pigeon)','stretch','glutes','{hips}','{mat}','mobility',true,'beginner',2,'45s je Seite',30,NULL),
('Butterfly Stretch','stretch','adductors','{hips}','{mat}','mobility',false,'beginner',2,'45s',30,NULL),
('Vorbeuge sitzend','stretch','hamstrings','{lower_back}','{mat}','mobility',false,'beginner',2,'45s',30,NULL),
('Quad-Stretch stehend','stretch','quads','{}','{}','mobility',true,'beginner',2,'30s je Seite',30,NULL),
('Waden-Dehnung an Wand','stretch','calves','{}','{}','mobility',true,'beginner',2,'30s je Seite',30,NULL),
('Brust-Dehnung Türrahmen','stretch','chest','{front_delts}','{}','mobility',false,'beginner',2,'30s',30,NULL),
('Schulter Cross-Body','stretch','shoulders','{}','{}','mobility',true,'beginner',2,'30s je Seite',30,NULL),
('Trizeps Overhead Stretch','stretch','triceps','{}','{}','mobility',true,'beginner',2,'30s je Seite',30,NULL),
('Nacken Seitneigung','stretch','shoulders','{}','{}','mobility',true,'beginner',2,'20s je Seite',20,NULL),
('90/90 Hip Stretch','stretch','hips','{glutes}','{mat}','mobility',true,'beginner',2,'45s je Seite',30,NULL),
('Cobra Stretch','stretch','core','{back}','{mat}','mobility',false,'beginner',2,'30s',30,NULL),
('Thoracic Foam Roller','stretch','back','{}','{foam_roller}','mobility',false,'beginner',2,'60s',30,NULL),
('Foam Roll Quads','stretch','quads','{}','{foam_roller}','mobility',true,'beginner',2,'60s je Seite',30,NULL),
('Foam Roll ITB','stretch','quads','{}','{foam_roller}','mobility',true,'beginner',2,'60s je Seite',30,NULL),
('Downward Dog','stretch','hamstrings','{calves,shoulders}','{mat}','mobility',false,'beginner',2,'45s',30,NULL)
ON CONFLICT (name) DO NOTHING;
