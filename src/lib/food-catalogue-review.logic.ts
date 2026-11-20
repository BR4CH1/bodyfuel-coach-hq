import initial from "./data/food-catalogue-audit-2026-11-20.json";
import followup from "./data/food-catalogue-followup-2026-11-20.json";

export const catalogueReviewRows = initial.rows.map((original) => {
  const reviewed = followup.rows.find((row) => row.id === original.id);
  return reviewed ? {
    ...reviewed,
    revision: followup.revision,
    source: reviewed.source ?? "bls_4_0",
    source_record: reviewed.source_record ?? null,
    source_food_name: reviewed.source_food_name ?? null,
    source_url: reviewed.source_url ?? initial.source_url,
    source_name: reviewed.source_name ?? initial.source_name,
    license: reviewed.license ?? initial.license,
  } : {
    ...original,
    revision: initial.audited_on,
    source: "bls_4_0",
    source_record: original.bls_code ?? null,
    source_food_name: original.bls_name ?? null,
    source_url: initial.source_url,
    source_name: initial.source_name,
    license: initial.license,
  };
});

/** Clear stale optional nutrient values rather than mixing different source records. */
export function reviewedNutrientChanges(row: (typeof catalogueReviewRows)[number]) {
  if (row.status !== "source_checked" || !row.nutrients) return null;
  return {
    ...row.nutrients,
    source: row.source,
    source_id: `${row.source_record}:catalog:${row.id}`,
    source_name: row.source_name,
    citation: `${row.source_name}, ${row.source_record}: ${row.source_food_name}; ${row.source_url}`,
    license: row.license,
    source_verified: true,
    source_updated_at: `${initial.audited_on}T00:00:00Z`,
    macro_reference_unit: "g",
    unit_type: row.state === "cooked" ? "cooked" : "raw",
    default_state: row.state,
    density_g_per_ml: null,
    volume_conversion_estimated: false,
    needs_review: false,
    review_reason: null,
  };
}