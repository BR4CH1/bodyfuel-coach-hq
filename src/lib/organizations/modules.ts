// Zentraler Modul-Katalog für BodyFuel-Organisationen.
//
// Die Datenbank speichert Modulzustände in `organization_features` als
// (organization_id, feature, enabled). Dieser Katalog ist die Single Source
// of Truth für die im Admin sichtbaren Module und für die Nav-Gates in der
// Athleten- und Coach-Erfahrung.
//
// WICHTIG: `feature`-Keys entsprechen 1:1 den Werten in der DB. Neue Module
// hier einzutragen aktiviert sie NICHT automatisch — sie erscheinen aber als
// Toggle im Organisations-Cockpit ("Module"). Aktiv sind sie erst, wenn eine
// Organisation den Toggle einschaltet oder eine Migration sie vorbelegt.

export type OrgModuleKey =
  // Ernährung
  | "smart_nutrition"
  | "nutrition"
  | "recipes"
  | "shopping_list"
  // Training
  | "smart_training"
  | "training"
  | "training_calendar"
  | "load_management"
  // Betreuung & Kommunikation
  | "checkins"
  | "tasks"
  | "coach_chat"
  | "onboarding"
  | "documents"
  // Körper & Fortschritt
  | "body_metrics"
  | "progress_tracking"
  | "profile_photos"
  // Community / Motivation
  | "community"
  | "gamification"
  | "challenges"
  | "ranking"
  // Sport-spezifisch
  | "performance"
  | "strength_tests"
  | "injury_management"
  | "regeneration"
  | "teams"
  | "positions"
  | "matchdays"
  // Analytics
  | "analytics";


export type OrgModuleCategory =
  | "nutrition"
  | "training"
  | "coaching"
  | "body"
  | "community"
  | "sport"
  | "analytics";

export type OrgModuleDef = {
  key: OrgModuleKey;
  /** DB-Wert in `organization_features.feature`. */
  feature: string;
  label: string;
  description: string;
  category: OrgModuleCategory;
  /**
   * Weitere DB-Feature-Keys, die dieses Modul in der Anzeige beeinflusst.
   * Beispiel: `smart_training` steuert auch das Legacy-Flag `athletic_training`
   * und das reine `training`-Flag. Beim Toggle werden alle gemeinsam gesetzt.
   */
  aliases?: string[];
};

