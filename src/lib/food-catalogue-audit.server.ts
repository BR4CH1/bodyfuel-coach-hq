import manifest from "@/lib/data/food-catalogue-audit-2026-11-20.json";

/** Explicit source identity review; never infer a correction from macro arithmetic. */
export async function applyFoodCatalogueAudit(admin: any) {
  const outcomes: { id: string; corrected: boolean; error?: string }[] = [];
  for (let start = 0; start < manifest.rows.length; start += 12) {
    await Promise.all(manifest.rows.slice(start, start + 12).map(async (row) => {
      const { data: current, error: readError } = await admin.from("nutrition_foods")
        .select("*").eq("id", row.id).single();
      if (readError || !current) {
        outcomes.push({ id: row.id, corrected: false, error: readError?.message ?? "Eintrag fehlt" });
        return;
      }
      // Labels always win and are not part of this generic-food correction.
      if (current.barcode || current.brand || current.source === "open_food_facts") {
        outcomes.push({ id: row.id, corrected: false, error: "Produktetikett muss separat geprüft werden" });
        return;
      }
      if (current.raw_data?.bodyfuel_source_audit?.date === manifest.audited_on) {
        outcomes.push({ id: row.id, corrected: row.status === "source_checked" });
        return;
      }
      const raw = current.raw_data && typeof current.raw_data === "object" ? current.raw_data : {};
      const audit = {
        date: manifest.audited_on,
        status: row.status,
        source_url: manifest.source_url,
        bls_code: row.bls_code ?? null,
        bls_name: row.bls_name ?? null,
        previous: current,
      };
      const changes = row.status === "source_checked" && row.nutrients ? {
        ...row.nutrients,
        source: "bls_4_0",
        // Distinct legacy identities retain their IDs and foreign-key references.
        source_id: `${row.bls_code}:catalog:${row.id}`,
        source_name: manifest.source_name,
        citation: `${manifest.source_name}, ${row.bls_code}: ${row.bls_name}; ${manifest.source_url}`,
        license: manifest.license,
        source_verified: true,
        source_updated_at: `${manifest.audited_on}T00:00:00Z`,
        macro_reference_unit: "g",
        unit_type: row.state === "cooked" ? "cooked" : "raw",
        default_state: row.state,
        density_g_per_ml: null,
        volume_conversion_estimated: false,
        needs_review: false,
        review_reason: null,
      } : {
        needs_review: true,
        safe_for_smart: false,
        source_verified: false,
        // Not AUTO-AUDIT: the plausibility trigger must not erase source-review flags.
        review_reason: `[SOURCE-REVIEW ${manifest.audited_on}] ${row.reason}`,
      };
      const { error } = await admin.from("nutrition_foods").update({
        ...changes,
        raw_data: { ...raw, bodyfuel_source_audit: audit },
      }).eq("id", row.id).eq("updated_at", current.updated_at);
      outcomes.push({ id: row.id, corrected: row.status === "source_checked", ...(error ? { error: error.message } : {}) });
    }));
  }
  const errors = outcomes.filter((row) => row.error);
  if (errors.length) throw new Error(`Quellenabgleich unvollständig: ${errors.length} Einträge. ${errors[0]?.error}`);
  return {
    reviewed: outcomes.length,
    corrected: outcomes.filter((row) => row.corrected).length,
    needsSource: outcomes.filter((row) => !row.corrected).length,
  };
}