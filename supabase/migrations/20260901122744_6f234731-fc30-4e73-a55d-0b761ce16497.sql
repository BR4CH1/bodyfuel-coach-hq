CREATE OR REPLACE FUNCTION public.review_continental_application(
  _id uuid,
  _decision text,
  _reviewer uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  approved_count integer;
  current_status text;
BEGIN
  IF _decision NOT IN ('approved', 'rejected') THEN
    RAISE EXCEPTION 'invalid decision';
  END IF;

  -- Serialisiert alle Approvals dieser Challenge (transaktionsgebundener Advisory Lock)
  PERFORM pg_advisory_xact_lock(hashtext('continental_challenge_approvals'));

  SELECT status INTO current_status
  FROM public.continental_challenge_applications
  WHERE id = _id
  FOR UPDATE;

  IF current_status IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'not_found');
  END IF;

  IF _decision = 'approved' AND current_status <> 'approved' THEN
    SELECT count(*) INTO approved_count
    FROM public.continental_challenge_applications
    WHERE status = 'approved';

    IF approved_count >= 25 THEN
      RETURN jsonb_build_object('ok', false, 'code', 'capacity');
    END IF;
  END IF;

  UPDATE public.continental_challenge_applications
  SET status = _decision,
      reviewed_at = now(),
      reviewed_by = _reviewer,
      updated_at = now()
  WHERE id = _id;

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.review_continental_application(uuid, text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.review_continental_application(uuid, text, uuid) TO service_role;