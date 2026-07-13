-- 1) Berechtigungs-Flag: Kursleiter (Group-Fitness-Trainer) auf dem Profil.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_course_instructor boolean NOT NULL DEFAULT false;

-- 2) Übungsbibliothek
CREATE TABLE IF NOT EXISTS public.course_exercises (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  coaching_cues text,
  muscle_groups text[] NOT NULL DEFAULT '{}',
  equipment text[] NOT NULL DEFAULT '{}',
  difficulty text NOT NULL DEFAULT 'medium',
  media_url text,
  is_favorite boolean NOT NULL DEFAULT false,
  is_public boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.course_exercises TO authenticated;
GRANT ALL ON public.course_exercises TO service_role;
ALTER TABLE public.course_exercises ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ce owner all" ON public.course_exercises
  FOR ALL TO authenticated
  USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
CREATE POLICY "ce read public" ON public.course_exercises
  FOR SELECT TO authenticated
  USING (is_public = true);

-- 3) Kursvorlagen (JSON-Struktur mit Blöcken/Timern)
CREATE TABLE IF NOT EXISTS public.course_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  duration_minutes integer,
  target_group text,
  equipment text[] NOT NULL DEFAULT '{}',
  blocks jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_favorite boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.course_templates TO authenticated;
GRANT ALL ON public.course_templates TO service_role;
ALTER TABLE public.course_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ct owner all" ON public.course_templates
  FOR ALL TO authenticated
  USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

-- 4) Musik-Links (Spotify / Apple Music / YouTube)
CREATE TABLE IF NOT EXISTS public.course_music_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  url text NOT NULL,
  provider text NOT NULL DEFAULT 'other',
  bpm integer,
  tags text[] NOT NULL DEFAULT '{}',
  is_favorite boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.course_music_links TO authenticated;
GRANT ALL ON public.course_music_links TO service_role;
ALTER TABLE public.course_music_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cml owner all" ON public.course_music_links
  FOR ALL TO authenticated
  USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

-- 5) Teilnehmer (persistente Roster-Einträge)
CREATE TABLE IF NOT EXISTS public.course_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.course_participants TO authenticated;
GRANT ALL ON public.course_participants TO service_role;
ALTER TABLE public.course_participants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cp owner all" ON public.course_participants
  FOR ALL TO authenticated
  USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

-- 6) Anwesenheitsprotokoll pro Session/Tag
CREATE TABLE IF NOT EXISTS public.course_attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  participant_id uuid NOT NULL REFERENCES public.course_participants(id) ON DELETE CASCADE,
  session_date date NOT NULL DEFAULT current_date,
  present boolean NOT NULL DEFAULT true,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_id, participant_id, session_date)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.course_attendance TO authenticated;
GRANT ALL ON public.course_attendance TO service_role;
ALTER TABLE public.course_attendance ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cat owner all" ON public.course_attendance
  FOR ALL TO authenticated
  USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

-- updated_at Trigger
CREATE OR REPLACE FUNCTION public.tg_touch_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS trg_ce_touch ON public.course_exercises;
CREATE TRIGGER trg_ce_touch BEFORE UPDATE ON public.course_exercises
  FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();
DROP TRIGGER IF EXISTS trg_ct_touch ON public.course_templates;
CREATE TRIGGER trg_ct_touch BEFORE UPDATE ON public.course_templates
  FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();
DROP TRIGGER IF EXISTS trg_cml_touch ON public.course_music_links;
CREATE TRIGGER trg_cml_touch BEFORE UPDATE ON public.course_music_links
  FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();
DROP TRIGGER IF EXISTS trg_cp_touch ON public.course_participants;
CREATE TRIGGER trg_cp_touch BEFORE UPDATE ON public.course_participants
  FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();