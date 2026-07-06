
-- Performance Engine V1 (generic, multi-sport)

CREATE TABLE public.performance_frameworks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  sport text NOT NULL,
  version integer NOT NULL DEFAULT 1,
  description text,
  status text NOT NULL DEFAULT 'draft',
  is_template boolean NOT NULL DEFAULT false,
  parent_framework_id uuid REFERENCES public.performance_frameworks(id) ON DELETE SET NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.performance_frameworks TO authenticated;
GRANT ALL ON public.performance_frameworks TO service_role;
ALTER TABLE public.performance_frameworks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "perf_frameworks read" ON public.performance_frameworks FOR SELECT TO authenticated
USING (
  is_template = true
  OR public.has_role(auth.uid(), 'coach'::public.app_role)
  OR (organization_id IS NOT NULL AND (public.is_org_member(auth.uid(), organization_id) OR public.is_org_staff(auth.uid(), organization_id, NULL)))
);
CREATE POLICY "perf_frameworks write" ON public.performance_frameworks FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'coach'::public.app_role) OR (organization_id IS NOT NULL AND public.is_org_admin(auth.uid(), organization_id)))
WITH CHECK (public.has_role(auth.uid(), 'coach'::public.app_role) OR (organization_id IS NOT NULL AND public.is_org_admin(auth.uid(), organization_id)));

CREATE TABLE public.performance_domains (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  framework_id uuid NOT NULL REFERENCES public.performance_frameworks(id) ON DELETE CASCADE,
  key text NOT NULL,
  name text NOT NULL,
  description text,
  order_index integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (framework_id, key)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.performance_domains TO authenticated;
GRANT ALL ON public.performance_domains TO service_role;
ALTER TABLE public.performance_domains ENABLE ROW LEVEL SECURITY;
CREATE POLICY "perf_domains read" ON public.performance_domains FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.performance_frameworks f WHERE f.id = framework_id AND (f.is_template OR public.has_role(auth.uid(),'coach'::public.app_role) OR (f.organization_id IS NOT NULL AND (public.is_org_member(auth.uid(), f.organization_id) OR public.is_org_staff(auth.uid(), f.organization_id, NULL))))));
CREATE POLICY "perf_domains write" ON public.performance_domains FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.performance_frameworks f WHERE f.id = framework_id AND (public.has_role(auth.uid(),'coach'::public.app_role) OR (f.organization_id IS NOT NULL AND public.is_org_admin(auth.uid(), f.organization_id)))))
WITH CHECK (EXISTS (SELECT 1 FROM public.performance_frameworks f WHERE f.id = framework_id AND (public.has_role(auth.uid(),'coach'::public.app_role) OR (f.organization_id IS NOT NULL AND public.is_org_admin(auth.uid(), f.organization_id)))));

CREATE TABLE public.performance_test_batteries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  framework_id uuid NOT NULL REFERENCES public.performance_frameworks(id) ON DELETE CASCADE,
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  version integer NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'draft',
  recommended_retest_days integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.performance_test_batteries TO authenticated;
GRANT ALL ON public.performance_test_batteries TO service_role;
ALTER TABLE public.performance_test_batteries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "perf_batteries read" ON public.performance_test_batteries FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.performance_frameworks f WHERE f.id = framework_id AND (f.is_template OR public.has_role(auth.uid(),'coach'::public.app_role) OR (f.organization_id IS NOT NULL AND (public.is_org_member(auth.uid(), f.organization_id) OR public.is_org_staff(auth.uid(), f.organization_id, NULL))))));
CREATE POLICY "perf_batteries write" ON public.performance_test_batteries FOR ALL TO authenticated
USING (public.has_role(auth.uid(),'coach'::public.app_role) OR (organization_id IS NOT NULL AND public.is_org_admin(auth.uid(), organization_id)))
WITH CHECK (public.has_role(auth.uid(),'coach'::public.app_role) OR (organization_id IS NOT NULL AND public.is_org_admin(auth.uid(), organization_id)));