export const ORG_MODULES: OrgModuleDef[] = [
  // ── Ernährung ────────────────────────────────────────────────────────
  {
    key: "nutrition",
    feature: "nutrition",
    label: "Ernährung",
    description: "Ernährungsplanung, Tracking und Empfehlungen der zentralen BodyFuel-Engine.",
    category: "nutrition",
  },
  {
    key: "smart_nutrition",
    feature: "smart_nutrition",
    label: "Smart Ernährungsplanung",
    description: "Automatische, KI-gestützte Ernährungspläne auf Basis von Zielen und Belastung.",
    category: "nutrition",
  },
  {
    key: "recipes",
    feature: "recipes",
    label: "Rezepte",
    description: "Rezeptdatenbank, Favoriten und Coach-Rezepte.",
    category: "nutrition",
  },
  {
    key: "shopping_list",
    feature: "shopping_list",
    label: "Einkaufsliste",
    description: "Automatisch generierte Einkaufsliste aus dem aktuellen Plan.",
    category: "nutrition",
  },

  // ── Training ─────────────────────────────────────────────────────────
  {
    key: "training",
    feature: "athletic_training",
    aliases: ["training"],
    label: "Training",
    description: "Trainingspläne, Übungen und Workouts.",
    category: "training",
  },
  {
    key: "smart_training",
    feature: "smart_training",
    label: "Smart Trainingsplanung",
    description: "Automatische Trainingsplan-Erstellung basierend auf Zielen und Progression.",
    category: "training",
  },
  {
    key: "training_calendar",
    feature: "training_calendar",
    label: "Trainingskalender",
    description: "Wochenkalender mit Sessions, Terminen und Belastungsverteilung.",
    category: "training",
  },
  {
    key: "load_management",
    feature: "load_management",
    label: "Belastungssteuerung",
    description: "Coach gibt die sportliche Belastung pro Tag vor. BodyFuel nutzt sie zur Ernährungssteuerung.",
    category: "training",
  },

  // ── Betreuung & Kommunikation ────────────────────────────────────────
  {
    key: "checkins",
    feature: "checkins",
    label: "Check-ins",
    description: "Tagesformular für Schlaf, Belastungsgefühl und Recovery.",
    category: "coaching",
  },
  {
    key: "tasks",
    feature: "tasks",
    label: "Aufgaben",
    description: "Coach-Aufgaben, To-dos und Kunden-Actions.",
    category: "coaching",
  },
  {
    key: "coach_chat",
    feature: "coach_chat",
    label: "Coach-Chat",
    description: "Direktnachrichten zwischen Coach und Athlet.",
    category: "coaching",
  },
  {
    key: "onboarding",
    feature: "onboarding",
    label: "Onboarding",
    description: "Geführtes Onboarding für neue Kunden oder Athleten.",
    category: "coaching",
  },
  {
    key: "documents",
    feature: "documents",
    label: "Dokumente",
    description: "Dokumente, Verträge und Materialien pro Kunde.",
    category: "coaching",
  },

  // ── Körper & Fortschritt ─────────────────────────────────────────────
  {
    key: "body_metrics",
    feature: "body_metrics",
    label: "Körperdaten",
    description: "Gewicht, Umfänge und Körperkomposition.",
    category: "body",
  },
  {
    key: "progress_tracking",
    feature: "progress_tracking",
    label: "Fortschrittsmessung",
    description: "Zeitverlauf, Vergleichsansichten und Meilensteine.",
    category: "body",
  },
  {
    key: "profile_photos",
    feature: "profile_photos",
    label: "Profilbilder",
    description: "Profilbilder und Fortschritts-Fotos.",
    category: "body",
  },

  // ── Community / Motivation ───────────────────────────────────────────
  {
    key: "community",
    feature: "community",
    label: "Community",
    description: "Feed, Posts und interne Kommunikation.",
    category: "community",
  },
  {
    key: "gamification",
    feature: "gamification",
    label: "Gamification",
    description: "Punkte, Streaks und Level.",
    category: "community",
  },
  {
    key: "challenges",
    feature: "challenges",
    label: "Challenges",
    description: "Team-, Jahrgangs- und Nutrition-Challenges.",
    category: "community",
  },
  {
    key: "ranking",
    feature: "ranking",
    label: "Rangliste",
    description: "Leaderboards und Punkte-Rankings.",
    category: "community",
  },

  // ── Sport-spezifisch ─────────────────────────────────────────────────
  {
    key: "performance",
    feature: "performance",
    label: "Performance Tests",
    description: "Testbatterien, Benchmarks und Positionsprofile.",
    category: "sport",
  },
  {
    key: "strength_tests",
    feature: "strength_tests",
    label: "Strength Tests",
    description: "Kraftdiagnostik und Strength-Check-Zyklen.",
    category: "sport",
  },
  {
    key: "injury_management",
    feature: "injury_management",
    label: "Verletzungsmanagement",
    description: "Verletzungsfälle, Return-to-Play und Restriktionen.",
    category: "sport",
  },
  {
    key: "regeneration",
    feature: "regeneration",
    label: "Regenerationsmanagement",
    description: "Readiness, Recovery-Maßnahmen und Belastungsampel.",
    category: "sport",
  },
  {
    key: "teams",
    feature: "teams",
    label: "Teams",
    description: "Mannschaften, Gruppen oder Abteilungen.",
    category: "sport",
  },
  {
    key: "positions",
    feature: "positions",
    label: "Positionen",
    description: "Positionsprofile für Mannschaftssportarten.",
    category: "sport",
  },
  {
    key: "matchdays",
    feature: "matchdays",
    label: "Spieltage",
    description: "Wettkampftage inklusive Load- und Ernährungsanpassung.",
    category: "sport",
  },

  // ── Analytics ────────────────────────────────────────────────────────
  {
    key: "analytics",
    feature: "analytics",
    label: "Statistiken und Analysen",
    description: "Organisations- und Athleten-Statistiken.",
    category: "analytics",
  },
];




export const ORG_MODULE_BY_KEY: Record<string, OrgModuleDef> = ORG_MODULES.reduce(
  (acc, m) => {
    acc[m.key] = m;
    return acc;
  },
  {} as Record<string, OrgModuleDef>,
);

/** Alle DB-Feature-Keys, die aus dem Katalog gepflegt werden (inkl. Aliase). */
export function moduleFeatureKeys(def: OrgModuleDef): string[] {
  return [def.feature, ...(def.aliases ?? [])];
}

export type OrgFeatureRow = { feature: string; enabled: boolean };

/** Prüft, ob ein Modul-Key laut Feature-Liste aktiv ist. */
export function isModuleEnabled(
  features: OrgFeatureRow[] | null | undefined,
  moduleKey: OrgModuleKey,
): boolean {
  const def = ORG_MODULE_BY_KEY[moduleKey];
  if (!def) return false;
  const keys = moduleFeatureKeys(def);
  return (features ?? []).some((f) => keys.includes(f.feature) && f.enabled);
}

/** Roher Feature-Key-Check (für Nav-Items, die nicht 1:1 einem Modul entsprechen). */
export function isFeatureEnabled(
  features: OrgFeatureRow[] | null | undefined,
  featureKey: string,
): boolean {
  return (features ?? []).some((f) => f.feature === featureKey && f.enabled);
}
