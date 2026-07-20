
-- 1. Coach Exercise Library
CREATE TABLE IF NOT EXISTS public.coach_exercise_library (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  category text NOT NULL CHECK (category IN ('barbell','dumbbell','machine','cable','bodyweight','core','cardio')),
  primary_muscle text NOT NULL,
  secondary_muscles text[] NOT NULL DEFAULT '{}',
  equipment text[] NOT NULL DEFAULT '{}',
  movement_pattern text NOT NULL CHECK (movement_pattern IN ('squat','hinge','lunge','push_h','push_v','pull_h','pull_v','carry','core','cardio','isolation')),
  is_unilateral boolean NOT NULL DEFAULT false,
  difficulty text NOT NULL DEFAULT 'intermediate' CHECK (difficulty IN ('beginner','intermediate','advanced')),
  default_sets smallint NOT NULL DEFAULT 3,
  default_reps text NOT NULL DEFAULT '8',
  default_rest_seconds smallint NOT NULL DEFAULT 90,
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.coach_exercise_library TO authenticated;
GRANT ALL ON public.coach_exercise_library TO service_role;

ALTER TABLE public.coach_exercise_library ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cel_read_authenticated"
ON public.coach_exercise_library
FOR SELECT TO authenticated
USING (true);

CREATE POLICY "cel_write_coach"
ON public.coach_exercise_library
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'coach'))
WITH CHECK (public.has_role(auth.uid(), 'coach'));

