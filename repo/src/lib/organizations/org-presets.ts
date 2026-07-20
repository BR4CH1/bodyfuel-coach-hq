// Presets pro Organisationstyp.
//
// Definiert, welche Module standardmäßig aktiv oder deaktiviert sind, wenn
// eine neue Organisation angelegt wird. Nach der Erstellung sind alle Toggle
// weiterhin frei über das Cockpit anpassbar — die Presets sind nur ein
// sinnvoller Startpunkt.
//
// Der Wizard "Neue Organisation erstellen" liest hieraus die Vorschläge und
// lässt sie individuell überschreiben, bevor die Organisation erstellt wird.

import { ORG_MODULES, type OrgModuleKey } from "./modules";
import { normalizeOrgType } from "./org-type";

export type ModulePresetState = "on" | "off" | "optional";

/**
 * Preset pro Organisationstyp.
 * - `on`: Standardmäßig aktiv, wird beim Anlegen mit enabled=true gespeichert.
 * - `off`: Standardmäßig aus, wird NICHT als Feature-Row erzeugt.
 * - `optional`: Standardmäßig aus, wird im Wizard aber als Empfehlung markiert.
 */
export type OrgTypePreset = Partial<Record<OrgModuleKey, ModulePresetState>>;

export const ORG_TYPE_MODULE_PRESETS: Record<string, OrgTypePreset> = {
  sports_club: {
    nutrition: "on",
    training: "on",
    checkins: "on",
    tasks: "on",
    coach_chat: "on",
    body_metrics: "on",
    progress_tracking: "on",
    performance: "on",
    injury_management: "on",
    challenges: "on",
    ranking: "on",
    community: "on",
    gamification: "on",
    teams: "on",
    analytics: "on",
    // optional
    positions: "optional",
    matchdays: "optional",
    smart_nutrition: "optional",
    smart_training: "optional",
    strength_tests: "optional",
    regeneration: "optional",
    training_calendar: "optional",
    load_management: "optional",
    recipes: "optional",
    shopping_list: "optional",
    profile_photos: "optional",
    documents: "optional",
    onboarding: "optional",
  },
  solo_coach: {
    nutrition: "on",
    training: "on",
    smart_nutrition: "on",
    smart_training: "on",
    checkins: "on",
    tasks: "on",
    coach_chat: "on",
    body_metrics: "on",
    progress_tracking: "on",
    recipes: "on",
    shopping_list: "on",
    onboarding: "on",
    documents: "on",
    profile_photos: "on",
    analytics: "on",
    // optional
    challenges: "optional",
    ranking: "optional",
    community: "optional",
    gamification: "optional",
    performance: "optional",
    strength_tests: "optional",
    injury_management: "optional",
    regeneration: "optional",
    // off (Mannschaftssport-Features)
    teams: "off",
    positions: "off",
    matchdays: "off",
  },
  coaching_company: {
    nutrition: "on",
    training: "on",
    smart_nutrition: "on",
    smart_training: "on",
    checkins: "on",
    tasks: "on",
    coach_chat: "on",
    body_metrics: "on",
    progress_tracking: "on",
    recipes: "on",
    shopping_list: "on",
    onboarding: "on",
    documents: "on",
    profile_photos: "on",
    analytics: "on",
    community: "optional",
    challenges: "optional",
    ranking: "optional",
    gamification: "optional",
    performance: "optional",
    strength_tests: "optional",
    injury_management: "optional",
    regeneration: "optional",
    teams: "off",
    positions: "off",
    matchdays: "off",
  },
  fitness_studio: {
    nutrition: "on",
    smart_nutrition: "on",
    checkins: "on",
    body_metrics: "on",
    progress_tracking: "on",
    challenges: "on",
    ranking: "on",
    community: "on",
    gamification: "on",
    analytics: "on",
    profile_photos: "on",
    // optional
    training: "optional",
    smart_training: "optional",
    coach_chat: "optional",
    tasks: "optional",
    recipes: "optional",
    shopping_list: "optional",
    onboarding: "optional",
    documents: "optional",
    strength_tests: "optional",
    regeneration: "optional",
    // off
    teams: "off",
    positions: "off",
    matchdays: "off",
    performance: "off",
    injury_management: "off",
  },
  company: {
    nutrition: "on",
    checkins: "on",
    challenges: "on",
    ranking: "on",
    community: "on",
    body_metrics: "on",
    progress_tracking: "on",
    gamification: "on",
    analytics: "on",
    // optional
    smart_nutrition: "optional",
    tasks: "optional",
    coach_chat: "optional",
    training: "optional",
    onboarding: "optional",
    documents: "optional",
    profile_photos: "optional",
    // off (Sport-spezifisch)
    teams: "off",
    positions: "off",
    matchdays: "off",
    performance: "off",
    strength_tests: "off",
    injury_management: "off",
    regeneration: "off",
    smart_training: "off",
  },
  custom: {
    // Alles standardmäßig aus, der Admin wählt frei.
  },
};

/** Preset für einen Typ (fällt auf "sports_club" zurück). */
export function presetForOrgType(orgType: string | null | undefined): OrgTypePreset {
  const type = normalizeOrgType(orgType);
  return ORG_TYPE_MODULE_PRESETS[type] ?? ORG_TYPE_MODULE_PRESETS.sports_club;
}

/**
 * Liefert die Modul-Keys, die für einen Typ standardmäßig als `enabled=true`
 * in `organization_features` geschrieben werden sollten.
 */
export function defaultEnabledFeatureKeys(orgType: string | null | undefined): string[] {
  const preset = presetForOrgType(orgType);
  const keys: string[] = [];
  for (const mod of ORG_MODULES) {
    const state = preset[mod.key];
    if (state === "on") {
      keys.push(mod.feature);
      for (const alias of mod.aliases ?? []) keys.push(alias);
    }
  }
  return Array.from(new Set(keys));
}

/**
 * Vorschlag-Liste für den Wizard: alle Module mit ihrem Preset-Status
 * für den gewählten Typ.
 */
export function moduleSuggestions(orgType: string | null | undefined) {
  const preset = presetForOrgType(orgType);
  return ORG_MODULES.map((mod) => ({
    module: mod,
    state: (preset[mod.key] ?? "off") as ModulePresetState,
  }));
}

/**
 * Vorschlag für Lizenz-Defaults pro Typ. Nur für den Wizard — die Werte
 * werden anschließend in `organizations` gespeichert und sind editierbar.
 */
export type LicenseDefaults = {
  license_plan: string;
  license_status: string;
  max_customers: number | null;
  max_coaches: number | null;
};

export function defaultLicenseForType(orgType: string | null | undefined): LicenseDefaults {
  const type = normalizeOrgType(orgType);
  switch (type) {
    case "solo_coach":
      return { license_plan: "trial", license_status: "trial", max_customers: 25, max_coaches: 1 };
    case "coaching_company":
      return { license_plan: "trial", license_status: "trial", max_customers: 100, max_coaches: 10 };
    case "fitness_studio":
      return { license_plan: "trial", license_status: "trial", max_customers: 250, max_coaches: 10 };
    case "company":
      return { license_plan: "trial", license_status: "trial", max_customers: 500, max_coaches: 5 };
    case "custom":
      return { license_plan: "custom", license_status: "trial", max_customers: null, max_coaches: null };
    case "sports_club":
    default:
      return { license_plan: "trial", license_status: "trial", max_customers: null, max_coaches: null };
  }
}