CREATE TABLE public.performance_test_definitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  battery_id uuid NOT NULL REFERENCES public.performance_test_batteries(id) ON DELETE CASCADE,
  domain_id uuid REFERENCES public.performance_domains(id) ON DELETE SET NULL,
  key text NOT NULL,
  name text NOT NULL,
  description text,
  protocol jsonb NOT NULL DEFAULT '{}'::jsonb,
  unit text NOT NULL,
  value_type text NOT NULL,
  direction text NOT NULL DEFAULT 'higher_is_better',
  decimal_places integer NOT NULL DEFAULT 2,
  order_index integer NOT NULL DEFAULT 0,
  required boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true,
  result_selection text NOT NULL DEFAULT 'best',
  recommended_retest_days integer,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (battery_id, key)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.performance_test_definitions TO authenticated;
GRANT ALL ON public.performance_test_definitions TO service_role;
ALTER TABLE public.performance_test_definitions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "perf_testdefs read" ON public.performance_test_definitions FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.performance_test_batteries b JOIN public.performance_frameworks f ON f.id=b.framework_id WHERE b.id=battery_id AND (f.is_template OR public.has_role(auth.uid(),'coach'::public.app_role) OR (f.organization_id IS NOT NULL AND (public.is_org_member(auth.uid(), f.organization_id) OR public.is_org_staff(auth.uid(), f.organization_id, NULL))))));
CREATE POLICY "perf_testdefs write" ON public.performance_test_definitions FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.performance_test_batteries b JOIN public.performance_frameworks f ON f.id=b.framework_id WHERE b.id=battery_id AND (public.has_role(auth.uid(),'coach'::public.app_role) OR (f.organization_id IS NOT NULL AND public.is_org_admin(auth.uid(), f.organization_id)))))
WITH CHECK (EXISTS (SELECT 1 FROM public.performance_test_batteries b JOIN public.performance_frameworks f ON f.id=b.framework_id WHERE b.id=battery_id AND (public.has_role(auth.uid(),'coach'::public.app_role) OR (f.organization_id IS NOT NULL AND public.is_org_admin(auth.uid(), f.organization_id)))));

CREATE TABLE public.performance_metric_definitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  framework_id uuid NOT NULL REFERENCES public.performance_frameworks(id) ON DELETE CASCADE,
  domain_id uuid REFERENCES public.performance_domains(id) ON DELETE SET NULL,
  key text NOT NULL,
  name text NOT NULL,
  unit text,
  metric_type text NOT NULL DEFAULT 'raw_test',
  calculation_type text NOT NULL DEFAULT 'direct',
  direction text NOT NULL DEFAULT 'higher_is_better',
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  active boolean NOT NULL DEFAULT true,
  order_index integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (framework_id, key)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.performance_metric_definitions TO authenticated;
GRANT ALL ON public.performance_metric_definitions TO service_role;
ALTER TABLE public.performance_metric_definitions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "perf_metrics read" ON public.performance_metric_definitions FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.performance_frameworks f WHERE f.id = framework_id AND (f.is_template OR public.has_role(auth.uid(),'coach'::public.app_role) OR (f.organization_id IS NOT NULL AND (public.is_org_member(auth.uid(), f.organization_id) OR public.is_org_staff(auth.uid(), f.organization_id, NULL))))));
CREATE POLICY "perf_metrics write" ON public.performance_metric_definitions FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.performance_frameworks f WHERE f.id = framework_id AND (public.has_role(auth.uid(),'coach'::public.app_role) OR (f.organization_id IS NOT NULL AND public.is_org_admin(auth.uid(), f.organization_id)))))
WITH CHECK (EXISTS (SELECT 1 FROM public.performance_frameworks f WHERE f.id = framework_id AND (public.has_role(auth.uid(),'coach'::public.app_role) OR (f.organization_id IS NOT NULL AND public.is_org_admin(auth.uid(), f.organization_id)))));

