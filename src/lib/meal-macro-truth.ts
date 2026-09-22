// ============================================================
// BodyFuel — Makro-Wahrheit einer Mahlzeit
// ============================================================
// Harte Regel: Die gespeicherten Zutaten (Menge + Basiseinheit) sind die
// EINZIGE Quelle für kcal/Protein/KH/Fett einer Mahlzeit oder eines Rezepts.
// Gespeicherte Summen sind immer nur ein abgeleiteter Cache und werden beim
// Laden/Speichern gegen die Zutaten geprüft und notfalls reparariert.
//
// Dieses Modul ist absichtlich frei von Supabase- und React-Abhängigkeiten,
// damit es überall (Server-Funktionen, Builder, Tracker, Tests) gilt.
// ============================================================

export type MacroTotals = {
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
};

export type TruthIngredient = {
  name: string;
  /** Kanonische Anzeige-Menge in `unit`. */
  amount?: number | null;
  unit?: "g" | "ml" | null;
  /** Legacy-Masse; gilt nur, wenn `amount` fehlt. */
  grams?: number | null;
  amount_g?: number | null;
  display?: string | null;
  kcal?: number | null;
  protein_g?: number | null;
  carbs_g?: number | null;
  fat_g?: number | null;
};

const EMPTY: MacroTotals = { kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0 };

