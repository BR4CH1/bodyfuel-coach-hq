// Zentraler Helper: aus `organization_type` leiten wir Terminologie und
// Feature-Flags ab. Unterstützt sowohl Vereine als auch Coach-Setups,
// Fitnessstudios und Unternehmen — alles über denselben technischen Stack.

export type OrgType =
  | "sports_club"
  | "solo_coach"
  | "coaching_company"
  | "fitness_studio"
  | "company"
  | "custom"
  | (string & {});

export function normalizeOrgType(v: string | null | undefined): OrgType {
  const s = String(v ?? "").toLowerCase().trim();
  if (s === "fitness_studio" || s === "gym" || s === "studio") return "fitness_studio";
  if (s === "solo_coach" || s === "coach" || s === "personal_coach") return "solo_coach";
  if (s === "coaching_company" || s === "coaching" || s === "coach_company") return "coaching_company";
  if (s === "company" || s === "business" || s === "enterprise" || s === "corporate") return "company";
  if (s === "custom" || s === "other") return "custom";
  return "sports_club";
}

export function isFitnessStudio(v: string | null | undefined): boolean {
  return normalizeOrgType(v) === "fitness_studio";
}

export function isSoloCoach(v: string | null | undefined): boolean {
  return normalizeOrgType(v) === "solo_coach";
}

export function isCoachingCompany(v: string | null | undefined): boolean {
  return normalizeOrgType(v) === "coaching_company";
}

export function isCoachOrg(v: string | null | undefined): boolean {
  const t = normalizeOrgType(v);
  return t === "solo_coach" || t === "coaching_company";
}

export function isCompany(v: string | null | undefined): boolean {
  return normalizeOrgType(v) === "company";
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

export type OrgTerminology = {
  isFitnessStudio: boolean;
  isCoachOrg: boolean;
  isCompany: boolean;
  player: string;
  players: string;
  athlete: string;
  athletes: string;
  team: string;
  teams: string;
  coach: string;
  coaches: string;
  organization: string;
  organizationShort: string;
  showsPositions: boolean;
  requiresTeam: boolean;
};

// Basis-Begriffe je Typ. Werden über `terminology`-Overrides aus der
// Organizations-Zeile bei Bedarf überschrieben (siehe unten).
const DEFAULTS: Record<string, OrgTerminology> = {
  sports_club: {
    isFitnessStudio: false,
    isCoachOrg: false,
    isCompany: false,
    player: "Spieler",
    players: "Spieler",
    athlete: "Athlet",
    athletes: "Athleten",
    team: "Mannschaft",
    teams: "Mannschaften",
    coach: "Coach",
    coaches: "Coaches",
    organization: "Verein",
    organizationShort: "Verein",
    showsPositions: true,
    requiresTeam: true,
  },
  solo_coach: {
    isFitnessStudio: false,
    isCoachOrg: true,
    isCompany: false,
    player: "Kunde",
    players: "Kunden",
    athlete: "Kunde",
    athletes: "Kunden",
    team: "Gruppe",
    teams: "Gruppen",
    coach: "Coach",
    coaches: "Coaches",
    organization: "Coaching",
    organizationShort: "Coaching",
    showsPositions: false,
    requiresTeam: false,
  },
  coaching_company: {
    isFitnessStudio: false,
    isCoachOrg: true,
    isCompany: false,
    player: "Kunde",
    players: "Kunden",
    athlete: "Kunde",
    athletes: "Kunden",
    team: "Gruppe",
    teams: "Gruppen",
    coach: "Coach",
    coaches: "Coaches",
    organization: "Coaching-Unternehmen",
    organizationShort: "Coaching",
    showsPositions: false,
    requiresTeam: false,
  },
  fitness_studio: {
    isFitnessStudio: true,
    isCoachOrg: false,
    isCompany: false,
    player: "Mitglied",
    players: "Mitglieder",
    athlete: "Mitglied",
    athletes: "Mitglieder",
    team: "Gruppe",
    teams: "Gruppen",
    coach: "Trainer",
    coaches: "Trainer",
    organization: "Studio",
    organizationShort: "Studio",
    showsPositions: false,
    requiresTeam: false,
  },
  company: {
    isFitnessStudio: false,
    isCoachOrg: false,
    isCompany: true,
    player: "Mitarbeiter",
    players: "Mitarbeiter",
    athlete: "Mitarbeiter",
    athletes: "Mitarbeiter",
    team: "Abteilung",
    teams: "Abteilungen",
    coach: "Ansprechpartner",
    coaches: "Ansprechpartner",
    organization: "Unternehmen",
    organizationShort: "Unternehmen",
    showsPositions: false,
    requiresTeam: false,
  },
  custom: {
    isFitnessStudio: false,
    isCoachOrg: false,
    isCompany: false,
    player: "Mitglied",
    players: "Mitglieder",
    athlete: "Mitglied",
    athletes: "Mitglieder",
    team: "Gruppe",
    teams: "Gruppen",
    coach: "Betreuer",
    coaches: "Betreuer",
    organization: "Organisation",
    organizationShort: "Organisation",
    showsPositions: false,
    requiresTeam: false,
  },
};

/**
 * Sichtbare Begriffe abhängig vom Organisationstyp.
 *
 * Backward-compatible: `orgTerminology(orgType)` funktioniert wie bisher.
 * Optional kann ein `overrides`-Objekt aus `organizations.terminology`
 * übergeben werden, um einzelne Begriffe pro Org zu überschreiben.
 */
export function orgTerminology(
  orgType: string | null | undefined,
  overrides?: Partial<OrgTerminology> | null,
): OrgTerminology {
  const type = normalizeOrgType(orgType);
  const base = DEFAULTS[type] ?? DEFAULTS.sports_club;
  if (!overrides) return base;
  return { ...base, ...overrides };
}

/** Rohe Default-Terminologie für einen Typ (für Presets / Wizard). */
export function defaultTerminologyForType(orgType: string | null | undefined): OrgTerminology {
  const type = normalizeOrgType(orgType);
  return DEFAULTS[type] ?? DEFAULTS.sports_club;
}

/** Kurze Label-Erklärung für den Owner-Wizard. */
export const ORG_TYPE_OPTIONS: { value: OrgType; label: string; description: string }[] = [
  {
    value: "sports_club",
    label: "Sportverein",
    description: "Mannschaften, Spielerpositionen, sportartspezifische Logik.",
  },
  {
    value: "solo_coach",
    label: "Selbstständiger Coach",
    description: "Ein Coach betreut seine Kunden — keine Teams, keine Positionen.",
  },
  {
    value: "coaching_company",
    label: "Coaching-Unternehmen",
    description: "Mehrere Coaches, Kundenzuweisungen und interne Rollen.",
  },
  {
    value: "fitness_studio",
    label: "Fitnessstudio",
    description: "Mitglieder, optionale Gruppen, keine Positionen.",
  },
  {
    value: "company",
    label: "Unternehmen",
    description: "Gesundheits- und Bewegungsprogramme für Mitarbeitende.",
  },
  {
    value: "custom",
    label: "Eigene Organisation",
    description: "Freie Konfiguration — alle Module und Begriffe individuell wählbar.",
  },
];
