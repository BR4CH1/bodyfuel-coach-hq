/**
 * Player Card Badges — reine Regel-Auswertung.
 *
 * Regeln kommen deklarativ aus `player_card_badge_definitions.rule` (JSONB).
 * Evaluation gegen die aktuelle Karte + History-Snapshots.
 */
import type { AttributeKey } from "./engine";

export type BadgeRule =
  | { type: "has_card" }
  | { type: "bfr_gte"; value: number }
  | { type: "attr_gte"; attribute: AttributeKey; value: number }
  | { type: "all_attrs_gte"; value: number }
  | { type: "bfr_delta_gte"; value: number }
  | { type: "history_count_gte"; value: number };

export type BadgeDefinition = {
  key: string;
  sport: string;
  category: string;
  label: string;
  description: string;
  icon_key: string;
  tier: string;
  rule: BadgeRule;
  sort_order: number;
};

export type BadgeCardInput = {
  bfr: number | null;
  spd: number | null;
  acc: number | null;
  agi: number | null;
  pow: number | null;
  str: number | null;
  end_score: number | null;
};

export type BadgeHistoryPoint = { bfr: number | null; snapshot_at: string };

function attrVal(card: BadgeCardInput, a: AttributeKey): number | null {
  switch (a) {
    case "SPD": return card.spd;
    case "ACC": return card.acc;
    case "AGI": return card.agi;
    case "POW": return card.pow;
    case "STR": return card.str;
    case "END": return card.end_score;
  }
}

export function evaluateBadgeRule(
  rule: BadgeRule,
  card: BadgeCardInput,
  history: BadgeHistoryPoint[],
): boolean {
  switch (rule.type) {
    case "has_card":
      return card.bfr != null;
    case "bfr_gte":
      return card.bfr != null && card.bfr >= rule.value;
    case "attr_gte": {
      const v = attrVal(card, rule.attribute);
      return v != null && v >= rule.value;
    }
    case "all_attrs_gte": {
      const attrs: AttributeKey[] = ["SPD", "ACC", "AGI", "POW", "STR", "END"];
      return attrs.every((a) => {
        const v = attrVal(card, a);
        return v != null && v >= rule.value;
      });
    }
    case "bfr_delta_gte": {
      if (card.bfr == null || history.length === 0) return false;
      const sorted = [...history].sort(
        (a, b) => new Date(a.snapshot_at).getTime() - new Date(b.snapshot_at).getTime(),
      );
      const first = sorted.find((h) => h.bfr != null)?.bfr ?? null;
      if (first == null) return false;
      return card.bfr - first >= rule.value;
    }
    case "history_count_gte":
      return history.length >= rule.value;
  }
}

export function evaluateAllBadges(
  defs: BadgeDefinition[],
  card: BadgeCardInput,
  history: BadgeHistoryPoint[],
): string[] {
  return defs.filter((d) => evaluateBadgeRule(d.rule, card, history)).map((d) => d.key);
}
