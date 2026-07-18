
-- Fuely AI: chat history + long-term memories per user
CREATE TABLE public.fuely_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user','assistant','system')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX fuely_messages_user_created_idx ON public.fuely_messages(user_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fuely_messages TO authenticated;
GRANT ALL ON public.fuely_messages TO service_role;
ALTER TABLE public.fuely_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own fuely messages" ON public.fuely_messages
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.fuely_memories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  category TEXT NOT NULL DEFAULT 'general',
  content TEXT NOT NULL,
  importance INT NOT NULL DEFAULT 3 CHECK (importance BETWEEN 1 AND 5),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX fuely_memories_user_idx ON public.fuely_memories(user_id, importance DESC, updated_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fuely_memories TO authenticated;
GRANT ALL ON public.fuely_memories TO service_role;
ALTER TABLE public.fuely_memories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own fuely memories" ON public.fuely_memories
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.fuely_memories_touch() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql SET search_path = public;
CREATE TRIGGER fuely_memories_updated BEFORE UPDATE ON public.fuely_memories
  FOR EACH ROW EXECUTE FUNCTION public.fuely_memories_touch();
