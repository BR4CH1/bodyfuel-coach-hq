import type { PermissionKey, PresetKey } from "./staff-labels";

export type StaffPreset = {
  role: "organization_admin" | "coach" | "staff";
  permissions: PermissionKey[];
  scope_hint?: "org" | "team";
};

export const STAFF_PRESETS = {
  ORGANIZATION_ADMIN: {
    role: "organization_admin",
    scope_hint: "org",
    permissions: [
      "view_members",
      "manage_members",
      "view_training",
      "manage_training",
      "view_performance",
      "manage_performance",
      "view_checkins",
      "view_nutrition",
      "manage_challenges",
      "manage_ranking",
      "manage_community",
      "manage_staff",
      "manage_organization",
    ],
  },
  TEAM_COACH: {
    role: "coach",
    scope_hint: "team",
    permissions: [
      "view_members",
      "view_training",
      "manage_training",
      "view_checkins",
      "manage_challenges",
      "manage_community",
    ],
  },
  PERFORMANCE_COACH: {
    role: "staff",
    scope_hint: "team",
    permissions: [
      "view_members",
      "view_training",
      "manage_training",
      "view_performance",
      "manage_performance",
      "view_checkins",
    ],
  },
  NUTRITION_COACH: {
    role: "staff",
    scope_hint: "org",
    permissions: ["view_members", "view_nutrition"],
  },
  COMMUNITY_MANAGER: {
    role: "staff",
    scope_hint: "org",
    permissions: ["manage_challenges", "manage_ranking", "manage_community"],
  },
  CUSTOM: {
    role: "staff",
    scope_hint: "org",
    permissions: [],
  },
} satisfies Record<PresetKey, StaffPreset>;

export const ALL_PERMISSIONS = [
  "view_members",
  "manage_members",
  "view_training",
  "manage_training",
  "view_performance",
  "manage_performance",
  "view_checkins",
  "view_nutrition",
  "manage_challenges",
  "manage_ranking",
  "manage_community",
  "manage_staff",
  "manage_organization",
] as const satisfies readonly PermissionKey[];
