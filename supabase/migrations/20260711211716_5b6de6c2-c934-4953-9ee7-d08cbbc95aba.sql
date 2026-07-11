CREATE OR REPLACE FUNCTION public.is_bulls_org(_org_id uuid)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT _org_id = 'b86f49ab-20b7-42ca-bba4-f65ca8757c4c'::uuid;
$$;