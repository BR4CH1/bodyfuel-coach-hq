// Zentraler Helper: aus `organization_type` leiten wir Terminologie und
// Feature-Flags ab. Sportverein = klassisches Mannschaftssport-Setup,
// Fitnessstudio = Mitglieder ohne Positionen, Mannschaften optional.

export type OrgType = "sports_club" | "fitness_studio" | (string & {});

export function normalizeOrgType(v: string | null | undefined): OrgType {
  const s = String(v ?? "").toLowerCase().trim();
  if (s === "fitness_studio" || s === "gym" || s === "studio") return "fitness_studio";
  return "sports_club";
}

export function isFitnessStudio(v: string | null | undefined): boolean {
  return normalizeOrgType(v) === "fitness_studio";
}

/** True nur für American Football — steuert Offense/Defense/Special-Teams-UI. */
export function isFootballOrg(sport: string | null | undefined): boolean {
  const s = String(sport ?? "").toLowerCase().trim();
  if (!s) return false;
  return (
    s === "football" ||
    s === "american football" ||
    s === "american_football" ||
    s === "am. football" ||
    s.includes("american")
  );
}

/** Sichtbare Begriffe abhängig vom Organisationstyp. */
export function orgTerminology(orgType: string | null | undefined) {
  const isGym = isFitnessStudio(orgType);
  return {
    isFitnessStudio: isGym,
    // Athlet/Spieler → Mitglied
    player: isGym ? "Mitglied" : "Spieler",
    players: isGym ? "Mitglieder" : "Spieler",
    athlete: isGym ? "Mitglied" : "Athlet",
    athletes: isGym ? "Mitglieder" : "Athleten",
    // Mannschaft → Gruppe
    team: isGym ? "Gruppe" : "Mannschaft",
    teams: isGym ? "Gruppen" : "Mannschaften",
    // Steuert Position/Trikot/Team-Pflicht in Onboarding & UI
    showsPositions: !isGym,
    requiresTeam: !isGym,
  };
}

/** Kurze Label-Erklärung für den Owner-Wizard. */
export const ORG_TYPE_OPTIONS: { value: OrgType; label: string; description: string }[] = [
  {
    value: "sports_club",
    label: "Sportverein",
    description: "Mannschaften, Spielerpositionen, sportartspezifische Logik.",
  },
  {
    value: "fitness_studio",
    label: "Fitnessstudio",
    description: "Mitglieder, optionale Gruppen, keine Positionen.",
  },
];
