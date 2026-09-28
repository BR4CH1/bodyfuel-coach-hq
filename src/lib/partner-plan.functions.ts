import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertGlobalCoachOrAnyOrgCoach } from "@/lib/organizations/org-coach-access";
import { callGateway, buildMessages } from "@/lib/coach-plan-import.functions";
import {
  normalizePartnerParse,
  scaleMeal,
  syncSharedRecipe,
  portionRatio,
  type PPlan,
  type PIngredient,
  type ParsedPartnerImport,
} from "@/lib/partner-plan-import.logic";

/**
 * Partnerplan (Ernährung): ein Upload / eine Vorlage → zwei getrennte Kundenpläne,
 * verbunden über partner_plan_groups + nutrition_plans.partner_plan_id.
 */

const PARTNER_PROMPT = `Du bist ein Assistent, der einen Ernährungsplan für ZWEI Personen in strukturiertes JSON umwandelt.
Das Dokument enthält Pläne für zwei Personen (z.B. zwei Seitenblöcke, zwei Abschnitte nacheinander,
oder Tabellen mit Spalten pro Person). Trenne die Inhalte strikt nach Person.
Antworte AUSSCHLIESSLICH mit gültigem JSON:
{
  "title": "Plan-Titel",
  "confidence": "high" | "medium" | "low",
  "notes": "kurzer Hinweis, falls die Trennung unklar war, sonst null",
  "persons": [
    {
      "name": "Vollständiger Name wie im Dokument, z.B. Lukas Kiefer",
      "days": [
        {
          "name": "Tag 1",
          "type": "training" | "rest",
          "date": "YYYY-MM-DD oder null",
          "meals": [
            {
              "slot": "breakfast" | "lunch" | "dinner" | "snack",
              "name": "Gerichtname",
              "description": null,
              "shared": true,
              "ingredients": [ { "name": "Haferflocken", "grams": 80 }, { "name": "Milch", "amount": 200, "unit": "ml" } ]
            }
          ]
        }
      ]
    }
  ]
}
Regeln:
- Genau zwei Einträge in "persons", in der Reihenfolge des Dokuments.
- Mengen gehören IMMER zu der Person, bei der sie stehen — niemals Mengen zwischen Personen mischen.
- "shared": true, wenn dasselbe Gericht bei beiden Personen am selben Tag vorkommt.
- Trainingstag/Ruhetag-Varianten als separate Tage mit "type" abbilden.
- Flüssigkeiten ausschließlich "amount" + "unit":"ml", alles andere "grams". Stück, EL, TL, Scheibe sind verboten — in g umrechnen.
- Keine Nährwerte angeben.
- confidence "high" nur, wenn die Zuordnung jeder Mahlzeit zur Person eindeutig ist.
- Keine Erklärungen außerhalb des JSON.`;

export const parsePartnerNutritionPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { mode: "text" | "image" | "pdf"; payload: string; filename?: string }) => {
    if (!d || typeof d.payload !== "string") throw new Error("Ungültige Eingabe");
    if (!["text", "image", "pdf"].includes(d.mode)) throw new Error("Ungültiger Modus");
    return d;
  })
  .handler(async ({ data, context }): Promise<ParsedPartnerImport> => {
    await assertGlobalCoachOrAnyOrgCoach(context);
    if (data.payload.length < 10) throw new Error("Kein Inhalt zum Parsen.");
    const parsed = await callGateway(
      buildMessages(
        PARTNER_PROMPT,
        data.mode,
        data.payload,
        data.filename,
        data.mode === "text"
          ? "Trenne den folgenden Partner-Ernährungsplan nach Person:"
          : "Extrahiere den Partner-Ernährungsplan aus dieser Datei und trenne ihn nach Person.",
      ),
    );
    return normalizePartnerParse(parsed);
  });