function num(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function positive(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

/** Akzeptiert Komma-Dezimalzahlen ("12,5") aus Eingabefeldern. */
export function parseDecimalAmount(value: string | number | null | undefined): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (value == null) return null;
  const parsed = Number.parseFloat(String(value).trim().replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Stabile Basismenge einer Zutat. Jede Portionsänderung MUSS von dieser Basis
 * ausgehen, niemals von einem bereits gerundeten Zwischenwert.
 */
export function ingredientBaseAmount(ingredient: TruthIngredient): {
  amount: number;
  unit: "g" | "ml";
  scalable: boolean;
} {
  const unit: "g" | "ml" = ingredient.unit === "ml" ? "ml" : "g";
  const explicit = positive(ingredient.amount);
  if (explicit) return { amount: explicit, unit, scalable: true };
  const legacy = positive(ingredient.grams) ?? positive(ingredient.amount_g);
  if (legacy) return { amount: legacy, unit: "g", scalable: true };
  return { amount: 0, unit, scalable: false };
}

/** Rundet erst bei der Darstellung — intern wird voll präzise gerechnet. */
export function roundMacros(totals: MacroTotals): MacroTotals {
  return {
    kcal: Math.round(totals.kcal),
    protein_g: Math.round(totals.protein_g * 10) / 10,
    carbs_g: Math.round(totals.carbs_g * 10) / 10,
    fat_g: Math.round(totals.fat_g * 10) / 10,
  };
}

/**
 * Summiert die Mahlzeit aus den Zutaten — mit voller Präzision und nur einer
 * finalen Rundung, damit keine Zwischenrundungen aufaddiert werden.
 */
export function sumIngredientTotals(ingredients: readonly TruthIngredient[]): MacroTotals {
  const raw = ingredients.reduce<MacroTotals>(
    (acc, ing) => ({
      kcal: acc.kcal + num(ing.kcal),
      protein_g: acc.protein_g + num(ing.protein_g),
      carbs_g: acc.carbs_g + num(ing.carbs_g),
      fat_g: acc.fat_g + num(ing.fat_g),
    }),
    EMPTY,
  );
  return roundMacros(raw);
}

/**
 * Skaliert eine Zutat auf eine neue Zielmenge — immer relativ zur unveränderten
 * Basismenge. Einheitensicher: die Basiseinheit bleibt erhalten, Roh-/
 * Trockengewichte werden NICHT in gekochte Werte umgerechnet.
 */
export function scaleIngredientToAmount<T extends TruthIngredient>(
  base: T,
  nextAmount: number | string,
): T {
  const info = ingredientBaseAmount(base);
  const amount = parseDecimalAmount(nextAmount);
  if (!info.scalable || amount == null || amount <= 0) return base;
  const factor = amount / info.amount;
  const legacy = positive(base.grams) ?? positive(base.amount_g);
  return {
    ...base,
    amount: Math.round(amount * 100) / 100,
    unit: info.unit,
    ...(base.grams != null ? { grams: Math.round(num(base.grams) * factor * 100) / 100 } : {}),
    ...(base.amount_g != null || legacy == null
      ? { amount_g: base.amount_g == null ? base.amount_g : Math.round(num(base.amount_g) * factor * 100) / 100 }
      : {}),
    kcal: base.kcal == null ? base.kcal : num(base.kcal) * factor,
    protein_g: base.protein_g == null ? base.protein_g : num(base.protein_g) * factor,
    carbs_g: base.carbs_g == null ? base.carbs_g : num(base.carbs_g) * factor,
    fat_g: base.fat_g == null ? base.fat_g : num(base.fat_g) * factor,
  } as T;
}

/** Skaliert eine ganze Zutatenliste (Portionsfaktor) von der Basis aus. */
export function scaleIngredientsByFactor<T extends TruthIngredient>(
  base: readonly T[],
  factor: number,
): T[] {
  const safe = Number.isFinite(factor) && factor > 0 ? factor : 1;
  return base.map((ingredient) => {
    const info = ingredientBaseAmount(ingredient);
    if (!info.scalable) return { ...ingredient };
    return scaleIngredientToAmount(ingredient, info.amount * safe);
  });
}

export type MacroReconciliation = {
  macros: MacroTotals;
  corrected: boolean;
  /** Menschlich lesbare Abweichung für dezente Hinweise im Builder. */
  note: string | null;
};

const KCAL_TOLERANCE_ABS = 15;
const KCAL_TOLERANCE_REL = 0.03;
const MACRO_TOLERANCE_ABS = 2;

function inTolerance(stored: number | null | undefined, computed: number, isKcal: boolean): boolean {
  if (stored == null) return false;
  const diff = Math.abs(num(stored) - computed);
  if (isKcal) return diff <= Math.max(KCAL_TOLERANCE_ABS, computed * KCAL_TOLERANCE_REL);
  return diff <= MACRO_TOLERANCE_ABS;
}

/**
 * Harte Konsistenzprüfung: liegen gespeicherte Summen außerhalb der
 * Rundungstoleranz, gelten die aus den Zutaten berechneten Werte.
 */
export function reconcileMealMacros(input: {
  stored: Partial<MacroTotals> | null | undefined;
  computed: MacroTotals;
}): MacroReconciliation {
  const computed = roundMacros(input.computed);
  const stored = input.stored ?? null;
  const consistent =
    inTolerance(stored?.kcal, computed.kcal, true) &&
    inTolerance(stored?.protein_g, computed.protein_g, false) &&
    inTolerance(stored?.carbs_g, computed.carbs_g, false) &&
    inTolerance(stored?.fat_g, computed.fat_g, false);

  if (consistent) return { macros: computed, corrected: false, note: null };

  const note =
    stored?.kcal != null
      ? `Nährwerte automatisch aus den Zutaten berechnet (vorher ${Math.round(num(stored.kcal))} kcal, jetzt ${computed.kcal} kcal).`
      : "Nährwerte automatisch aus den Zutaten berechnet.";
  return { macros: computed, corrected: true, note };
}

/** Formatiert eine gespeicherte Zutat als Rezeptzeile: „Hähnchenbrust: 300 g“. */
export function formatIngredientLine(ingredient: TruthIngredient): string {
  const name = String(ingredient.name ?? "").trim() || "Zutat";
  const info = ingredientBaseAmount(ingredient);
  if (!info.scalable) return name;
  return `${name}: ${formatAmount(info.amount)} ${info.unit}`;
}

export function formatAmount(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : String(rounded).replace(".", ",");
}

function ingredientKey(ingredient: TruthIngredient): string {
  return String(ingredient.name ?? "")
    .toLowerCase()
    .replace(/\(.*?\)/g, " ")
    .replace(/[^a-zäöüß0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Partner-Rezept: die Mengen beider Personen kommen aus DEREN eigenen
 * gespeicherten Zutaten. Die Gesamtmenge wird erst daraus aggregiert.
 */
export function formatPartnerIngredientLines(input: {
  selfName: string;
  otherName: string;
  selfIngredients: readonly TruthIngredient[];
  otherIngredients: readonly TruthIngredient[];
}): string[] {
  const otherByKey = new Map(input.otherIngredients.map((ing) => [ingredientKey(ing), ing]));
  const lines: string[] = [];
  for (const selfIng of input.selfIngredients) {
    const selfInfo = ingredientBaseAmount(selfIng);
    const name = String(selfIng.name ?? "").trim();
    if (!name || !selfInfo.scalable) continue;
    const otherIng = otherByKey.get(ingredientKey(selfIng));
    const otherInfo = otherIng ? ingredientBaseAmount(otherIng) : null;
    if (!otherInfo?.scalable || otherInfo.unit !== selfInfo.unit) {
      lines.push(
        `${name}: ${formatAmount(selfInfo.amount)} ${selfInfo.unit} für ${input.selfName}`,
      );
      continue;
    }
    lines.push(
      `${name}: ${formatAmount(selfInfo.amount)} ${selfInfo.unit} für ${input.selfName}, ${formatAmount(otherInfo.amount)} ${otherInfo.unit} für ${input.otherName} — insgesamt ${formatAmount(selfInfo.amount + otherInfo.amount)} ${selfInfo.unit}`,
    );
  }
  return lines;
}

/** Einkaufsmengen werden erst aus den finalen Personenportionen aggregiert. */
export function aggregateIngredientAmounts(
  lists: ReadonlyArray<readonly TruthIngredient[]>,
): Array<{ name: string; amount: number; unit: "g" | "ml" }> {
  const out = new Map<string, { name: string; amount: number; unit: "g" | "ml" }>();
  for (const list of lists) {
    for (const ingredient of list) {
      const info = ingredientBaseAmount(ingredient);
      const name = String(ingredient.name ?? "").trim();
      if (!name || !info.scalable) continue;
      const key = `${ingredientKey(ingredient)}|${info.unit}`;
      const existing = out.get(key);
      if (existing) existing.amount += info.amount;
      else out.set(key, { name, amount: info.amount, unit: info.unit });
    }
  }
  return [...out.values()].map((row) => ({
    ...row,
    amount: Math.round(row.amount * 10) / 10,
  }));
}
