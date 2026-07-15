
-- 1) organization_memberships: block self-delete of privileged rows (prevents delete+reinsert elevation churn)
CREATE POLICY "memberships no self elevation on delete"
ON public.organization_memberships
AS RESTRICTIVE
FOR DELETE
TO authenticated
USING (
  user_id <> auth.uid()
  OR has_role(auth.uid(), 'platform_owner'::app_role)
  OR role <> ALL (ARRAY['organization_admin'::organization_role, 'coach'::organization_role])
);

-- 2) leads: tighten public insert with length limits on all PII fields
ALTER TABLE public.leads DROP CONSTRAINT IF EXISTS leads_name_length_check;
ALTER TABLE public.leads DROP CONSTRAINT IF EXISTS leads_phone_length_check;
ALTER TABLE public.leads DROP CONSTRAINT IF EXISTS leads_goal_length_check;
ALTER TABLE public.leads DROP CONSTRAINT IF EXISTS leads_current_weight_length_check;
ALTER TABLE public.leads DROP CONSTRAINT IF EXISTS leads_message_length_check;

ALTER TABLE public.leads
  ADD CONSTRAINT leads_name_length_check
    CHECK (length(name) BETWEEN 1 AND 120),
  ADD CONSTRAINT leads_phone_length_check
    CHECK (phone IS NULL OR length(phone) <= 40),
  ADD CONSTRAINT leads_goal_length_check
    CHECK (goal IS NULL OR length(goal) <= 200),
  ADD CONSTRAINT leads_current_weight_length_check
    CHECK (current_weight IS NULL OR length(current_weight) <= 20),
  ADD CONSTRAINT leads_message_length_check
    CHECK (message IS NULL OR length(message) <= 2000);