/** Kunden, die der Coach einem Partnerplan zuordnen kann. */
export const listPartnerPlanClients = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertGlobalCoachOrAnyOrgCoach(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: roles } = await supabaseAdmin.from("user_roles").select("user_id").eq("role", "client");
    const ids = [...new Set((roles ?? []).map((r: any) => r.user_id as string))];
    if (!ids.length) return [];
    const { data: profs } = await supabaseAdmin.from("profiles").select("id, display_name").in("id", ids);
    return (profs ?? [])
      .map((p: any) => ({ id: p.id as string, name: (p.display_name as string) ?? "Unbenannt" }))
      .sort((a, b) => a.name.localeCompare(b.name, "de"));
  });

function assertPlanShape(p: any): PPlan {
  if (!p || !Array.isArray(p.days)) throw new Error("Ungültiger Plan");
  return p as PPlan;
}

export const savePartnerNutritionPlans = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: {
      client_a: string;
      client_b: string;
      plan_a: PPlan;
      plan_b: PPlan;
      title: string;
      start_date: string;
      source: "pdf_import" | "text_import";
    }) => {
      if (!d?.client_a || !d?.client_b) throw new Error("Bitte beide Kunden zuordnen.");
      if (!/^\d{4}-\d{2}-\d{2}$/.test(d.start_date ?? "")) throw new Error("Ungültiges Startdatum");
      assertPlanShape(d.plan_a);
      assertPlanShape(d.plan_b);
      return { ...d, source: d.source === "text_import" ? "text_import" : "pdf_import" } as typeof d;
    },
  )
  .handler(async ({ data, context }) => {
    await assertGlobalCoachOrAnyOrgCoach(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { createPartnerPlans } = await import("./partner-plan.server");
    return createPartnerPlans(supabaseAdmin, {
      coachId: context.userId,
      clientA: data.client_a,
      clientB: data.client_b,
      planA: data.plan_a,
      planB: data.plan_b,
      title: data.title?.trim() || `Partnerplan — ${new Date().toLocaleDateString("de-DE")}`,
      startDate: data.start_date,
      source: data.source,
    });
  });

/** Liest einen bestehenden Plan als PPlan (für Duplizierung). */
async function loadPlanAsPPlan(admin: any, planId: string): Promise<{ plan: PPlan; row: any }> {
  const { data: row } = await admin
    .from("nutrition_plans")
    .select("id, client_id, title, kcal, plan_type")
    .eq("id", planId)
    .maybeSingle();
  if (!row || row.plan_type !== "nutrition") throw new Error("Quellplan nicht gefunden.");
  const { data: days } = await admin
    .from("nutrition_plan_days")
    .select("id, name, day_type, sort_order")
    .eq("plan_id", planId)
    .order("sort_order");
  const dayIds = (days ?? []).map((d: any) => d.id);
  const { data: meals } = dayIds.length
    ? await admin
        .from("nutrition_plan_meals")
        .select("day_id, name, description, meal_slot, ingredients_json, sort_order")
        .in("day_id", dayIds)
        .order("sort_order")
    : { data: [] };
  const plan: PPlan = {
    title: row.title ?? undefined,
    days: (days ?? []).map((d: any) => ({
      name: d.name,
      type: d.day_type === "training" || d.day_type === "rest" ? d.day_type : undefined,
      meals: (meals ?? [])
        .filter((m: any) => m.day_id === d.id)
        .map((m: any) => ({
          slot: (["breakfast", "lunch", "dinner", "snack"].includes(m.meal_slot) ? m.meal_slot : "snack") as any,
          // Präfix „Tag — Slot: " entfernen → echter Gerichtsname
          name: String(m.name ?? "").replace(/^.*?—\s*[^:]+:\s*/, "") || m.name,
          description: m.description ?? null,
          ingredients: (Array.isArray(m.ingredients_json) ? m.ingredients_json : [])
            .map((i: any) => ({
              name: String(i?.name ?? ""),
              grams: i?.unit === "ml" ? null : (Number(i?.grams ?? i?.amount) || null),
              amount: i?.unit === "ml" ? Number(i?.amount ?? i?.grams) || null : null,
              unit: i?.unit === "ml" ? "ml" : "g",
            }))
            .filter((i: PIngredient) => i.name),
        }))
        .filter((m: any) => m.ingredients.length),
    })).filter((d: any) => d.meals.length),
  };
  return { plan, row };
}

/**
 * „Partnerplan erstellen" ohne PDF: bestehenden Plan von Kunde A als Basis nehmen,
 * für Kunde B mit Portionsfaktor duplizieren. Beide Pläne entstehen neu als Entwurf,
 * der Quellplan bleibt unverändert.
 */
export const duplicateAsPartnerPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: { source_plan_id: string; client_b: string; factor?: number | null; start_date: string; title?: string }) => {
      if (!d?.source_plan_id || !d?.client_b) throw new Error("Quellplan und Partner wählen.");
      if (!/^\d{4}-\d{2}-\d{2}$/.test(d.start_date ?? "")) throw new Error("Ungültiges Startdatum");
      return d;
    },
  )
  .handler(async ({ data, context }) => {
    await assertGlobalCoachOrAnyOrgCoach(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { plan, row } = await loadPlanAsPPlan(supabaseAdmin, data.source_plan_id);
    if (!plan.days.length) throw new Error("Der Quellplan enthält keine Mahlzeiten mit Zutaten.");

    let factor = Number(data.factor);
    if (!Number.isFinite(factor) || factor <= 0) {
      // Faktor aus den kcal-Zielen beider Kunden (falls vorhanden), sonst 1.
      const { data: t } = await supabaseAdmin
        .from("nutrition_targets")
        .select("user_id, kcal")
        .in("user_id", [row.client_id, data.client_b]);
      const ka = (t ?? []).find((x: any) => x.user_id === row.client_id)?.kcal;
      const kb = (t ?? []).find((x: any) => x.user_id === data.client_b)?.kcal;
      factor = ka && kb ? kb / ka : 1;
    }
    factor = Math.min(2.5, Math.max(0.4, factor));

    const planB: PPlan = {
      title: plan.title,
      days: plan.days.map((d) => ({ ...d, meals: d.meals.map((m) => scaleMeal(m, factor)) })),
    };
    const { createPartnerPlans } = await import("./partner-plan.server");
    const res = await createPartnerPlans(supabaseAdmin, {
      coachId: context.userId,
      clientA: row.client_id,
      clientB: data.client_b,
      planA: plan,
      planB,
      title: data.title?.trim() || plan.title || "Partnerplan",
      startDate: data.start_date,
      source: "duplicate",
    });
    return { ...res, factor: Math.round(factor * 100) / 100 };
  });

/** Partner-Info zu einem Plan (Badge + Link). */
export const getPartnerPlanInfo = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { plan_id: string }) => d)
  .handler(async ({ data, context }) => {
    const { data: plan } = await context.supabase
      .from("nutrition_plans")
      .select("id, client_id, partner_plan_id, partner_group_id, is_partner_plan")
      .eq("id", data.plan_id)
      .maybeSingle();
    if (!plan || !(plan as any).partner_plan_id) return null;
    const isOwn = (plan as any).client_id === context.userId;
    if (!isOwn) await assertGlobalCoachOrAnyOrgCoach(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: partner } = await supabaseAdmin
      .from("nutrition_plans")
      .select("id, client_id, title, status")
      .eq("id", (plan as any).partner_plan_id)
      .maybeSingle();
    if (!partner) return null;
    const { data: prof } = await supabaseAdmin
      .from("profiles")
      .select("display_name")
      .eq("id", partner.client_id)
      .maybeSingle();
    return {
      group_id: (plan as any).partner_group_id as string | null,
      partner_plan_id: partner.id as string,
      partner_client_id: partner.client_id as string,
      partner_name: (prof?.display_name as string) ?? "Partner",
      partner_status: partner.status as string | null,
      can_navigate: !isOwn,
    };
  });

