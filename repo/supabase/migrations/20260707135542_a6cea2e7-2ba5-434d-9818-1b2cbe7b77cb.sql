
CREATE TABLE public.bulls_performance_tests (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  performance_profile text NOT NULL DEFAULT 'football_bulls',
  module_id text NOT NULL,
  test_id text NOT NULL,
  variant text,
  position_snapshot text,

  result_value numeric NOT NULL,
  result_unit text NOT NULL,
  reps integer,
  rir numeric,
  bodyweight_kg numeric,

  measurement_method text,
  surface text,
  footwear text,

  video_path text,
  video_uploaded_at timestamptz,

  verification_status text NOT NULL DEFAULT 'submitted'
    CHECK (verification_status IN ('draft','submitted','verified','corrected','rejected')),
  verified_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  verified_at timestamptz,
  coach_corrected_value numeric,
  coach_note text,
  rejection_reason text,

  performed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_bpt_user ON public.bulls_performance_tests(user_id, performed_at DESC);
CREATE INDEX idx_bpt_status ON public.bulls_performance_tests(verification_status);
CREATE INDEX idx_bpt_test ON public.bulls_performance_tests(module_id, test_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.bulls_performance_tests TO authenticated;
GRANT ALL ON public.bulls_performance_tests TO service_role;

ALTER TABLE public.bulls_performance_tests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bpt_player_read_own" ON public.bulls_performance_tests
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "bpt_player_insert_own" ON public.bulls_performance_tests
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND verification_status IN ('draft','submitted')
    AND verified_by IS NULL
    AND verified_at IS NULL
    AND coach_corrected_value IS NULL
  );

CREATE POLICY "bpt_player_update_own_draft" ON public.bulls_performance_tests
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id AND verification_status IN ('draft','submitted','rejected'))
  WITH CHECK (
    auth.uid() = user_id
    AND verification_status IN ('draft','submitted')
    AND verified_by IS NULL
    AND coach_corrected_value IS NULL
  );

CREATE POLICY "bpt_player_delete_own_draft" ON public.bulls_performance_tests
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id AND verification_status IN ('draft','rejected'));

CREATE POLICY "bpt_coach_read_all" ON public.bulls_performance_tests
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'coach'::public.app_role)
    OR EXISTS (
      SELECT 1 FROM public.staff_assignments s
      WHERE s.user_id = auth.uid()
        AND s.role IN ('organization_admin','coach')
    )
  );

CREATE POLICY "bpt_coach_update_verify" ON public.bulls_performance_tests
  FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'coach'::public.app_role)
    OR EXISTS (
      SELECT 1 FROM public.staff_assignments s
      WHERE s.user_id = auth.uid()
        AND s.role IN ('organization_admin','coach')
    )
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'coach'::public.app_role)
    OR EXISTS (
      SELECT 1 FROM public.staff_assignments s
      WHERE s.user_id = auth.uid()
        AND s.role IN ('organization_admin','coach')
    )
  );

CREATE TRIGGER trg_bpt_updated_at
  BEFORE UPDATE ON public.bulls_performance_tests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Storage policies for bulls-performance-videos
CREATE POLICY "bpv_player_select_own" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'bulls-performance-videos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "bpv_player_insert_own" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'bulls-performance-videos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "bpv_player_delete_own" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'bulls-performance-videos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "bpv_coach_select_all" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'bulls-performance-videos'
    AND (
      public.has_role(auth.uid(), 'coach'::public.app_role)
      OR EXISTS (
        SELECT 1 FROM public.staff_assignments s
        WHERE s.user_id = auth.uid()
          AND s.role IN ('organization_admin','coach')
      )
    )
  );
