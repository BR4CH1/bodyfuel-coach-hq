/**
 * Player Card Engine — pure, no Supabase.
 *
 * Rechnet aus Testwerten pro Attribut (SPD, ACC, AGI, POW, STR, END) einen
 * 0–99-Score und daraus einen positionsgewichteten BodyFuel Rating (BFR).
 *
 * Sportart-agnostisch: Preset (Gewichtungen + Benchmarks) kommt aus der DB.
 * Football ist das erste Preset.
 */

export type AttributeKey = "SPD" | "ACC" | "AGI" | "POW" | "STR" | "END";
export const ATTRIBUTE_KEYS: AttributeKey[] = ["SPD", "ACC", "AGI", "POW", "STR", "END"];

export type Tier = "bronze" | "silver" | "gold" | "elite" | "legendary";

export type BenchmarkDirection = "higher_is_better" | "lower_is_better" | "ratio_higher_is_better";

export type Anchor = { value: number; score: number };

export type Benchmark = {
  sport: string;
  attribute_key: AttributeKey;
  metric_key: string;
  direction: BenchmarkDirection;
  anchors: Anchor[];
  weight: number;
};

export type PositionWeights = {
  sport: string;
  position_key: string;
  label: string;
  w_spd: number;
  w_acc: number;
  w_agi: number;
  w_pow: number;
  w_str: number;
  w_end: number;
};

/** Rohwert eines Metriktests, evtl. mit bodyweight für Ratio-Berechnung. */
export type MetricInput = {
  metric_key: string;
  value: number;
  bodyweight_kg?: number | null;
  measured_at?: string | null;
};

// ────────────────────────────────────────────────────────────
// Interpolation
// ────────────────────────────────────────────────────────────
export function interpolate(value: number, anchors: Anchor[], direction: BenchmarkDirection): number {
  if (!anchors.length) return 0;
  // Sortiere aufsteigend nach value; klemme dann in die "wie besser wird der Score?"-Richtung.
  const sorted = [...anchors].sort((a, b) => a.value - b.value);
  // Für lower_is_better sind kleinere values höhere Scores.
  if (value <= sorted[0].value) {
    return direction === "lower_is_better" ? sorted[0].score : Math.max(0, (value / sorted[0].value) * sorted[0].score);
  }
  if (value >= sorted[sorted.length - 1].value) {
    return direction === "lower_is_better" ? Math.max(0, sorted[sorted.length - 1].score - 10) : sorted[sorted.length - 1].score;
  }
  for (let i = 0; i < sorted.length - 1; i++) {
    const lo = sorted[i];
    const hi = sorted[i + 1];
    if (value >= lo.value && value <= hi.value) {
      const p = (value - lo.value) / (hi.value - lo.value);
      return lo.score + p * (hi.score - lo.score);
    }
  }
  return 0;
}

const clamp99 = (n: number) => Math.round(Math.min(99, Math.max(0, n)));

// ────────────────────────────────────────────────────────────
// Attribut-Score
// ────────────────────────────────────────────────────────────
export type AttributeDetail = {
  score: number | null; // null → noch nicht getestet
  contributions: Array<{
    metric_key: string;
    value: number;
    normalized_value: number;
    score: number;
    weight: number;
  }>;
  missing_metrics: string[];
};

export function computeAttributeScore(
  attribute: AttributeKey,
  benchmarks: Benchmark[],
  inputs: MetricInput[],
): AttributeDetail {
  const attrBenchmarks = benchmarks.filter((b) => b.attribute_key === attribute);
  const contributions: AttributeDetail["contributions"] = [];
  const missing: string[] = [];

  for (const b of attrBenchmarks) {
    const input = inputs.find((i) => i.metric_key === b.metric_key);
    if (!input) {
      missing.push(b.metric_key);
      continue;
    }
    let normalized = input.value;
    if (b.direction === "ratio_higher_is_better") {
      const bw = input.bodyweight_kg ?? 0;
      if (bw <= 0) {
        missing.push(b.metric_key);
        continue;
      }
      normalized = input.value / bw;
    }
    const score = interpolate(normalized, b.anchors, b.direction);
    contributions.push({
      metric_key: b.metric_key,
      value: input.value,
      normalized_value: normalized,
      score,
      weight: b.weight,
    });
  }

  if (!contributions.length) {
    return { score: null, contributions: [], missing_metrics: missing };
  }

  const totalWeight = contributions.reduce((s, c) => s + c.weight, 0);
  const weightedSum = contributions.reduce((s, c) => s + c.score * c.weight, 0);
  const score = clamp99(weightedSum / totalWeight);
  return { score, contributions, missing_metrics: missing };
}

// ────────────────────────────────────────────────────────────
// BFR
// ────────────────────────────────────────────────────────────
export type CardResult = {
  bfr: number | null;
  isProvisional: boolean;
  tier: Tier | null;
  attributes: Record<AttributeKey, AttributeDetail>;
  strongestAttribute: AttributeKey | null;
  missingTests: string[]; // metric_keys ohne Wert
};

export function computeTier(bfr: number | null): Tier | null {
  if (bfr == null) return null;
  if (bfr >= 90) return "legendary";
  if (bfr >= 80) return "elite";
  if (bfr >= 70) return "gold";
  if (bfr >= 60) return "silver";
  return "bronze";
}

export function computePlayerCard(
  weights: PositionWeights,
  benchmarks: Benchmark[],
  inputs: MetricInput[],
): CardResult {
  const attrs = {} as Record<AttributeKey, AttributeDetail>;
  const missing: string[] = [];

  for (const key of ATTRIBUTE_KEYS) {
    attrs[key] = computeAttributeScore(key, benchmarks, inputs);
    for (const m of attrs[key].missing_metrics) missing.push(m);
  }

  const w: Record<AttributeKey, number> = {
    SPD: weights.w_spd,
    ACC: weights.w_acc,
    AGI: weights.w_agi,
    POW: weights.w_pow,
    STR: weights.w_str,
    END: weights.w_end,
  };

  const usable = ATTRIBUTE_KEYS.filter((k) => attrs[k].score != null);
  if (!usable.length) {
    return {
      bfr: null,
      isProvisional: true,
      tier: null,
      attributes: attrs,
      strongestAttribute: null,
      missingTests: missing,
    };
  }

  const totalW = usable.reduce((s, k) => s + w[k], 0);
  const weightedSum = usable.reduce((s, k) => s + (attrs[k].score as number) * w[k], 0);
  const bfr = clamp99(weightedSum / totalW);

  const strongest = usable.reduce<AttributeKey>(
    (best, k) => ((attrs[k].score as number) > (attrs[best].score as number) ? k : best),
    usable[0],
  );

  return {
    bfr,
    isProvisional: usable.length < ATTRIBUTE_KEYS.length,
    tier: computeTier(bfr),
    attributes: attrs,
    strongestAttribute: strongest,
    missingTests: missing,
  };
}

// e1RM (Epley) — für STR-Ratio, falls User nur weight+reps geliefert hat.
export function epleyE1RM(weight: number, reps: number): number {
  return weight * (1 + reps / 30);
}
