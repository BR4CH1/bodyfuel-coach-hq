/**
 * Partnerplan-Import — reine Logik (ohne Server/DB), testbar.
 * Ein Upload → zwei getrennte Kundenpläne. Diese Datei:
 *  - normalisiert die KI-Antwort (zwei Personen, Tage, Mahlzeiten),
 *  - flacht sie zu einer korrigierbaren Review-Liste ab,
 *  - entscheidet, ob die Trennung sicher genug ist,
 *  - schlägt Kunden anhand erkannter Namen vor,
 *  - baut aus der (korrigierten) Review-Liste zwei Pläne,
 *  - findet gemeinsame Mahlzeiten (gleicher Tag + Slot + Gericht).
 */

export type PSlot = "breakfast" | "lunch" | "dinner" | "snack";

export type PIngredient = {
  name: string;
  grams?: number | null;
  amount?: number | null;
  unit?: "g" | "ml" | null;
};
export type PMeal = {
  slot: PSlot;
  name: string;
  description?: string | null;
  ingredients: PIngredient[];
  shared?: boolean;
};
export type PDay = {
  name: string;
  type?: "training" | "rest";
  date?: string | null;
  meals: PMeal[];
};
export type PPlan = { title?: string; days: PDay[] };

export type Confidence = "high" | "medium" | "low";

export type ParsedPartnerImport = {
  title?: string;
  persons: { name: string; days: PDay[] }[];
  confidence: Confidence;
  notes: string | null;
};

export type ReviewItem = {
  id: string;
  person: 0 | 1;
  dayIndex: number;
  dayName: string;
  dayType?: "training" | "rest";
  date?: string | null;
  meal: PMeal;
};

const SLOTS = new Set(["breakfast", "lunch", "dinner", "snack"]);

function num(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(typeof v === "string" ? v.replace(",", ".") : v);
  return Number.isFinite(n) ? n : null;
}

function normMeal(m: any): PMeal | null {
  const name = String(m?.name ?? "").trim().slice(0, 200);
  if (!name) return null;
  const slotRaw = String(m?.slot ?? "snack").toLowerCase();
  const ings = (Array.isArray(m?.ingredients) ? m.ingredients : [])
    .map((i: any) => ({
      name: String(i?.name ?? "").trim().slice(0, 120),
      grams: num(i?.grams),
      amount: num(i?.amount),
      unit: i?.unit === "ml" ? ("ml" as const) : i?.unit === "g" ? ("g" as const) : null,
    }))
    .filter((i: PIngredient) => i.name);
  return {
    slot: (SLOTS.has(slotRaw) ? slotRaw : "snack") as PSlot,
    name,
    description: m?.description ? String(m.description).slice(0, 500) : null,
    ingredients: ings,
    shared: m?.shared === true,
  };
}

function normDays(days: any): PDay[] {
  return (Array.isArray(days) ? days : [])
    .map((d: any, i: number) => ({
      name: String(d?.name ?? `Tag ${i + 1}`).slice(0, 80),
      type: d?.type === "training" || d?.type === "rest" ? d.type : undefined,
      date: typeof d?.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d.date) ? d.date : null,
      meals: (Array.isArray(d?.meals) ? d.meals : [])
        .map(normMeal)
        .filter((m: PMeal | null): m is PMeal => !!m),
    }))
    .filter((d: PDay) => d.meals.length);
}

export function normalizePartnerParse(raw: any): ParsedPartnerImport {
  const persons = (Array.isArray(raw?.persons) ? raw.persons : [])
    .map((p: any, i: number) => ({
      name: String(p?.name ?? `Person ${i + 1}`).trim().slice(0, 120) || `Person ${i + 1}`,
      days: normDays(p?.days),
    }))
    .slice(0, 2);
  const c = String(raw?.confidence ?? "low").toLowerCase();
  return {
    title: raw?.title ? String(raw.title).slice(0, 160) : undefined,
    persons,
    confidence: c === "high" || c === "medium" ? c : "low",
    notes: raw?.notes ? String(raw.notes).slice(0, 500) : null,
  };
}

/** Grund(e), warum die Trennung NICHT automatisch sicher ist. Leer = sicher. */
export function separationIssues(p: ParsedPartnerImport): string[] {
  const issues: string[] = [];
  if (p.persons.length !== 2) issues.push(`Es wurden ${p.persons.length} statt 2 Personen erkannt.`);
  p.persons.forEach((x, i) => {
    if (!x.days.length) issues.push(`Für ${x.name || `Person ${i + 1}`} wurden keine Mahlzeiten erkannt.`);
  });
  if (p.persons.length === 2 && normalizeName(p.persons[0].name) === normalizeName(p.persons[1].name))
    issues.push("Beide Personen haben denselben erkannten Namen.");
  if (p.confidence !== "high") issues.push("Die KI ist sich bei der Trennung nicht sicher.");
  return issues;
}

export function toReviewItems(p: ParsedPartnerImport): ReviewItem[] {
  const out: ReviewItem[] = [];
  p.persons.forEach((person, pi) => {
    person.days.forEach((d, di) => {
      d.meals.forEach((m, mi) => {
        out.push({
          id: `${pi}-${di}-${mi}`,
          person: (pi === 1 ? 1 : 0) as 0 | 1,
          dayIndex: di,
          dayName: d.name,
          dayType: d.type,
          date: d.date ?? null,
          meal: m,
        });
      });
    });
  });
  return out;
}