/** Partner-IDs für eine Liste von Plänen (für Badges in Listen). */
export const listPartnerBadges = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { plan_ids: string[] }) => ({ plan_ids: (d?.plan_ids ?? []).slice(0, 200) }))
  .handler(async ({ data, context }) => {
    await assertGlobalCoachOrAnyOrgCoach(context);
    if (!data.plan_ids.length) return {} as Record<string, { partner_plan_id: string; partner_name: string }>;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows } = await supabaseAdmin
      .from("nutrition_plans")
      .select("id, partner_plan_id")
      .in("id", data.plan_ids)
      .not("partner_plan_id", "is", null);
    const partnerIds = (rows ?? []).map((r: any) => r.partner_plan_id);
    if (!partnerIds.length) return {};
    const { data: partners } = await supabaseAdmin
      .from("nutrition_plans")
      .select("id, client_id")
      .in("id", partnerIds);
    const clientIds = (partners ?? []).map((p: any) => p.client_id);
    const { data: profs } = await supabaseAdmin.from("profiles").select("id, display_name").in("id", clientIds);
    const out: Record<string, { partner_plan_id: string; partner_name: string }> = {};
    for (const r of rows ?? []) {
      const p = (partners ?? []).find((x: any) => x.id === r.partner_plan_id);
      const name = (profs ?? []).find((x: any) => x.id === p?.client_id)?.display_name ?? "Partner";
      out[r.id] = { partner_plan_id: r.partner_plan_id as string, partner_name: name };
    }
    return out;
  });

