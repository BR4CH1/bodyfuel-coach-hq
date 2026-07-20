import type {
  ChallengeDraft,
  ChallengeGroups,
  ChallengeRuleDraft,
  CommunityPostDraft,
  OrgChallenge,
} from "@/features/coach-org-detail/types";

export const CHALLENGE_RULE_TYPES = [
  "daily_task",
  "daily_checkin",
  "training_completed",
  "athletic_training_completed",
  "team_training_attendance",
  "hydration",
  "nutrition",
  "recovery",
  "manual_bonus",
  "custom",
] as const;

export const CHALLENGE_FREQUENCIES = ["daily", "per_completion", "once", "weekly"] as const;

export const COMMUNITY_POST_TYPES = [
  "staff_update",
  "announcement",
  "training",
  "challenge",
  "achievement",
  "general",
] as const;

export function todayAsDateInput(now = new Date()): string {
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  const day = String(now.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function createEmptyChallengeDraft(now = new Date()): ChallengeDraft {
  return {
    name: "",
    description: "",
    start: todayAsDateInput(now),
    end: "",
    teamId: "",
  };
}

export function validateChallengeDraft(draft: ChallengeDraft): string | null {
  const name = draft.name.trim();
  if (name.length < 2) return "Der Challenge-Name muss mindestens 2 Zeichen lang sein.";
  if (name.length > 120) return "Der Challenge-Name darf höchstens 120 Zeichen lang sein.";
  if (!isDateInput(draft.start)) return "Bitte ein gültiges Startdatum auswählen.";
  if (draft.end && !isDateInput(draft.end)) return "Bitte ein gültiges Enddatum auswählen.";
  if (draft.end && draft.end < draft.start)
    return "Das Enddatum darf nicht vor dem Startdatum liegen.";
  return null;
}

export function buildChallengePayload(draft: ChallengeDraft, organizationId: string) {
  return {
    organization_id: organizationId,
    name: draft.name.trim(),
    description: draft.description.trim() || null,
    starts_at: `${draft.start}T00:00:00.000Z`,
    ends_at: draft.end ? `${draft.end}T23:59:59.999Z` : null,
    team_id: draft.teamId || null,
    visibility_scope: "organization",
  };
}

export function splitChallenges(challenges: OrgChallenge[], now = new Date()): ChallengeGroups {
  const timestamp = now.getTime();
  const groups: ChallengeGroups = { active: [], planned: [], past: [] };

  for (const challenge of challenges) {
    const startsAt = parseTimestamp(challenge.starts_at);
    const endsAt = challenge.ends_at ? parseTimestamp(challenge.ends_at) : null;
    const isArchived = challenge.status === "archived";
    const hasEnded = endsAt !== null && endsAt < timestamp;
    const startsInFuture = startsAt !== null && startsAt > timestamp;

    if (isArchived || hasEnded || challenge.status !== "active") {
      groups.past.push(challenge);
    } else if (startsInFuture) {
      groups.planned.push(challenge);
    } else {
      groups.active.push(challenge);
    }
  }

  return groups;
}

export function validateChallengeRuleDraft(draft: ChallengeRuleDraft): string | null {
  if (!Number.isFinite(draft.points) || draft.points <= 0)
    return "Die Punkte müssen größer als 0 sein.";
  return null;
}

export function normalizeChallengeRuleDraft(draft: ChallengeRuleDraft, challengeId: string) {
  return {
    challenge_id: challengeId,
    rule_type: draft.ruleType,
    title: draft.title.trim() || draft.ruleType,
    points: Math.round(draft.points),
    frequency: draft.frequency,
  };
}

export function validateCommunityPostDraft(draft: CommunityPostDraft): string | null {
  const content = draft.content.trim();
  if (!content) return "Der Beitrag darf nicht leer sein.";
  if (content.length > 5000) return "Der Beitrag darf höchstens 5.000 Zeichen enthalten.";
  return null;
}

export function normalizeCommunityPostDraft(draft: CommunityPostDraft) {
  return {
    content: draft.content.trim(),
    post_type: draft.postType,
  };
}

function isDateInput(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function parseTimestamp(value: string): number | null {
  const timestamp = new Date(value).getTime();
  return Number.isNaN(timestamp) ? null : timestamp;
}
