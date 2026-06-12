export type PackageKey = "starter" | "coaching" | "premium";

export type PackageInfo = {
  key: PackageKey;
  name: string;
  price: number;
  tagline: string;
  features: string[];
  popular?: boolean;
};

export const PACKAGES: PackageInfo[] = [
  {
    key: "starter",
    name: "BODYFUEL STARTER",
    price: 79,
    tagline: "Dein Einstieg mit Plan & System",
    features: [
      "Individueller Ernährungsplan",
      "BodyFuel Dashboard Zugang",
      "Punkte- & Level-System",
      "1 Check-in pro Monat",
      "Fortschrittstracking",
    ],
  },
  {
    key: "coaching",
    name: "BODYFUEL COACHING",
    price: 129,
    tagline: "Die beliebteste Wahl für echte Ergebnisse",
    popular: true,
    features: [
      "Individueller Ernährungsplan",
      "Wöchentliche Check-ins",
      "Anpassungen bei Bedarf",
      "BodyFuel Dashboard Zugang",
      "Punkte- & Level-System",
      "Fortschrittsfotos & Gewichtstracking",
      "WhatsApp Support",
    ],
  },
  {
    key: "premium",
    name: "BODYFUEL PREMIUM",
    price: 199,
    tagline: "Maximale Betreuung & persönliche Strategie",
    features: [
      "Alles aus Coaching",
      "Engere Betreuung",
      "Individuelle Trainingsplanung",
      "Priorisierter Support",
      "Regelmäßige Anpassungen",
      "Persönliche Strategiegespräche",
    ],
  },
];

export const PACKAGE_LABEL: Record<PackageKey, string> = {
  starter: "BodyFuel Starter",
  coaching: "BodyFuel Coaching",
  premium: "BodyFuel Premium",
};

export function getPackage(key: string | null | undefined): PackageInfo | undefined {
  return PACKAGES.find((p) => p.key === key);
}