/**
 * Optionale Synchronisierung einer gemeinsamen Mahlzeit auf den Partner:
 * Gerichtname, Beschreibung und Zutatenliste werden übernommen; die individuellen
 * Mengen des Partners bleiben erhalten, neue Zutaten werden im Portionsverhältnis
 * skaliert. Nährwerte werden aus den Zutaten neu berechnet.
 */
export const syncPartnerMeal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { meal_id: string }) => d)
  .handler(async ({ data, context }) => {
    await assertGlobalCoachOrAnyOrgCoach(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: src } = await supabaseAdmin
      .from("nutrition_plan_meals")
      .select("id, name, description, ingredients_json, partner_meal_id")
      .eq("id", data.meal_id)
      .maybeSingle();
    if (!src?.partner_meal_id) throw new Error("Diese Mahlzeit ist keine Partner-Mahlzeit.");
    const { data: dst } = await supabaseAdmin
      .from("nutrition_plan_meals")
      .select("id, ingredients_json")
      .eq("id", src.partner_meal_id)
      .maybeSingle();
    if (!dst) throw new Error("Partner-Mahlzeit nicht gefunden.");
    const srcIngs = (Array.isArray(src.ingredients_json) ? src.ingredients_json : []) as any as PIngredient[];
    const dstIngs = (Array.isArray(dst.ingredients_json) ? dst.ingredients_json : []) as any as PIngredient[];
    const next = syncSharedRecipe(srcIngs, dstIngs, portionRatio(srcIngs, dstIngs));
    const { computeMealFromIngredients } = await import("./nutrition-engine.server");
    const { toEngineIngredientAmount } = await import("@/lib/nutrition-ingredient-units");
    const engine = next
      .map((i) => {
        const n = toEngineIngredientAmount(i as any);
        return n ? { name: i.name, ...n } : null;
      })
      .filter(Boolean) as any[];
    const r = await computeMealFromIngredients(supabaseAdmin, engine);
    await supabaseAdmin
      .from("nutrition_plan_meals")
      .update({
        name: src.name,
        description: src.description,
        ingredients_json: next as any,
        kcal: Math.round(r.kcal),
        protein_g: Math.round(r.protein_g),
        carbs_g: Math.round(r.carbs_g),
        fat_g: Math.round(r.fat_g),
        compute_warnings: r.warnings ?? [],
        modification_source: "partner_sync",
      })
      .eq("id", dst.id);
    return { ok: true, partner_meal_id: dst.id };
  });