CREATE TABLE public.performance_domain_metric_weights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  framework_id uuid NOT NULL REFERENCES public.performance_frameworks(id) ON DELETE CASCADE,
  domain_id uuid NOT NULL REFERENCES public.performance_domains(id) ON DELETE CASCADE,
  metric_definition_id uuid NOT NULL REFERENCES public.performance_metric_definitions(id) ON DELETE CASCADE,
  weight numeric NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (framework_id, domain_id, metric_definition_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.performance_domain_metric_weights TO authenticated;
GRANT ALL ON public.performance_domain_metric_weights TO service_role;
ALTER TABLE public.performance_domain_metric_weights ENABLE ROW LEVEL SECURITY;
CREATE POLICY "perf_dmw read" ON public.performance_domain_metric_weights FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.performance_frameworks f WHERE f.id = framework_id AND (f.is_template OR public.has_role(auth.uid(),'coach'::public.app_role) OR (f.organization_id IS NOT NULL AND (public.is_org_member(auth.uid(), f.organization_id) OR public.is_org_staff(auth.uid(), f.organization_id, NULL))))));
CREATE POLICY "perf_dmw write" ON public.performance_domain_metric_weights FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.performance_frameworks f WHERE f.id = framework_id AND (public.has_role(auth.uid(),'coach'::public.app_role) OR (f.organization_id IS NOT NULL AND public.is_org_admin(auth.uid(), f.organization_id)))))
WITH CHECK (EXISTS (SELECT 1 FROM public.performance_frameworks f WHERE f.id = framework_id AND (public.has_role(auth.uid(),'coach'::public.app_role) OR (f.organization_id IS NOT NULL AND public.is_org_admin(auth.uid(), f.organization_id)))));

CREATE TABLE public.performance_position_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  framework_id uuid NOT NULL REFERENCES public.performance_frameworks(id) ON DELETE CASCADE,
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  sport text NOT NULL,
  position_key text NOT NULL,
  position_name text NOT NULL,
  position_group text,
  age_group text,
  version integer NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'draft',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.performance_position_profiles TO authenticated;
GRANT ALL ON public.performance_position_profiles TO service_role;
ALTER TABLE public.performance_position_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "perf_posprof read" ON public.performance_position_profiles FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.performance_frameworks f WHERE f.id = framework_id AND (f.is_template OR public.has_role(auth.uid(),'coach'::public.app_role) OR (f.organization_id IS NOT NULL AND (public.is_org_member(auth.uid(), f.organization_id) OR public.is_org_staff(auth.uid(), f.organization_id, NULL))))));
CREATE POLICY "perf_posprof write" ON public.performance_position_profiles FOR ALL TO authenticated
USING (public.has_role(auth.uid(),'coach'::public.app_role) OR (organization_id IS NOT NULL AND public.is_org_admin(auth.uid(), organization_id)))
WITH CHECK (public.has_role(auth.uid(),'coach'::public.app_role) OR (organization_id IS NOT NULL AND public.is_org_admin(auth.uid(), organization_id)));

CREATE TABLE public.performance_position_domain_weights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  position_profile_id uuid NOT NULL REFERENCES public.performance_position_profiles(id) ON DELETE CASCADE,
  domain_id uuid NOT NULL REFERENCES public.performance_domains(id) ON DELETE CASCADE,
  weight numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (position_profile_id, domain_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.performance_position_domain_weights TO authenticated;
GRANT ALL ON public.performance_position_domain_weights TO service_role;
ALTER TABLE public.performance_position_domain_weights ENABLE ROW LEVEL SECURITY;
CREATE POLICY "perf_pdw read" ON public.performance_position_domain_weights FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.performance_position_profiles p JOIN public.performance_frameworks f ON f.id=p.framework_id WHERE p.id=position_profile_id AND (f.is_template OR public.has_role(auth.uid(),'coach'::public.app_role) OR (f.organization_id IS NOT NULL AND (public.is_org_member(auth.uid(), f.organization_id) OR public.is_org_staff(auth.uid(), f.organization_id, NULL))))));
CREATE POLICY "perf_pdw write" ON public.performance_position_domain_weights FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.performance_position_profiles p WHERE p.id=position_profile_id AND (public.has_role(auth.uid(),'coach'::public.app_role) OR (p.organization_id IS NOT NULL AND public.is_org_admin(auth.uid(), p.organization_id)))))
WITH CHECK (EXISTS (SELECT 1 FROM public.performance_position_profiles p WHERE p.id=position_profile_id AND (public.has_role(auth.uid(),'coach'::public.app_role) OR (p.organization_id IS NOT NULL AND public.is_org_admin(auth.uid(), p.organization_id)))));

