import { STAFF_PRESETS } from "@/lib/organizations/staff-presets";
import {
  PERMISSION_LABELS,
  type PermissionKey,
  type PresetKey,
} from "@/lib/organizations/staff-labels";
import type { AddOrgStaffResult, OrgStaffInvite, RemoveOrgStaffResult } from "../types";

export const STAFF_PERMISSION_KEYS = Object.keys(PERMISSION_LABELS) as PermissionKey[];

export function normalizePermissionList(
  values: readonly string[] | null | undefined,
): PermissionKey[] {
  if (!values?.length) return [];

  const allowed = new Set<PermissionKey>(STAFF_PERMISSION_KEYS);
  return Array.from(
    new Set(values.filter((value): value is PermissionKey => allowed.has(value as PermissionKey))),
  );
}

export function togglePermission(
  permissions: readonly PermissionKey[],
  permission: PermissionKey,
): PermissionKey[] {
  return permissions.includes(permission)
    ? permissions.filter((current) => current !== permission)
    : [...permissions, permission];
}

export function getMissingPermissions(permissions: readonly PermissionKey[]): PermissionKey[] {
  return STAFF_PERMISSION_KEYS.filter((permission) => !permissions.includes(permission));
}

export function getPendingStaffInvites(invites: readonly OrgStaffInvite[]): OrgStaffInvite[] {
  return invites.filter((invite) => invite.status === "pending");
}

export function normalizeStaffEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function getStaffPreset(presetKey: PresetKey): {
  role: string;
  permissions: PermissionKey[];
  scope_hint?: "org" | "team";
} {
  const preset = STAFF_PRESETS[presetKey];

  return {
    role: preset.role,
    permissions: normalizePermissionList(preset.permissions),
    scope_hint: preset.scope_hint,
  };
}

export function getAddStaffSuccessMessage(result: AddOrgStaffResult, email: string): string {
  if (result.invited) return `Einladung an ${email} versendet.`;
  if (result.existing_user) return "Bestehender BODYFUEL User als Staff hinzugefügt.";
  return "Staff hinzugefügt.";
}

export function getRemoveStaffSuccessMessage(result: RemoveOrgStaffResult): string {
  return result.deleted_account ? "Konto vollständig gelöscht." : "Aus Verein entfernt.";
}
