/**
 * Helpers to match exercise names across plans, so PRs / history /
 * trend analysis stay continuous when a new plan is generated.
 *
 * "Bankdrücken Langhantel"  ≈  "Bankdrücken LH"  ≈  "bench press barbell"
 */

const SYNONYMS: Record<string, string> = {
  kh: "kurzhantel",
  db: "kurzhantel",
  dumbbell: "kurzhantel",
  lh: "langhantel",
  barbell: "langhantel",
  masch: "maschine",
  machine: "maschine",
  multi: "multipresse",
  smith: "multipresse",
  multipress: "multipresse",
  seilzug: "kabel",
  cable: "kabel",
  einarmig: "einseitig",
  "one-arm": "einseitig",
  oneArm: "einseitig",
  single: "einseitig",
  pulldown: "latzug",
  row: "rudern",
  press: "drucken",
  curl: "curl",
  fly: "flys",
  flyes: "flys",
};

export function normalizeExerciseName(s: string): string {
  let v = String(s ?? "").toLowerCase();
  v = v.replace(/[äöü]/g, (c) => ({ ä: "a", ö: "o", ü: "u" })[c] as string)
       .replace(/ß/g, "ss")
       .replace(/[^a-z0-9 ]+/g, " ")
       .replace(/\s+/g, " ")
       .trim();
  v = v
    .split(" ")
    .map((tok) => SYNONYMS[tok] ?? tok)
    .join(" ");
  return v;
}

/** Token-overlap similarity, 0..1. Common stop-words ignored. */
export function nameSimilarity(a: string, b: string): number {
  const na = normalizeExerciseName(a);
  const nb = normalizeExerciseName(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  if (na.includes(nb) || nb.includes(na)) return 0.85;
  const stop = new Set(["mit", "am", "an", "der", "die", "das", "und", "for", "im", "kg"]);
  const setA = new Set(na.split(" ").filter((t) => t.length > 1 && !stop.has(t)));
  const setB = new Set(nb.split(" ").filter((t) => t.length > 1 && !stop.has(t)));
  if (!setA.size || !setB.size) return 0;
  let inter = 0;
  setA.forEach((t) => { if (setB.has(t)) inter++; });
  return inter / Math.max(setA.size, setB.size);
}

export function namesMatch(a: string, b: string, threshold = 0.6): boolean {
  return nameSimilarity(a, b) >= threshold;
}