CREATE TABLE public.performance_benchmark_models (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  framework_id uuid NOT NULL REFERENCES public.performance_frameworks(id) ON DELETE CASCADE,
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  benchmark_type text NOT NULL,
  version integer NOT NULL DEFAULT 1,
  minimum_sample_size integer NOT NULL DEFAULT 8,
  status text NOT NULL DEFAULT 'draft',
  source_reference text,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.performance_benchmark_models TO authenticated;
GRANT ALL ON public.performance_benchmark_models TO service_role;
ALTER TABLE public.performance_benchmark_models ENABLE ROW LEVEL SECURITY;
CREATE POLICY "perf_bench read" ON public.performance_benchmark_models FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.performance_frameworks f WHERE f.id = framework_id AND (f.is_template OR public.has_role(auth.uid(),'coach'::public.app_role) OR (f.organization_id IS NOT NULL AND (public.is_org_member(auth.uid(), f.organization_id) OR public.is_org_staff(auth.uid(), f.organization_id, NULL))))));
CREATE POLICY "perf_bench write" ON public.performance_benchmark_models FOR ALL TO authenticated
USING (public.has_role(auth.uid(),'coach'::public.app_role) OR (organization_id IS NOT NULL AND public.is_org_admin(auth.uid(), organization_id)))
WITH CHECK (public.has_role(auth.uid(),'coach'::public.app_role) OR (organization_id IS NOT NULL AND public.is_org_admin(auth.uid(), organization_id)));

CREATE TABLE public.performance_test_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  team_id uuid REFERENCES public.organization_teams(id) ON DELETE SET NULL,
  battery_id uuid NOT NULL REFERENCES public.performance_test_batteries(id) ON DELETE RESTRICT,
  name text NOT NULL,
  test_date date NOT NULL,
  status text NOT NULL DEFAULT 'planned',
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.performance_test_sessions TO authenticated;
GRANT ALL ON public.performance_test_sessions TO service_role;
ALTER TABLE public.performance_test_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "perf_sessions write" ON public.performance_test_sessions FOR ALL TO authenticated
USING (public.has_role(auth.uid(),'coach'::public.app_role) OR public.is_org_admin(auth.uid(), organization_id) OR public.is_org_staff(auth.uid(), organization_id, 'manage_performance'))
WITH CHECK (public.has_role(auth.uid(),'coach'::public.app_role) OR public.is_org_admin(auth.uid(), organization_id) OR public.is_org_staff(auth.uid(), organization_id, 'manage_performance'));

CREATE TABLE public.performance_test_session_athletes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.performance_test_sessions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (session_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.performance_test_session_athletes TO authenticated;
GRANT ALL ON public.performance_test_session_athletes TO service_role;
ALTER TABLE public.performance_test_session_athletes ENABLE ROW LEVEL SECURITY;

-- Now that both tables exist, the sessions SELECT policy can reference session_athletes.
CREATE POLICY "perf_sessions read" ON public.performance_test_sessions FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(),'coach'::public.app_role)
  OR public.is_org_staff(auth.uid(), organization_id, 'view_performance')
  OR public.is_org_staff(auth.uid(), organization_id, 'manage_performance')
  OR EXISTS (SELECT 1 FROM public.performance_test_session_athletes a WHERE a.session_id = performance_test_sessions.id AND a.user_id = auth.uid())
);

