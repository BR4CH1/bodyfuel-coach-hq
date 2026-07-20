INSERT INTO organization_features (organization_id, feature, enabled)
SELECT id, 'load_management', true FROM organizations
ON CONFLICT (organization_id, feature) DO UPDATE SET enabled = true;