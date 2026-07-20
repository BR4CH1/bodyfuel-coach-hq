import { describe, expect, it } from "vitest";
import {
  buildChallengePayload,
  createEmptyChallengeDraft,
  normalizeCommunityPostDraft,
  splitChallenges,
  todayAsDateInput,
  validateChallengeDraft,
  validateChallengeRuleDraft,
  validateCommunityPostDraft,
} from "@/features/coach-org-detail/lib/community.logic";
import type { OrgChallenge } from "@/features/coach-org-detail/types";

const now = new Date("2026-07-19T12:00:00.000Z");

const challenge = (
  overrides: Partial<OrgChallenge> & Pick<OrgChallenge, "id" | "name">,
): OrgChallenge => {
  const base: OrgChallenge = {
    id: overrides.id,
    name: overrides.name,
    status: "active",
    starts_at: "2026-07-01T00:00:00.000Z",
    ends_at: "2026-07-31T23:59:59.999Z",
    visibility_scope: "organization",
    team_id: null,
    rule_count: 1,
  };
  return { ...base, ...overrides };
};

describe("community.logic", () => {
  it("erzeugt stabile Datumswerte und ein leeres Challenge-Formular", () => {
    expect(todayAsDateInput(now)).toBe("2026-07-19");
    expect(createEmptyChallengeDraft(now)).toEqual({
      name: "",
      description: "",
      start: "2026-07-19",
      end: "",
      teamId: "",
    });
  });

  it("validiert Challenge-Namen und Datumsbereich", () => {
    expect(
      validateChallengeDraft({
        name: "A",
        description: "",
        start: "2026-07-19",
        end: "",
        teamId: "",
      }),
    ).toContain("mindestens 2 Zeichen");

    expect(
      validateChallengeDraft({
        name: "Sommer-Challenge",
        description: "",
        start: "2026-07-20",
        end: "2026-07-19",
        teamId: "",
      }),
    ).toContain("nicht vor dem Startdatum");
  });

  it("baut den Server-Payload normalisiert auf", () => {
    expect(
      buildChallengePayload(
        {
          name: "  Sommer-Challenge ",
          description: "  Gemeinsam dranbleiben ",
          start: "2026-07-20",
          end: "2026-07-31",
          teamId: "team-a",
        },
        "org-a",
      ),
    ).toEqual({
      organization_id: "org-a",
      name: "Sommer-Challenge",
      description: "Gemeinsam dranbleiben",
      starts_at: "2026-07-20T00:00:00.000Z",
      ends_at: "2026-07-31T23:59:59.999Z",
      team_id: "team-a",
      visibility_scope: "organization",
    });
  });

  it("ordnet geplante Challenges nicht gleichzeitig als aktiv ein", () => {
    const groups = splitChallenges(
      [
        challenge({ id: "active", name: "Aktiv" }),
        challenge({
          id: "planned",
          name: "Geplant",
          starts_at: "2026-08-01T00:00:00.000Z",
          ends_at: "2026-08-31T23:59:59.999Z",
        }),
        challenge({
          id: "past",
          name: "Vergangen",
          ends_at: "2026-07-18T23:59:59.999Z",
        }),
        challenge({ id: "archived", name: "Archiviert", status: "archived" }),
      ],
      now,
    );

    expect(groups.active.map((item) => item.id)).toEqual(["active"]);
    expect(groups.planned.map((item) => item.id)).toEqual(["planned"]);
    expect(groups.past.map((item) => item.id)).toEqual(["past", "archived"]);
  });

  it("validiert Punkte-Regeln", () => {
    expect(
      validateChallengeRuleDraft({
        ruleType: "daily_checkin",
        title: "",
        points: 2,
        frequency: "daily",
      }),
    ).toBeNull();
    expect(
      validateChallengeRuleDraft({
        ruleType: "daily_checkin",
        title: "Check-in",
        points: 0,
        frequency: "daily",
      }),
    ).toContain("größer als 0");
  });

  it("trimmt Community-Beiträge und blockiert leere Inhalte", () => {
    expect(validateCommunityPostDraft({ content: "   ", postType: "general" })).toContain(
      "nicht leer",
    );
    expect(
      normalizeCommunityPostDraft({ content: "  Training fällt aus.  ", postType: "announcement" }),
    ).toEqual({ content: "Training fällt aus.", post_type: "announcement" });
  });
});
