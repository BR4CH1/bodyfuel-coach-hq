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
  | "smart_nutrition"
  | "smart_training"
  | "load_management"
  | "gamification"
  | "challenges"
  | "checkins"
  | "performance"
  | "injury_management"
  | "community";

export type OrgModuleDef = {
  key: OrgModuleKey;
  /** DB-Wert in `organization_features.feature`. */
  feature: string;
  label: string;
  description: string;
  /**
   * Weitere DB-Feature-Keys, die dieses Modul in der Anzeige beeinflusst.
   * Beispiel: `smart_training` steuert auch das Legacy-Flag `athletic_training`
   * und das reine `training`-Flag. Beim Toggle werden alle gemeinsam gesetzt.
   */
  aliases?: string[];
};

export const ORG_MODULES: OrgModuleDef[] = [
  {
    key: "smart_nutrition",
    feature: "nutrition",
    label: "Smart Nutrition",
    description:
      "Ernährungsplanung, Tracking und Empfehlungen der zentralen BodyFuel-Engine.",
  },
  {
    key: "smart_training",
    feature: "athletic_training",
    aliases: ["training"],
    label: "Smart Training",
    description:
      "BodyFuel erstellt Trainingspläne, Übungen und Workouts. Für Vereine, die ausschließlich mit Coach-Vorgaben arbeiten, kann dieses Modul deaktiviert bleiben.",
  },
  {
    key: "load_management",
    feature: "load_management",
    label: "Belastungssteuerung",
    description:
      "Coach gibt die sportliche Belastung pro Tag vor. BodyFuel nutzt sie zur Ernährungssteuerung, ohne selbst Training zu erstellen.",
  },
  {
    key: "gamification",
    feature: "gamification",
    label: "Gamification",
    description: "Punkte, Streaks und Level für Athleten.",
  },
  {
    key: "challenges",
    feature: "challenges",
    label: "Challenges",
    description: "Team-, Jahrgangs- und Nutrition-Challenges.",
  },
  {
    key: "checkins",
    feature: "checkins",
    label: "Daily Check-in / Readiness",
    description: "Tagesformular für Schlaf, Belastungsgefühl und Recovery.",
  },
  {
    key: "performance",
    feature: "performance",
    label: "Performance Tests",
    description: "Testbatterien, Benchmarks und Positionsprofile.",
  },
  {
    key: "injury_management",
    feature: "injury_management",
    label: "Injury Management",
    description: "Verletzungsfälle, Return-to-Play und Restriktionen.",
  },
  {
    key: "community",
    feature: "community",
    label: "Community",
    description: "Feed, Posts und interne Kommunikation.",
  },
];

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
  const def = ORG_MODULES.find((m) => m.key === moduleKey);
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
