
-- =====================================================================
-- BodyFuel Performance Nutrition Engine V1 — Data model (Phase 1)
-- Org-scoped, strictly separated from personal BodyFuel nutrition_targets.
-- =====================================================================

-- 1) Performance Nutrition Profile (per user × organization)
CREATE TABLE IF NOT EXISTS public.performance_nutrition_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  sex_for_energy_calculation text CHECK (sex_for_energy_calculation IN ('MALE','FEMALE','UNSPECIFIED')),
  baseline_daily_activity text CHECK (baseline_daily_activity IN ('MOSTLY_SEATED','MIXED','PHYSICALLY_ACTIVE','VERY_PHYSICALLY_ACTIVE')),
  performance_goal text CHECK (performance_goal IN ('PERFORMANCE','STRENGTH_GAIN','MUSCLE_GAIN','SPEED_EXPLOSIVENESS','FAT_LOSS')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, organization_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.performance_nutrition_profiles TO authenticated;
GRANT ALL ON public.performance_nutrition_profiles TO service_role;

ALTER TABLE public.performance_nutrition_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "perf nutrition profile: self read"
  ON public.performance_nutrition_profiles FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "perf nutrition profile: staff read"
  ON public.performance_nutrition_profiles FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'coach'::public.app_role)
    OR public.is_org_admin(auth.uid(), organization_id)
    OR public.is_org_staff(auth.uid(), organization_id, 'view_nutrition')
  );

CREATE POLICY "perf nutrition profile: self manage"
  ON public.performance_nutrition_profiles FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "perf nutrition profile: staff manage"
  ON public.performance_nutrition_profiles FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'coach'::public.app_role)
    OR public.is_org_admin(auth.uid(), organization_id)
    OR public.is_org_staff(auth.uid(), organization_id, 'manage_nutrition')
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'coach'::public.app_role)
    OR public.is_org_admin(auth.uid(), organization_id)
    OR public.is_org_staff(auth.uid(), organization_id, 'manage_nutrition')
  );

CREATE TRIGGER trg_perf_nutrition_profiles_updated
  BEFORE UPDATE ON public.performance_nutrition_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2) Adaptive calibration state (per user × organization)
CREATE TABLE IF NOT EXISTS public.performance_nutrition_calibrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  personal_calibration_kcal integer NOT NULL DEFAULT 0,
  last_calibration_at timestamptz,
  weight_trend_percent_per_week numeric,
  calibration_mode text NOT NULL DEFAULT 'AUTOMATIC' CHECK (calibration_mode IN ('AUTOMATIC','COACH_REVIEW','DISABLED')),
  engine_version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, organization_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.performance_nutrition_calibrations TO authenticated;
GRANT ALL ON public.performance_nutrition_calibrations TO service_role;

ALTER TABLE public.performance_nutrition_calibrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "perf nutrition calib: self read"
  ON public.performance_nutrition_calibrations FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "perf nutrition calib: staff read"
  ON public.performance_nutrition_calibrations FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'coach'::public.app_role)
    OR public.is_org_admin(auth.uid(), organization_id)
    OR public.is_org_staff(auth.uid(), organization_id, 'view_nutrition')
  );

CREATE POLICY "perf nutrition calib: staff manage"
  ON public.performance_nutrition_calibrations FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'coach'::public.app_role)
    OR public.is_org_admin(auth.uid(), organization_id)
    OR public.is_org_staff(auth.uid(), organization_id, 'manage_nutrition')
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'coach'::public.app_role)
    OR public.is_org_admin(auth.uid(), organization_id)
    OR public.is_org_staff(auth.uid(), organization_id, 'manage_nutrition')
  );

CREATE TRIGGER trg_perf_nutrition_calibrations_updated
  BEFORE UPDATE ON public.performance_nutrition_calibrations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3) Calculation history — append-only ledger of engine results
CREATE TABLE IF NOT EXISTS public.performance_nutrition_calculations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  calculation_date date NOT NULL,
  day_type text NOT NULL,
  pal_category text,
  position_cluster text,
  performance_goal text,
  effective_goal text,
  session_intensity text,
  age_at_calculation numeric,
  weight_kg numeric,
  height_cm numeric,
  initial_eer numeric,
  goal_modifier numeric,
  goal_adjusted_energy numeric,
  personal_calibration_kcal integer NOT NULL DEFAULT 0,
  protein_g integer,
  fat_g integer,
  carbs_g integer,
  final_target_kcal integer,
  carb_floor_g integer,
  energy_floor_applied boolean NOT NULL DEFAULT false,
  coach_review_required boolean NOT NULL DEFAULT false,
  calculation_flags text[] NOT NULL DEFAULT '{}',
  engine_version integer NOT NULL DEFAULT 1,
  calculated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_perf_nutrition_calc_user_org_date
  ON public.performance_nutrition_calculations (user_id, organization_id, calculation_date DESC);

GRANT SELECT, INSERT ON public.performance_nutrition_calculations TO authenticated;
GRANT ALL ON public.performance_nutrition_calculations TO service_role;

ALTER TABLE public.performance_nutrition_calculations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "perf nutrition calc: self read"
  ON public.performance_nutrition_calculations FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "perf nutrition calc: staff read"
  ON public.performance_nutrition_calculations FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'coach'::public.app_role)
    OR public.is_org_admin(auth.uid(), organization_id)
    OR public.is_org_staff(auth.uid(), organization_id, 'view_nutrition')
  );

-- Insert allowed for self (their own row in their own org) and staff.
-- History is append-only: no UPDATE/DELETE policy for regular users.
CREATE POLICY "perf nutrition calc: self insert"
  ON public.performance_nutrition_calculations FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.organization_memberships m
      WHERE m.user_id = auth.uid()
        AND m.organization_id = performance_nutrition_calculations.organization_id
        AND m.status = 'active'
    )
  );

CREATE POLICY "perf nutrition calc: staff insert"
  ON public.performance_nutrition_calculations FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'coach'::public.app_role)
    OR public.is_org_admin(auth.uid(), organization_id)
    OR public.is_org_staff(auth.uid(), organization_id, 'manage_nutrition')
  );

-- Note: history is intentionally append-only. Old calculations must never be
-- rewritten when profile data changes or the engine version increases.
