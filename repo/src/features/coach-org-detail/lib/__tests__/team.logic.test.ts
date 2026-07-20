import { describe, expect, it } from "vitest";
import {
  getAllowedAthleteUserIds,
  getTeamKpi,
  normalizeTeamDraft,
  validateTeamDraft,
} from "@/features/coach-org-detail/lib/team.logic";

const teams = [
  { id: "team-a", name: "Seniors", sport: "Football", age_group: null },
  { id: "team-b", name: "U19", sport: "Football", age_group: "U19" },
];

const athletes = [
  { user_id: "user-1", team_name: "Seniors" },
  { user_id: "user-2", team_name: "U19" },
  { user_id: "user-3", team_name: null },
];

describe("team.logic", () => {
  it("normalisiert Namen und optionale Altersklasse", () => {
    expect(normalizeTeamDraft({ name: "  U17  ", ageGroup: "  U17 " })).toEqual({
      name: "U17",
      age_group: "U17",
    });
    expect(normalizeTeamDraft({ name: "Seniors", ageGroup: "   " }).age_group).toBeNull();
  });

  it("validiert zu kurze und zu lange Teamnamen", () => {
    expect(validateTeamDraft({ name: "A", ageGroup: "" }, "Team")).toBe("Teamname zu kurz.");
    expect(validateTeamDraft({ name: "A".repeat(81), ageGroup: "" }, "Gruppe")).toBe(
      "Gruppename darf höchstens 80 Zeichen haben.",
    );
    expect(validateTeamDraft({ name: "U19", ageGroup: "" }, "Team")).toBeNull();
  });

  it("liefert die Kennzahlen eines Teams", () => {
    const kpis = [
      { team_id: "team-a", athletes: 20, weekly_compliance: 84, pending_onboardings: 2 },
    ];
    expect(getTeamKpi(kpis, "team-a")?.athletes).toBe(20);
    expect(getTeamKpi(kpis, "missing")).toBeNull();
  });

  it("berechnet den erlaubten Athleten-Scope aus dem aktiven Team", () => {
    expect([...getAllowedAthleteUserIds(athletes, teams, "team-b")!]).toEqual(["user-2"]);
    expect(getAllowedAthleteUserIds(athletes, teams, null)).toBeNull();
    expect(getAllowedAthleteUserIds(athletes, teams, "missing")?.size).toBe(0);
  });
});
