import manifest from "@/lib/data/food-catalogue-audit-2026-11-20.json";
import { catalogueReviewRows, reviewedNutrientChanges } from "./food-catalogue-review.logic";

/** Explicit source identity review; never infer a correction from macro arithmetic. */
export async function applyFoodCatalogueAudit(admin: any) {
  const outcomes: { id: string; corrected: boolean; error?: string }[] = [];
  for (let start = 0; start < catalogueReviewRows.length; start += 12) {
    await Promise.all(catalogueReviewRows.slice(start, start + 12).map(async (row) => {
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
      const previousAudit = current.raw_data?.bodyfuel_source_audit;
      if ((previousAudit?.revision ?? previousAudit?.date) === row.revision) {
        outcomes.push({ id: row.id, corrected: row.status === "source_checked" });
        return;
      }
      const raw = current.raw_data && typeof current.raw_data === "object" ? current.raw_data : {};
      const audit = {
        date: manifest.audited_on,
        revision: row.revision,
        status: row.status,
        source_url: row.source_url,
        source_record: row.source_record,
        source_food_name: row.source_food_name,
        initial_audit: previousAudit ?? null,
        previous: current,
      };
      const changes = reviewedNutrientChanges(row) ?? {
        needs_review: true,
        safe_for_smart: false,
        source_verified: false,
        // Not AUTO-AUDIT: the plausibility trigger must not erase source-review flags.
        review_reason: `[SOURCE-REVIEW ${manifest.audited_on}] ${row.reason}`,
      };
      const { data: written, error } = await admin.from("nutrition_foods").update({
        ...changes,
        raw_data: { ...raw, bodyfuel_source_audit: audit },
      }).eq("id", row.id).eq("updated_at", current.updated_at).select("id");
      const writeError = error?.message ?? (written?.length === 1 ? null : "Eintrag zwischenzeitlich geändert; Quellenabgleich erneut starten");
      outcomes.push({ id: row.id, corrected: row.status === "source_checked", ...(writeError ? { error: writeError } : {}) });
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