
-- Modul-Katalog: alle Standardmodule als organization_features-Zeilen sichern.
-- Bestandsorganisationen bleiben unverändert (ON CONFLICT DO NOTHING).

DO $$
DECLARE
  v_org RECORD;
  v_all_modules text[] := ARRAY[
    'home','nutrition','athletic_training','load_management',
    'gamification','challenges','checkins','performance',
    'injury_management','community','ranking','training'
  ];
  v_default_on_generic text[] := ARRAY[
    'home','nutrition','gamification','challenges','ranking','checkins','community'
  ];
  v_module text;
  v_is_bulls boolean;
  v_enabled boolean;
BEGIN
  FOR v_org IN SELECT id, slug FROM public.organizations LOOP
    v_is_bulls := lower(coalesce(v_org.slug,'')) = 'bulls';
    FOREACH v_module IN ARRAY v_all_modules LOOP
      -- Bulls: alle Module standardmäßig an. Andere Orgs: nur Default-Set an,
      -- rest aus. Bestehende Zeilen werden per ON CONFLICT NICHT geändert.
      IF v_is_bulls THEN
        v_enabled := true;
      ELSE
        v_enabled := v_module = ANY(v_default_on_generic);
      END IF;

      INSERT INTO public.organization_features (organization_id, feature, enabled)
      VALUES (v_org.id, v_module, v_enabled)
      ON CONFLICT (organization_id, feature) DO NOTHING;
    END LOOP;
  END LOOP;
END $$;
