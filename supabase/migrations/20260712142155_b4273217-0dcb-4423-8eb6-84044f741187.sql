-- Privilege escalation: the "challenge progress upsert own" policy let any
-- authenticated user INSERT/UPDATE their own row (including the `points`
-- column), enabling arbitrary leaderboard score manipulation. Point writes
-- must only come from trusted server-side code (service role, which bypasses
-- RLS) or org staff/coaches via the existing "challenge progress manage by
-- staff" policy. Reads remain available through "challenge progress read by
-- member".
DROP POLICY IF EXISTS "challenge progress upsert own" ON public.organization_challenge_progress;