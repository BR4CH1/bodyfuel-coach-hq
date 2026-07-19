import { describe, expect, it } from "vitest";
import {
  getAddStaffSuccessMessage,
  getMissingPermissions,
  getPendingStaffInvites,
  getStaffPreset,
  normalizePermissionList,
  normalizeStaffEmail,
  togglePermission,
} from "../staff.logic";

describe("coach organization staff logic", () => {
  it("normalizes permission lists and removes duplicates or unknown keys", () => {
    expect(
      normalizePermissionList([
        "view_members",
        "view_members",
        "manage_training",
        "unknown_permission",
      ]),
    ).toEqual(["view_members", "manage_training"]);
  });

  it("adds and removes permissions without mutating the source list", () => {
    const source = ["view_members"] as const;
    const added = togglePermission(source, "manage_training");
    const removed = togglePermission(added, "view_members");

    expect(source).toEqual(["view_members"]);
    expect(added).toEqual(["view_members", "manage_training"]);
    expect(removed).toEqual(["manage_training"]);
  });

  it("returns only pending invitations", () => {
    const pending = getPendingStaffInvites([
      {
        id: "pending",
        email: "coach@example.com",
        assigned_role: "coach",
        team_id: null,
        status: "pending",
        expires_at: null,
        created_at: "2026-07-19T00:00:00Z",
      },
      {
        id: "revoked",
        email: "old@example.com",
        assigned_role: "staff",
        team_id: null,
        status: "revoked",
        expires_at: null,
        created_at: "2026-07-18T00:00:00Z",
      },
    ]);

    expect(pending.map((invite) => invite.id)).toEqual(["pending"]);
  });

  it("builds typed preset defaults and missing permissions", () => {
    const preset = getStaffPreset("TEAM_COACH");
    const missing = getMissingPermissions(preset.permissions);

    expect(preset.role).toBe("coach");
    expect(preset.permissions).toContain("manage_training");
    expect(missing).toContain("manage_staff");
  });

  it("normalizes emails and creates accurate success messages", () => {
    const email = normalizeStaffEmail("  Coach@Example.COM ");

    expect(email).toBe("coach@example.com");
    expect(getAddStaffSuccessMessage({ invited: true }, email)).toBe(
      "Einladung an coach@example.com versendet.",
    );
    expect(getAddStaffSuccessMessage({ existing_user: true }, email)).toBe(
      "Bestehender BODYFUEL User als Staff hinzugefügt.",
    );
  });
});