CREATE TRIGGER trg_cel_updated_at
BEFORE UPDATE ON public.coach_exercise_library
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_cel_active ON public.coach_exercise_library(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_cel_pattern ON public.coach_exercise_library(movement_pattern);

-- 2. Erweiterungen training_exercises
ALTER TABLE public.training_exercises
  ADD COLUMN IF NOT EXISTS library_exercise_id uuid REFERENCES public.coach_exercise_library(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS target_rir smallint,
  ADD COLUMN IF NOT EXISTS is_locked boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS linked_partner_group text,
  ADD COLUMN IF NOT EXISTS partner_exercise_id uuid;

-- 3. Erweiterung training_days
ALTER TABLE public.training_days
  ADD COLUMN IF NOT EXISTS day_date date;

-- 4. Seed
INSERT INTO public.coach_exercise_library (name, category, primary_muscle, secondary_muscles, equipment, movement_pattern, is_unilateral, difficulty, default_sets, default_reps, default_rest_seconds, notes) VALUES
-- Squat / Legs
('Kniebeuge (Langhantel)','barbell','quads','{glutes,core,hamstrings}','{barbell,rack}','squat',false,'intermediate',4,'6-8',150,'Fersen bodenkontakt, Knie in Zehenrichtung.'),
('Frontkniebeuge','barbell','quads','{core,glutes}','{barbell,rack}','squat',false,'advanced',3,'6-8',150,'Oberkörper aufrecht.'),
('Beinpresse','machine','quads','{glutes,hamstrings}','{leg_press}','squat',false,'beginner',4,'8-12',120,'Rücken flach anliegen lassen.'),
('Hackenschmidt','machine','quads','{glutes}','{hack_squat}','squat',false,'intermediate',3,'8-10',120,NULL),
('Ausfallschritte','dumbbell','quads','{glutes,hamstrings}','{dumbbells}','lunge',true,'intermediate',3,'10 je Seite',90,NULL),
('Bulgarian Split Squat','dumbbell','quads','{glutes}','{dumbbells,bench}','lunge',true,'advanced',3,'8 je Seite',90,NULL),
-- Hinge
('Kreuzheben (Langhantel)','barbell','hamstrings','{glutes,back,core}','{barbell}','hinge',false,'advanced',3,'5',180,'Neutraler Rücken.'),
('Rumänisches Kreuzheben','barbell','hamstrings','{glutes,back}','{barbell}','hinge',false,'intermediate',4,'8-10',120,'Hüftscharnier, leichte Kniebeuge.'),
('Hip Thrust','barbell','glutes','{hamstrings}','{barbell,bench}','hinge',false,'intermediate',4,'8-12',120,NULL),
('Beinbeuger liegend','machine','hamstrings','{}','{leg_curl}','isolation',false,'beginner',3,'10-12',90,NULL),
-- Push horizontal
('Bankdrücken (Langhantel)','barbell','chest','{triceps,front_delts}','{barbell,bench}','push_h',false,'intermediate',4,'6-8',150,NULL),
('Bankdrücken Kurzhantel','dumbbell','chest','{triceps,front_delts}','{dumbbells,bench}','push_h',false,'intermediate',3,'8-10',120,NULL),
('Brustpresse Maschine','machine','chest','{triceps,front_delts}','{chest_press}','push_h',false,'beginner',4,'8-10',90,NULL),
('Schrägbankdrücken','barbell','upper_chest','{triceps,front_delts}','{barbell,incline_bench}','push_h',false,'intermediate',3,'8-10',120,NULL),
('Liegestütze','bodyweight','chest','{triceps,core}','{}','push_h',false,'beginner',3,'10-15',60,NULL),
('Butterfly / Pec Deck','machine','chest','{}','{pec_deck}','isolation',false,'beginner',3,'10-12',60,NULL),
-- Push vertical
('Schulterdrücken (Kurzhantel)','dumbbell','shoulders','{triceps,upper_chest}','{dumbbells}','push_v',false,'intermediate',4,'8-10',120,NULL),
('Schulterpresse Maschine','machine','shoulders','{triceps}','{shoulder_press}','push_v',false,'beginner',3,'8-10',90,NULL),
('Military Press','barbell','shoulders','{triceps,core}','{barbell}','push_v',false,'advanced',3,'5-8',150,NULL),
('Seitheben','dumbbell','side_delts','{}','{dumbbells}','isolation',false,'beginner',3,'12-15',60,NULL),
-- Pull horizontal
('Rudern vorgebeugt','barbell','back','{biceps,rear_delts}','{barbell}','pull_h',false,'intermediate',4,'8',120,'Neutraler Rücken.'),
('Kabelrudern sitzend','cable','back','{biceps}','{cable}','pull_h',false,'beginner',4,'10',90,NULL),
('T-Bar Row','machine','back','{biceps}','{t_bar}','pull_h',false,'intermediate',3,'8-10',120,NULL),
('Kurzhantelrudern','dumbbell','back','{biceps}','{dumbbells,bench}','pull_h',true,'intermediate',3,'10 je Seite',90,NULL),
-- Pull vertical
('Klimmzug','bodyweight','back','{biceps}','{pull_up_bar}','pull_v',false,'advanced',4,'AMRAP',120,NULL),
('Latzug breit','cable','back','{biceps}','{lat_pulldown}','pull_v',false,'beginner',4,'10',90,NULL),
('Latzug eng','cable','back','{biceps}','{lat_pulldown}','pull_v',false,'beginner',3,'10',90,NULL),
-- Arms (isolation)
('Bizeps Curls Kurzhantel','dumbbell','biceps','{}','{dumbbells}','isolation',false,'beginner',3,'10-12',60,NULL),
('Bizeps Curls Kabel','cable','biceps','{}','{cable}','isolation',false,'beginner',3,'10-12',60,NULL),
('Trizeps Pushdown','cable','triceps','{}','{cable}','isolation',false,'beginner',3,'10-12',60,NULL),
('Dips','bodyweight','triceps','{chest,front_delts}','{dip_bar}','push_v',false,'intermediate',3,'8-12',90,NULL),
-- Core
('Plank','bodyweight','core','{}','{}','core',false,'beginner',3,'45s',60,NULL),
('Hanging Leg Raise','bodyweight','core','{}','{pull_up_bar}','core',false,'intermediate',3,'10-15',60,NULL),
('Dead Bug','bodyweight','core','{}','{}','core',false,'beginner',3,'10 je Seite',45,NULL),
('Ab Wheel Rollout','bodyweight','core','{}','{ab_wheel}','core',false,'advanced',3,'8-12',60,NULL),
('Cable Wood Chop','cable','core','{obliques}','{cable}','core',true,'intermediate',3,'10 je Seite',60,NULL),
-- Carry
('Farmers Walk','dumbbell','core','{traps,forearms}','{dumbbells}','carry',false,'intermediate',3,'30m',90,NULL),
-- Cardio
('Rudergerät','cardio','cardio','{}','{rower}','cardio',false,'beginner',1,'15 min',0,NULL),
('Laufband Intervalle','cardio','cardio','{}','{treadmill}','cardio',false,'intermediate',1,'20 min',0,'6x1 min schnell / 1 min langsam.'),
('Fahrrad Ergometer','cardio','cardio','{}','{bike}','cardio',false,'beginner',1,'20 min',0,NULL)
ON CONFLICT DO NOTHING;
