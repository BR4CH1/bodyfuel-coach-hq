
-- Roles
CREATE TYPE public.app_role AS ENUM ('coach', 'client');

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  demo_client_key TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  UNIQUE(user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

-- Profile policies
CREATE POLICY "own profile read" ON public.profiles FOR SELECT TO authenticated
  USING (auth.uid() = id OR public.has_role(auth.uid(), 'coach'));
CREATE POLICY "own profile update" ON public.profiles FOR UPDATE TO authenticated
  USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "own profile insert" ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = id);

-- Roles policies
CREATE POLICY "read own roles" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'coach'));

-- Auto-create profile + role on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  chosen_role public.app_role;
  chosen_key TEXT;
BEGIN
  chosen_role := COALESCE((NEW.raw_user_meta_data->>'role')::public.app_role, 'client');
  chosen_key := NEW.raw_user_meta_data->>'demo_client_key';

  INSERT INTO public.profiles (id, display_name, demo_client_key)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)),
    chosen_key
  );

  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, chosen_role);

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Updated-at trigger helper
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Nutrition plans
CREATE TABLE public.nutrition_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  uploaded_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX nutrition_plans_client_idx ON public.nutrition_plans(client_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.nutrition_plans TO authenticated;
GRANT ALL ON public.nutrition_plans TO service_role;
ALTER TABLE public.nutrition_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "clients read own plans" ON public.nutrition_plans FOR SELECT TO authenticated
  USING (client_id = auth.uid() OR public.has_role(auth.uid(), 'coach'));
CREATE POLICY "coach inserts plans" ON public.nutrition_plans FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'coach'));
CREATE POLICY "coach updates plans" ON public.nutrition_plans FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'coach')) WITH CHECK (public.has_role(auth.uid(), 'coach'));
CREATE POLICY "coach deletes plans" ON public.nutrition_plans FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'coach'));

-- Storage policies (bucket created via tool)
CREATE POLICY "plan files: clients read own" ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'nutrition-plans'
    AND (
      public.has_role(auth.uid(), 'coach')
      OR (storage.foldername(name))[1] = auth.uid()::text
    )
  );
CREATE POLICY "plan files: coach uploads" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'nutrition-plans' AND public.has_role(auth.uid(), 'coach'));
CREATE POLICY "plan files: coach deletes" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'nutrition-plans' AND public.has_role(auth.uid(), 'coach'));
