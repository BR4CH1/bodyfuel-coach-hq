import { describe, expect, it } from "vitest";
import { buildAvailableContexts } from "@/lib/access/user-access.logic";

const sgzAthleteAndCoach = {
  organizationId: "11111111-1111-4111-8111-111111111111",
  organizationSlug: "sgz-altenessen",
  organizationName: "SGZ-Altenessen",
  role: "athlete",
  staffRole: "coach",
  membershipStatus: "active",
};

describe("buildAvailableContexts", () => {
  it("keeps personal, athlete and coach contexts additive", () => {
    expect(buildAvailableContexts(true, [sgzAthleteAndCoach])).toEqual([
      {
        type: "personal_bodyfuel",
        label: "Mein BODYFUEL",
        contextKey: "personal",
      },
      {
        type: "organization",
        organizationId: sgzAthleteAndCoach.organizationId,
        organizationSlug: "sgz-altenessen",
        label: "SGZ-Altenessen – Athlet",
        role: "athlete",
        mode: "athlete",
        contextKey: `organization:${sgzAthleteAndCoach.organizationId}:role:athlete`,
      },
      {
        type: "organization",
        organizationId: sgzAthleteAndCoach.organizationId,
        organizationSlug: "sgz-altenessen",
        label: "SGZ-Altenessen – Coach",
        role: "coach",
        mode: "staff",
        contextKey: `organization:${sgzAthleteAndCoach.organizationId}:role:staff`,
      },
    ]);
  });

  it("does not invent a coach context for an athlete-only organization", () => {
    const contexts = buildAvailableContexts(false, [{ ...sgzAthleteAndCoach, staffRole: null }]);

    expect(contexts).toHaveLength(1);
    expect(contexts[0]).toMatchObject({ mode: "athlete", role: "athlete" });
  });

  it("keeps a staff assignment valid even if a legacy membership is inactive", () => {
    const contexts = buildAvailableContexts(false, [
      { ...sgzAthleteAndCoach, membershipStatus: "inactive" },
    ]);

    expect(contexts).toEqual([
      expect.objectContaining({
        label: "SGZ-Altenessen – Coach",
        mode: "staff",
        role: "coach",
      }),
    ]);
  });
});
