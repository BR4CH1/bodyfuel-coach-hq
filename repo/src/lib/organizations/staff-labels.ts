// Zentrale UI-Label-Map für die Staff-/Berechtigungsverwaltung.
// Die internen Role-Keys und Permission-Keys in DB, RLS, Server-Functions
// und Permission-Checks bleiben unverändert. Hier werden ausschließlich
// sichtbare UI-Bezeichnungen, Rollenlabels, Zuständigkeits-Labels und
// Hilfetexte definiert.

export type PermissionKey =
  | "view_members"
  | "manage_members"
  | "view_training"
  | "manage_training"
  | "view_performance"
  | "manage_performance"
  | "view_checkins"
  | "view_nutrition"
  | "manage_challenges"
  | "manage_ranking"
  | "manage_community"
  | "manage_staff"
  | "manage_organization";

export const PERMISSION_LABELS: Record<PermissionKey, { label: string; description: string }> = {
  view_members: {
    label: "Athleten ansehen",
    description:
      "Athleten und Teamzugehörigkeiten im eigenen Zuständigkeitsbereich einsehen.",
  },
  manage_members: {
    label: "Athleten verwalten",
    description:
      "Athleten hinzufügen, Zuordnungen bearbeiten und Mitgliedschaften verwalten.",
  },
  view_training: {
    label: "Trainingsbereich ansehen",
    description: "Teamtraining und zugewiesene Athletikpläne einsehen.",
  },
  manage_training: {
    label: "Training & Athletikpläne verwalten",
    description:
      "Trainingszeiten, Athletikpläne und Trainingszuweisungen bearbeiten.",
  },
  view_performance: {
    label: "Leistungsdaten ansehen",
    description: "Performance Profile, Testergebnisse und Team-Matrix einsehen.",
  },
  manage_performance: {
    label: "Leistungstests & Performance verwalten",
    description:
      "Test-Sessions durchführen, Ergebnisse erfassen, Performance Frameworks und Entwicklungsfokus verwalten.",
  },
  view_checkins: {
    label: "Check-ins & Belastungsstatus ansehen",
    description:
      "Athleten-Check-ins und freigegebene Belastungsinformationen einsehen.",
  },
  view_nutrition: {
    label: "Ernährungsdaten ansehen",
    description: "Freigegebene Ernährungsinformationen der betreuten Athleten einsehen.",
  },
  manage_challenges: {
    label: "Challenges verwalten",
    description: "Team-Challenges erstellen, bearbeiten und auswerten.",
  },
  manage_ranking: {
    label: "Ranglisten verwalten",
    description: "Challenge-Ranglisten und manuelle Punkteaktionen verwalten.",
  },
  manage_community: {
    label: "Community verwalten",
    description: "Beiträge, Ankündigungen und Community-Inhalte verwalten.",
  },
  manage_staff: {
    label: "Trainer & Mitarbeiter verwalten",
    description: "Mitarbeiter hinzufügen, Rollen zuweisen und Berechtigungen verwalten.",
  },
  manage_organization: {
    label: "Verein verwalten",
    description:
      "Vereinseinstellungen, Teams und übergeordnete Organisationseinstellungen verwalten.",
  },
};

export function permissionLabel(key: string): string {
  return PERMISSION_LABELS[key as PermissionKey]?.label ?? key;
}
export function permissionDescription(key: string): string {
  return PERMISSION_LABELS[key as PermissionKey]?.description ?? "";
}

// Preset-Keys entsprechen den STAFF_PRESETS in operating-loop.functions.ts.
// Interne Keys bleiben unverändert; hier nur sichtbare Bezeichnungen.
export type PresetKey =
  | "ORGANIZATION_ADMIN"
  | "TEAM_COACH"
  | "PERFORMANCE_COACH"
  | "NUTRITION_COACH"
  | "COMMUNITY_MANAGER"
  | "CUSTOM";

export const PRESET_LABELS: Record<PresetKey, { label: string; description: string }> = {
  ORGANIZATION_ADMIN: {
    label: "Vereinsleitung / Administrator",
    description:
      "Vollständige Verwaltung des Vereinsbereichs, der Teams und Mitarbeiter.",
  },
  TEAM_COACH: {
    label: "Head Coach / Teamcoach",
    description:
      "Betreuung eines Teams mit Zugriff auf Athleten, Training, Check-ins und freigegebene Leistungsdaten.",
  },
  PERFORMANCE_COACH: {
    label: "Athletik- & Performance Coach",
    description:
      "Verwaltung von Leistungstests, Performance Profilen, Entwicklungsfokus und Athletiktraining.",
  },
  NUTRITION_COACH: {
    label: "Ernährungscoach",
    description: "Zugriff auf freigegebene Ernährungsbereiche der betreuten Athleten.",
  },
  COMMUNITY_MANAGER: {
    label: "Community & Challenges",
    description: "Verwaltung von Community Beiträgen, Challenges und Ranglisten.",
  },
  CUSTOM: {
    label: "Individuelle Rolle",
    description: "Berechtigungen werden vollständig individuell festgelegt.",
  },
};

// Fallback-Label anhand der in staff_assignments.role gespeicherten Werte
// (organization_admin, coach, staff). Reine UI-Anzeige.
export function roleLabelFromDbRole(dbRole: string): string {
  switch (dbRole) {
    case "organization_admin":
      return PRESET_LABELS.ORGANIZATION_ADMIN.label;
    case "coach":
      return PRESET_LABELS.TEAM_COACH.label;
    case "staff":
      return "Trainer / Mitarbeiter";
    default:
      return dbRole;
  }
}

export function scopeLabel(teamName: string | null | undefined): string {
  return teamName ? `Team: ${teamName}` : "Gesamter Verein";
}