CREATE POLICY "perf_sa read" ON public.performance_test_session_athletes FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  OR EXISTS (SELECT 1 FROM public.performance_test_sessions s WHERE s.id = session_id AND (public.has_role(auth.uid(),'coach'::public.app_role) OR public.is_org_staff(auth.uid(), s.organization_id, 'view_performance') OR public.is_org_staff(auth.uid(), s.organization_id, 'manage_performance')))
);
CREATE POLICY "perf_sa write" ON public.performance_test_session_athletes FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.performance_test_sessions s WHERE s.id = session_id AND (public.has_role(auth.uid(),'coach'::public.app_role) OR public.is_org_admin(auth.uid(), s.organization_id) OR public.is_org_staff(auth.uid(), s.organization_id, 'manage_performance'))))
WITH CHECK (EXISTS (SELECT 1 FROM public.performance_test_sessions s WHERE s.id = session_id AND (public.has_role(auth.uid(),'coach'::public.app_role) OR public.is_org_admin(auth.uid(), s.organization_id) OR public.is_org_staff(auth.uid(), s.organization_id, 'manage_performance'))));

CREATE TABLE public.performance_test_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  session_id uuid NOT NULL REFERENCES public.performance_test_sessions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  test_definition_id uuid NOT NULL REFERENCES public.performance_test_definitions(id) ON DELETE RESTRICT,
  attempt_number integer NOT NULL DEFAULT 1,
  raw_value numeric NOT NULL,
  unit_snapshot text NOT NULL,
  valid boolean NOT NULL DEFAULT true,
  invalid_reason text,
  entered_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  measured_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.performance_test_attempts TO authenticated;
GRANT ALL ON public.performance_test_attempts TO service_role;
ALTER TABLE public.performance_test_attempts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "perf_attempts read" ON public.performance_test_attempts FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.has_role(auth.uid(),'coach'::public.app_role) OR public.is_org_staff(auth.uid(), organization_id, 'view_performance') OR public.is_org_staff(auth.uid(), organization_id, 'manage_performance'));
CREATE POLICY "perf_attempts write" ON public.performance_test_attempts FOR ALL TO authenticated
USING (public.has_role(auth.uid(),'coach'::public.app_role) OR public.is_org_admin(auth.uid(), organization_id) OR public.is_org_staff(auth.uid(), organization_id, 'manage_performance'))
WITH CHECK (public.has_role(auth.uid(),'coach'::public.app_role) OR public.is_org_admin(auth.uid(), organization_id) OR public.is_org_staff(auth.uid(), organization_id, 'manage_performance'));
CREATE INDEX perf_attempts_lookup ON public.performance_test_attempts (session_id, user_id, test_definition_id, valid);

CREATE TABLE public.performance_session_context_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.performance_test_sessions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  context_key text NOT NULL,
  numeric_value numeric,
  text_value text,
  unit text,
  source text,
  captured_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (session_id, user_id, context_key)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.performance_session_context_snapshots TO authenticated;
GRANT ALL ON public.performance_session_context_snapshots TO service_role;
ALTER TABLE public.performance_session_context_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "perf_ctx read" ON public.performance_session_context_snapshots FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.has_role(auth.uid(),'coach'::public.app_role) OR public.is_org_staff(auth.uid(), organization_id, 'view_performance') OR public.is_org_staff(auth.uid(), organization_id, 'manage_performance'));
CREATE POLICY "perf_ctx write" ON public.performance_session_context_snapshots FOR ALL TO authenticated
USING (public.has_role(auth.uid(),'coach'::public.app_role) OR public.is_org_admin(auth.uid(), organization_id) OR public.is_org_staff(auth.uid(), organization_id, 'manage_performance'))
WITH CHECK (public.has_role(auth.uid(),'coach'::public.app_role) OR public.is_org_admin(auth.uid(), organization_id) OR public.is_org_staff(auth.uid(), organization_id, 'manage_performance'));

CREATE TABLE public.performance_athlete_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  framework_id uuid NOT NULL REFERENCES public.performance_frameworks(id) ON DELETE CASCADE,
  framework_version integer NOT NULL,
  position_profile_id uuid REFERENCES public.performance_position_profiles(id) ON DELETE SET NULL,
  benchmark_model_id uuid REFERENCES public.performance_benchmark_models(id) ON DELETE SET NULL,
  overall_score numeric,
  confidence text,
  data_coverage numeric,
  calculation_version integer NOT NULL DEFAULT 1,
  missing_metrics jsonb NOT NULL DEFAULT '[]'::jsonb,
  calculated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, user_id, framework_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.performance_athlete_profiles TO authenticated;
