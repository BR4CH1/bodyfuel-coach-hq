import type { PermissionKey } from "@/lib/organizations/staff-labels";
import type { OrgTerminology } from "@/lib/organizations/org-type";

export type OrgTeam = {
  id: string;
  name: string;
};

export type OrgTeamDetail = OrgTeam & {
  slug?: string | null;
  sport: string | null;
  age_group: string | null;
};

export type TeamKpi = {
  team_id: string;
  athletes: number;
  weekly_compliance: number | null;
  pending_onboardings: number;
};

export type OrgAthleteSummary = {
  user_id: string;
  name?: string;
  email?: string | null;
  team_name: string | null;
  position?: string | null;
  onboarding_completed?: boolean;
  joined_at?: string | null;
};

export type OrgDetailOrganization = {
  id: string;
  name: string;
  slug: string | null;
  organization_type: string | null;
  sport: string | null;
  status: string | null;
  primary_color: string | null;
  secondary_color: string | null;
  accent_color: string | null;
  background_color: string | null;
  text_color: string | null;
  logo_url: string | null;
  alt_logo_url: string | null;
  claim: string | null;
  short_name: string | null;
  terminology: Partial<OrgTerminology> | null;
  branding_mode: string | null;
  branding_extra: Record<string, unknown> | null;
  license_plan: string | null;
  license_status: string | null;
  license_started_at: string | null;
  license_expires_at: string | null;
  max_customers: number | null;
  max_coaches: number | null;
};

export type OrgFeature = {
  feature: string;
  enabled: boolean;
};

export type OrgCaller = {
  experience: string;
  is_bodyfuel_coach: boolean;
  team_id: string | null;
  all_teams?: boolean;
  allowed_team_ids?: string[] | null;
};

export type OrgChallengeSummary = {
  id: string;
  name: string;
  starts_at: string | null;
  ends_at: string | null;
  status: string;
};

export type OrgActivity = {
  id: string;
  event_type: string;
  payload?: unknown;
  user_id?: string | null;
  created_at: string;
};

export type OrgCoachDetailData = {
  org: OrgDetailOrganization | null;
  teams: OrgTeamDetail[];
  team_kpis: TeamKpi[];
  athletes: OrgAthleteSummary[];
  staff: unknown[];
  features: OrgFeature[];
  active_challenge: OrgChallengeSummary | null;
  activity: OrgActivity[];
  pending_onboardings: number;
  weekly_compliance: number | null;
  caller: OrgCaller;
};

export type OrgJoinLinkTeam = {
  id: string;
  name: string;
};

export type ScheduleEntry = {
  id?: string | null;
  team_id?: string | null;
  weekday: number;
  title?: string;
  description?: string | null;
  start_time?: string | null;
  end_time?: string | null;
  active?: boolean;
};

export type ScheduleRow = {
  weekday: number;
  title: string;
  start_time: string;
  end_time: string;
  active: boolean;
};

export type OrgStaffMember = {
  id: string;
  user_id: string;
  name: string;
  role: string;
  permissions: PermissionKey[];
  team_id: string | null;
  team_name: string | null;
};

export type OrgStaffInvite = {
  id: string;
  email: string;
  assigned_role: string;
  team_id: string | null;
  status: string;
  expires_at: string | null;
  created_at: string;
};

export type OrgStaffUpdatePatch = {
  role?: string;
  permissions?: PermissionKey[];
  team_id?: string | null;
};

export type AddOrgStaffPayload = {
  email: string;
  role: string;
  team_id: string | null;
  permissions: PermissionKey[];
};

export type AddOrgStaffResult = {
  invited?: boolean;
  existing_user?: boolean;
};

export type RemoveOrgStaffResult = {
  deleted_account?: boolean;
};

export type StaffFeedback = {
  kind: "success" | "error";
  text: string;
};

export type CommunitySubTab = "feed" | "challenges" | "ranking";

export type ChallengeStatus = "active" | "archived" | string;

export type OrgChallenge = {
  id: string;
  name: string;
  status: ChallengeStatus;
  starts_at: string;
  ends_at: string | null;
  visibility_scope: string;
  team_id: string | null;
  rule_count: number;
};

export type ChallengeGroups = {
  active: OrgChallenge[];
  planned: OrgChallenge[];
  past: OrgChallenge[];
};

export type ChallengeDraft = {
  name: string;
  description: string;
  start: string;
  end: string;
  teamId: string;
};

export type ChallengeRule = {
  id: string;
  rule_type: string;
  title: string;
  description: string | null;
  points: number;
  frequency: string;
  max_per_day: number | null;
  max_total: number | null;
  active: boolean;
};

export type ChallengeRuleDraft = {
  ruleType: string;
  title: string;
  points: number;
  frequency: string;
};

export type ChallengeBonusDraft = {
  userId: string;
  points: number;
  reason: string;
};

export type CommunityPostType =
  "staff_update" | "announcement" | "training" | "challenge" | "achievement" | "general";

export type CommunityPost = {
  id: string;
  team_id: string | null;
  author_user_id: string;
  author_role_snapshot: string;
  post_type: string;
  content: string;
  image_url: string | null;
  author_name: string;
  created_at: string;
};

export type CommunityPostDraft = {
  content: string;
  postType: CommunityPostType;
};
