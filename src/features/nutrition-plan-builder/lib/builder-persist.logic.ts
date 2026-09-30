// Reine Hilfsfunktionen für den Save/Load-Round-trip des Plan-Builders.
// Regel: Was der Builder für eine Mahlzeit anzeigt (mealMacros), wird exakt so
// gespeichert. Die Nährwert-Engine dient nur als Fallback, wenn der Builder
// selbst keine Werte kennt.

export type PersistMacros = { kcal: number; protein_g: number; carbs_g: number; fat_g: number };
type Builderish = { kcal: number; p: number; c: number; f: number };

export function resolvePersistedMealMacros(
  builder: Builderish,
  engine: Partial<PersistMacros> | null | undefined,
): PersistMacros & { source: "builder" | "engine" } {
  const hasBuilder = [builder.kcal, builder.p, builder.c, builder.f].some(
    (v) => Number.isFinite(v) && v > 0,
  );
  if (hasBuilder) {
    return {
      kcal: Math.round(builder.kcal),
      protein_g: Math.round(builder.p),
      carbs_g: Math.round(builder.c),
      fat_g: Math.round(builder.f),
      source: "builder",
    };
  }
  return {
    kcal: Math.round(Number(engine?.kcal ?? 0) || 0),
    protein_g: Math.round(Number(engine?.protein_g ?? 0) || 0),
    carbs_g: Math.round(Number(engine?.carbs_g ?? 0) || 0),
    fat_g: Math.round(Number(engine?.fat_g ?? 0) || 0),
    source: "engine",
  };
}

/** Plan-Durchschnitt pro Tag — kcal NICHT auf 50 gerundet, damit sie zu den Makros passen. */
export function averagePlanTotals(days: PersistMacros[][]): PersistMacros {
  const count = Math.max(1, days.length);
  const sum = days.flat().reduce(
    (acc, m) => ({
      kcal: acc.kcal + m.kcal,
      protein_g: acc.protein_g + m.protein_g,
      carbs_g: acc.carbs_g + m.carbs_g,
      fat_g: acc.fat_g + m.fat_g,
    }),
    { kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0 },
  );
  return {
    kcal: Math.round(sum.kcal / count),
    protein_g: Math.round(sum.protein_g / count),
    carbs_g: Math.round(sum.carbs_g / count),
    fat_g: Math.round(sum.fat_g / count),
  };
}

export type StoredCustomTargets = {
  kcal: number | null;
  p: number | null;
  c: number | null;
  f: number | null;
};

/** Gespeicherte Tagesziele laden — fehlende Einzelwerte bleiben null (nicht 0). */
export function loadCustomTargets(row: {
  target_kcal?: number | null;
  target_protein_g?: number | null;
  target_carbs_g?: number | null;
  target_fat_g?: number | null;
}): StoredCustomTargets | null {
  const n = (v: unknown) => (v == null || !Number.isFinite(Number(v)) ? null : Number(v));
  const t = {
    kcal: n(row.target_kcal),
    p: n(row.target_protein_g),
    c: n(row.target_carbs_g),
    f: n(row.target_fat_g),
  };
  return t.kcal == null && t.p == null && t.c == null && t.f == null ? null : t;
}

/** Tagesziele speichern — null bleibt null. */
export function customTargetsToRow(t: Partial<StoredCustomTargets> | null | undefined) {
  const r = (v: unknown) => (v == null || !Number.isFinite(Number(v)) ? null : Math.round(Number(v)));
  return {
    target_kcal: t ? r(t.kcal) : null,
    target_protein_g: t ? r(t.p) : null,
    target_carbs_g: t ? r(t.c) : null,
    target_fat_g: t ? r(t.f) : null,
  };
}

/** Warnung, wenn geplante Summe sinnvoll vom Tagesziel abweicht (≥ 50 kcal und ≥ 5 %). */
export function targetDeviation(totalKcal: number, targetKcal: number) {
  const diff = Math.round(totalKcal - targetKcal);
  const significant =
    targetKcal > 0 && Math.abs(diff) >= 50 && Math.abs(diff) >= targetKcal * 0.05;
  return {
    diff,
    significant,
    message: significant
      ? `${diff > 0 ? "+" : ""}${diff} kcal ${diff > 0 ? "über" : "unter"} dem Tagesziel`
      : null,
  };
}
