
CREATE TABLE public.player_card_design (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scope text NOT NULL DEFAULT 'global',
  template_url text,
  template_uploaded_at timestamptz,
  layout_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_published boolean NOT NULL DEFAULT false,
  published_at timestamptz,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (scope)
);

GRANT SELECT ON public.player_card_design TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.player_card_design TO authenticated;
GRANT ALL ON public.player_card_design TO service_role;

ALTER TABLE public.player_card_design ENABLE ROW LEVEL SECURITY;

CREATE POLICY "player_card_design readable by everyone"
  ON public.player_card_design FOR SELECT
  USING (true);

CREATE POLICY "player_card_design manage by coach or platform_owner"
  ON public.player_card_design FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'coach') OR public.has_role(auth.uid(), 'platform_owner'))
  WITH CHECK (public.has_role(auth.uid(), 'coach') OR public.has_role(auth.uid(), 'platform_owner'));

CREATE TRIGGER update_player_card_design_updated_at
  BEFORE UPDATE ON public.player_card_design
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.player_card_design (scope, layout_json, is_published)
VALUES ('global', '{}'::jsonb, false)
ON CONFLICT (scope) DO NOTHING;