const SLOT_ORDER: Record<PSlot, number> = { breakfast: 0, lunch: 1, dinner: 2, snack: 3 };

/** Baut aus der Review-Liste den Plan einer Person (Tage nach dayIndex sortiert). */
export function buildPersonPlan(items: ReviewItem[], person: 0 | 1, title?: string): PPlan {
  const byDay = new Map<number, PDay>();
  for (const it of items.filter((x) => x.person === person)) {
    let d = byDay.get(it.dayIndex);
    if (!d) {
      d = { name: it.dayName, type: it.dayType, date: it.date ?? null, meals: [] };
      byDay.set(it.dayIndex, d);
    }
    d.meals.push(it.meal);
  }
  const days = [...byDay.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([, d]) => ({
      ...d,
      meals: [...d.meals].sort((a, b) => SLOT_ORDER[a.slot] - SLOT_ORDER[b.slot]),
    }));
  return { title, days };
}

export function normalizeName(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ß/g, "ss")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Schlägt einen Kunden für einen erkannten Namen vor.
 * Nur eindeutige Treffer (voller Name oder eindeutiger Vorname) — sonst null.
 */
export function suggestClient(
  detected: string,
  clients: { id: string; name: string }[],
  excludeId?: string | null,
): string | null {
  const n = normalizeName(detected);
  if (!n || /^person \d$/.test(n)) return null;
  const pool = clients.filter((c) => c.id !== excludeId);
  const full = pool.filter((c) => normalizeName(c.name) === n);
  if (full.length === 1) return full[0].id;
  if (full.length > 1) return null;
  const tokens = n.split(" ");
  const contains = pool.filter((c) => {
    const cn = normalizeName(c.name);
    return tokens.every((t) => cn.split(" ").includes(t));
  });
  if (contains.length === 1) return contains[0].id;
  const first = tokens[0];
  const byFirst = pool.filter((c) => normalizeName(c.name).split(" ")[0] === first);
  return byFirst.length === 1 && tokens.length === 1 ? byFirst[0].id : null;
}

export function mealKey(m: { slot: string; name: string }): string {
  return `${m.slot}::${normalizeName(m.name)}`;
}

/**
 * Paart gemeinsame Mahlzeiten: gleicher Tag (Index) + gleicher Slot + gleiches Gericht.
 * Rückgabe: Liste [dayIndex, mealIndexA, mealIndexB].
 */
export function pairSharedMeals(a: PPlan, b: PPlan): Array<[number, number, number]> {
  const pairs: Array<[number, number, number]> = [];
  const n = Math.min(a.days.length, b.days.length);
  for (let d = 0; d < n; d++) {
    const used = new Set<number>();
    a.days[d].meals.forEach((ma, ia) => {
      const k = mealKey(ma);
      const ib = b.days[d].meals.findIndex((mb, j) => !used.has(j) && mealKey(mb) === k);
      if (ib >= 0) {
        used.add(ib);
        pairs.push([d, ia, ib]);
      }
    });
  }
  return pairs;
}

/** Skaliert eine Mahlzeit für die Partner-Duplizierung; Mengen auf 1 g/ml gerundet. */
export function scaleMeal(m: PMeal, factor: number): PMeal {
  const f = Number.isFinite(factor) && factor > 0 ? factor : 1;
  const r = (v: number | null | undefined) => (v == null ? v : Math.max(1, Math.round(v * f)));
  return {
    ...m,
    ingredients: m.ingredients.map((i) => ({ ...i, grams: r(i.grams), amount: r(i.amount) })),
  };
}

/**
 * Synchronisiert das Rezept einer gemeinsamen Mahlzeit auf den Partner,
 * individuelle Mengen bleiben: gleichnamige Zutaten behalten die Partner-Menge,
 * neue Zutaten werden mit dem Portionsverhältnis skaliert.
 */
export function syncSharedRecipe(
  source: PIngredient[],
  partner: PIngredient[],
  ratio: number,
): PIngredient[] {
  const f = Number.isFinite(ratio) && ratio > 0 ? ratio : 1;
  const byName = new Map(partner.map((p) => [normalizeName(p.name), p]));
  return source.map((s) => {
    const own = byName.get(normalizeName(s.name));
    if (own) return { ...s, grams: own.grams ?? null, amount: own.amount ?? null, unit: own.unit ?? s.unit ?? null };
    const r = (v: number | null | undefined) => (v == null ? v : Math.max(1, Math.round(v * f)));
    return { ...s, grams: r(s.grams), amount: r(s.amount) };
  });
}

function grams(i: PIngredient): number {
  return Number(i.grams ?? i.amount ?? 0) || 0;
}

/** Verhältnis Partner-Menge / Quelle-Menge über gleichnamige Zutaten (Fallback 1). */
export function portionRatio(source: PIngredient[], partner: PIngredient[]): number {
  const byName = new Map(partner.map((p) => [normalizeName(p.name), grams(p)]));
  let s = 0;
  let p = 0;
  for (const i of source) {
    const pg = byName.get(normalizeName(i.name));
    if (pg && grams(i)) {
      s += grams(i);
      p += pg;
    }
  }
  return s > 0 && p > 0 ? p / s : 1;
}