GRANT ALL ON public.performance_athlete_profiles TO service_role;
ALTER TABLE public.performance_athlete_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "perf_profiles read" ON public.performance_athlete_profiles FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.has_role(auth.uid(),'coach'::public.app_role) OR public.is_org_staff(auth.uid(), organization_id, 'view_performance') OR public.is_org_staff(auth.uid(), organization_id, 'manage_performance'));
CREATE POLICY "perf_profiles write" ON public.performance_athlete_profiles FOR ALL TO authenticated
USING (public.has_role(auth.uid(),'coach'::public.app_role) OR public.is_org_admin(auth.uid(), organization_id) OR public.is_org_staff(auth.uid(), organization_id, 'manage_performance'))
WITH CHECK (public.has_role(auth.uid(),'coach'::public.app_role) OR public.is_org_admin(auth.uid(), organization_id) OR public.is_org_staff(auth.uid(), organization_id, 'manage_performance'));

CREATE TABLE public.performance_athlete_metric_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.performance_athlete_profiles(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  metric_definition_id uuid NOT NULL REFERENCES public.performance_metric_definitions(id) ON DELETE CASCADE,
  selected_value numeric,
  unit text,
  score numeric,
  benchmark_model_id uuid REFERENCES public.performance_benchmark_models(id) ON DELETE SET NULL,
  benchmark_version integer,
  comparison_group jsonb NOT NULL DEFAULT '{}'::jsonb,
  sample_size integer,
  calculated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (profile_id, metric_definition_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.performance_athlete_metric_scores TO authenticated;
GRANT ALL ON public.performance_athlete_metric_scores TO service_role;
ALTER TABLE public.performance_athlete_metric_scores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "perf_ms read" ON public.performance_athlete_metric_scores FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.has_role(auth.uid(),'coach'::public.app_role) OR public.is_org_staff(auth.uid(), organization_id, 'view_performance') OR public.is_org_staff(auth.uid(), organization_id, 'manage_performance'));
CREATE POLICY "perf_ms write" ON public.performance_athlete_metric_scores FOR ALL TO authenticated
USING (public.has_role(auth.uid(),'coach'::public.app_role) OR public.is_org_admin(auth.uid(), organization_id) OR public.is_org_staff(auth.uid(), organization_id, 'manage_performance'))
WITH CHECK (public.has_role(auth.uid(),'coach'::public.app_role) OR public.is_org_admin(auth.uid(), organization_id) OR public.is_org_staff(auth.uid(), organization_id, 'manage_performance'));

CREATE TABLE public.performance_athlete_domain_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.performance_athlete_profiles(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  domain_id uuid NOT NULL REFERENCES public.performance_domains(id) ON DELETE CASCADE,
  score numeric,
  contributing_metrics jsonb NOT NULL DEFAULT '[]'::jsonb,
  calculated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (profile_id, domain_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.performance_athlete_domain_scores TO authenticated;
GRANT ALL ON public.performance_athlete_domain_scores TO service_role;
ALTER TABLE public.performance_athlete_domain_scores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "perf_ds read" ON public.performance_athlete_domain_scores FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.has_role(auth.uid(),'coach'::public.app_role) OR public.is_org_staff(auth.uid(), organization_id, 'view_performance') OR public.is_org_staff(auth.uid(), organization_id, 'manage_performance'));
CREATE POLICY "perf_ds write" ON public.performance_athlete_domain_scores FOR ALL TO authenticated
USING (public.has_role(auth.uid(),'coach'::public.app_role) OR public.is_org_admin(auth.uid(), organization_id) OR public.is_org_staff(auth.uid(), organization_id, 'manage_performance'))
WITH CHECK (public.has_role(auth.uid(),'coach'::public.app_role) OR public.is_org_admin(auth.uid(), organization_id) OR public.is_org_staff(auth.uid(), organization_id, 'manage_performance'));

CREATE TABLE public.performance_athlete_focus_areas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  framework_id uuid NOT NULL REFERENCES public.performance_frameworks(id) ON DELETE CASCADE,
  domain_id uuid REFERENCES public.performance_domains(id) ON DELETE SET NULL,
  metric_definition_id uuid REFERENCES public.performance_metric_definitions(id) ON DELETE SET NULL,
  label text NOT NULL,
  rationale text,
  priority integer NOT NULL DEFAULT 0,
  source text NOT NULL DEFAULT 'engine',
  status text NOT NULL DEFAULT 'suggested',
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.performance_athlete_focus_areas TO authenticated;
GRANT ALL ON public.performance_athlete_focus_areas TO service_role;
ALTER TABLE public.performance_athlete_focus_areas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "perf_focus read" ON public.performance_athlete_focus_areas FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.has_role(auth.uid(),'coach'::public.app_role) OR public.is_org_staff(auth.uid(), organization_id, 'view_performance') OR public.is_org_staff(auth.uid(), organization_id, 'manage_performance'));
CREATE POLICY "perf_focus write" ON public.performance_athlete_focus_areas FOR ALL TO authenticated
USING (public.has_role(auth.uid(),'coach'::public.app_role) OR public.is_org_admin(auth.uid(), organization_id) OR public.is_org_staff(auth.uid(), organization_id, 'manage_performance'))
WITH CHECK (public.has_role(auth.uid(),'coach'::public.app_role) OR public.is_org_admin(auth.uid(), organization_id) OR public.is_org_staff(auth.uid(), organization_id, 'manage_performance'));

CREATE TABLE public.performance_retest_schedule (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  battery_id uuid REFERENCES public.performance_test_batteries(id) ON DELETE CASCADE,
  test_definition_id uuid REFERENCES public.performance_test_definitions(id) ON DELETE CASCADE,
  last_tested_at date,
  next_retest_due date NOT NULL,
  auto_created boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.performance_retest_schedule TO authenticated;
GRANT ALL ON public.performance_retest_schedule TO service_role;
ALTER TABLE public.performance_retest_schedule ENABLE ROW LEVEL SECURITY;
CREATE POLICY "perf_retest read" ON public.performance_retest_schedule FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.has_role(auth.uid(),'coach'::public.app_role) OR public.is_org_staff(auth.uid(), organization_id, 'view_performance') OR public.is_org_staff(auth.uid(), organization_id, 'manage_performance'));
CREATE POLICY "perf_retest write" ON public.performance_retest_schedule FOR ALL TO authenticated
USING (public.has_role(auth.uid(),'coach'::public.app_role) OR public.is_org_admin(auth.uid(), organization_id) OR public.is_org_staff(auth.uid(), organization_id, 'manage_performance'))
WITH CHECK (public.has_role(auth.uid(),'coach'::public.app_role) OR public.is_org_admin(auth.uid(), organization_id) OR public.is_org_staff(auth.uid(), organization_id, 'manage_performance'));

CREATE TRIGGER trg_perf_frameworks_upd BEFORE UPDATE ON public.performance_frameworks FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_perf_domains_upd BEFORE UPDATE ON public.performance_domains FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_perf_batteries_upd BEFORE UPDATE ON public.performance_test_batteries FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_perf_testdefs_upd BEFORE UPDATE ON public.performance_test_definitions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_perf_metricdefs_upd BEFORE UPDATE ON public.performance_metric_definitions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_perf_dmw_upd BEFORE UPDATE ON public.performance_domain_metric_weights FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_perf_posprof_upd BEFORE UPDATE ON public.performance_position_profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_perf_pdw_upd BEFORE UPDATE ON public.performance_position_domain_weights FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_perf_bench_upd BEFORE UPDATE ON public.performance_benchmark_models FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_perf_sessions_upd BEFORE UPDATE ON public.performance_test_sessions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_perf_profiles_upd BEFORE UPDATE ON public.performance_athlete_profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_perf_focus_upd BEFORE UPDATE ON public.performance_athlete_focus_areas FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_perf_retest_upd BEFORE UPDATE ON public.performance_retest_schedule FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
