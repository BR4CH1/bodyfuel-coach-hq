// BodyFuel Tarifsystem
// Aktive Tarife: smart (14,99 €) und coaching (69 € Standardpreis).
// starter / premium bleiben als Legacy-Keys vorhanden, damit bestehende
// Datensätze sauber angezeigt werden können — werden aber in keiner neuen
// Verkaufs-UI mehr angeboten.

export type PackageKey = "smart" | "coaching" | "starter" | "premium";
export type ActivePackageKey = "smart" | "coaching";

export type PackageInfo = {
  key: ActivePackageKey;
  name: string;
  price: number;
  priceId: string;
  tagline: string;
  features: string[];
  popular?: boolean;
};

export const PACKAGES: PackageInfo[] = [
  {
    key: "smart",
    name: "BODYFUEL SMART",
    price: 14.99,
    priceId: "bodyfuel_smart_monthly",
    tagline: "Dein persönlicher Autopilot für Ernährung, Training & Fortschritt",
    features: [
      "Automatischer Ernährungsplan",
      "Automatischer Trainingsplan",
      "Smarte Einkaufsliste",
      "Tracking, Fortschritt & Prognosen",
      "Strength Check",
      "Ranking, Challenges, Punkte & Levelsystem",
      "BodyFuel Autopilot (vollautomatisch)",
    ],
  },
  {
    key: "coaching",
    name: "BODYFUEL COACHING",
    price: 69,
    priceId: "bodyfuel_coaching_monthly",
    tagline: "Persönliche 1:1-Betreuung mit Manu als Coach",
    popular: true,
    features: [
      "Alles aus BodyFuel Smart",
      "Persönliche Betreuung durch Manu",
      "Wöchentliche Check-ins",
      "Individuelle Anpassungen",
      "Plananpassungen jederzeit",
      "WhatsApp Support",
    ],
  },
];

export const PACKAGE_LABEL: Record<PackageKey, string> = {
  smart: "BodyFuel Smart",
  coaching: "BodyFuel Coaching",
  // Legacy — werden weiterhin sauber angezeigt, aber nicht mehr neu vergeben.
  starter: "BodyFuel Coaching",
  premium: "BodyFuel Coaching",
};

export const LEGACY_PACKAGE_KEYS: PackageKey[] = ["starter", "premium"];

export function isLegacyPackage(key: string | null | undefined): boolean {
  return key === "starter" || key === "premium";
}

export function getPackage(key: string | null | undefined): PackageInfo | undefined {
  return PACKAGES.find((p) => p.key === key);
}
