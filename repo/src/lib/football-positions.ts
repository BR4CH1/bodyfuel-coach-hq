/**
 * Football-Positions → Positionsgruppe (Offense / Defense / Special Teams).
 *
 * Zentrale, wiederverwendbare Mapping-Funktion für Athletenliste, Coach-Dashboard
 * und spätere Teamauswertungen. Robust gegen unterschiedliche Schreibweisen
 * (Abkürzung, Vollname, Klein-/Großschreibung, Umlaute).
 */

export type PositionGroup = "offense" | "defense" | "special" | "other";

export const POSITION_GROUP_LABEL: Record<PositionGroup, string> = {
  offense: "Offense",
  defense: "Defense",
  special: "Special Teams",
  other: "Weitere",
};

// Kanonische Kurz-Codes je Gruppe
const OFFENSE = new Set([
  "QB", "RB", "FB", "HB", "TB",
  "WR", "SLOT", "SLOTWR",
  "TE",
  "OL", "C", "G", "T", "LG", "RG", "LT", "RT", "OG", "OT",
]);
const DEFENSE = new Set([
  "DL", "DE", "DT", "NT", "NG",
  "LB", "ILB", "OLB", "MLB", "WLB", "SLB", "ROLB", "LOLB",
  "DB", "CB", "NB", "NICKEL", "DIME",
  "S", "SS", "FS", "SAF",
]);
const SPECIAL = new Set([
  "K", "PK", "P", "LS", "KR", "PR", "H", "HOLDER",
]);

// Vollnamen / typische deutsche & englische Schreibweisen → Kurz-Code
const LONG_TO_SHORT: Array<[RegExp, string]> = [
  [/^quarter[\s-]?back$/i, "QB"],
  [/^running[\s-]?back$/i, "RB"],
  [/^full[\s-]?back$/i, "FB"],
  [/^half[\s-]?back$/i, "HB"],
  [/^tail[\s-]?back$/i, "TB"],
  [/^wide[\s-]?receiver$/i, "WR"],
  [/^slot[\s-]?receiver$/i, "WR"],
  [/^receiver$/i, "WR"],
  [/^tight[\s-]?end$/i, "TE"],
  [/^offensive[\s-]?(line|lineman)$/i, "OL"],
  [/^o[\s-]?line$/i, "OL"],
  [/^center$/i, "C"],
  [/^guard$/i, "G"],
  [/^tackle$/i, "T"],
  [/^left[\s-]?tackle$/i, "LT"],
  [/^right[\s-]?tackle$/i, "RT"],
  [/^left[\s-]?guard$/i, "LG"],
  [/^right[\s-]?guard$/i, "RG"],

  [/^defensive[\s-]?(line|lineman)$/i, "DL"],
  [/^d[\s-]?line$/i, "DL"],
  [/^defensive[\s-]?end$/i, "DE"],
  [/^defensive[\s-]?tackle$/i, "DT"],
  [/^nose[\s-]?(tackle|guard)$/i, "NT"],
  [/^line[\s-]?backer$/i, "LB"],
  [/^inside[\s-]?linebacker$/i, "ILB"],
  [/^outside[\s-]?linebacker$/i, "OLB"],
  [/^middle[\s-]?linebacker$/i, "MLB"],
  [/^weak[\s-]?side[\s-]?linebacker$/i, "WLB"],
  [/^strong[\s-]?side[\s-]?linebacker$/i, "SLB"],
  [/^corner[\s-]?back$/i, "CB"],
  [/^nickel[\s-]?back$/i, "NB"],
  [/^defensive[\s-]?back$/i, "DB"],
  [/^safety$/i, "S"],
  [/^strong[\s-]?safety$/i, "SS"],
  [/^free[\s-]?safety$/i, "FS"],

  [/^kicker$/i, "K"],
  [/^place[\s-]?kicker$/i, "K"],
  [/^punter$/i, "P"],
  [/^long[\s-]?snapper$/i, "LS"],
  [/^kick[\s-]?returner$/i, "KR"],
  [/^punt[\s-]?returner$/i, "PR"],
  [/^holder$/i, "H"],
];

/** Normalisiert einen Positionswert auf einen bekannten Kurz-Code (z. B. „Quarterback" → „QB"). */
export function normalizePosition(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = String(raw).trim();
  if (!trimmed) return null;
  const upper = trimmed.toUpperCase().replace(/\s+/g, "");

  // Bereits ein bekannter Kurz-Code?
  if (OFFENSE.has(upper) || DEFENSE.has(upper) || SPECIAL.has(upper)) return upper;

  // Vollnamen prüfen (Original mit Leerzeichen)
  for (const [re, code] of LONG_TO_SHORT) {
    if (re.test(trimmed)) return code;
  }

  // Rohwert (Großbuchstaben) zurückgeben, damit UI ihn zumindest anzeigen kann
  return upper;
}

/** Liefert die Positionsgruppe für einen beliebigen Positionsstring. */
export function positionGroup(raw: string | null | undefined): PositionGroup {
  const code = normalizePosition(raw);
  if (!code) return "other";
  if (OFFENSE.has(code)) return "offense";
  if (DEFENSE.has(code)) return "defense";
  if (SPECIAL.has(code)) return "special";
  return "other";
}
