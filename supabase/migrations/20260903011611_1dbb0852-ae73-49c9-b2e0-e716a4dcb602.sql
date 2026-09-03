ALTER TABLE public.continental_challenge_applications
  DROP CONSTRAINT IF EXISTS continental_applications_goal_type_check;

ALTER TABLE public.continental_challenge_applications
  ADD CONSTRAINT continental_applications_goal_type_check
  CHECK (goal_type IN ('abnehmen','muskeln_aufbauen','fitter_werden','gewohnheiten','sonstiges','ernaehrung','regelmaessig_sport','gesuender_leben'));