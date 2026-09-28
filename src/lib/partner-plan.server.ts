import type { PPlan } from "./partner-plan-import.logic";
import { pairSharedMeals } from "./partner-plan-import.logic";
import { toEngineIngredientAmount } from "@/lib/nutrition-ingredient-units";

/**
 * Server-Helfer für Partnerpläne: legt einen normalen Kunden-Ernährungsplan
 * (nutrition_plans + nutrition_plan_days + nutrition_plan_meals) an. Nährwerte
 * werden ausschließlich aus den Zutaten über die Nutrition-Engine berechnet.
 */

const SLOT_LABEL: Record<string, string> = {
  breakfast: "Frühstück",
  lunch: "Mittagessen",
  dinner: "Abendessen",
};

export async function computePlanMeals(admin: any, plan: PPlan) {
  const { computeMealFromIngredients } = await import("./nutrition-engine.server");
  const days = [];
  for (const d of plan.days) {
    const meals = [];
    for (const m of d.meals) {
      const ings = m.ingredients.map((ing) => {
        const n = toEngineIngredientAmount(ing as any);
        if (!n) {
          throw new Error(
            `Ungültige Menge für „${ing.name}" (${d.name}): Flüssigkeiten in ml, alles andere in g.`,
          );
        }
        return { name: ing.name, ...n };
      });
      const r = await computeMealFromIngredients(admin, ings);
      meals.push({
        slot: m.slot,
        name: m.name,
        description: m.description ?? null,
        ingredients: ings,
        kcal: r.kcal,
        protein_g: r.protein_g,
        carbs_g: r.carbs_g,
        fat_g: r.fat_g,
        data_source: r.data_source ?? "db_verified",
        verified_ratio: r.coverage ?? 1,
        warnings: r.warnings ?? [],
      });
    }
    days.push({ name: d.name, type: d.type ?? null, date: d.date ?? null, meals });
  }
  return days;
}

type ComputedDays = Awaited<ReturnType<typeof computePlanMeals>>;

export async function insertClientPlan(
  admin: any,
  opts: {
    clientId: string;
    coachId: string;
    title: string;
    startDate: string;
    days: ComputedDays;
    groupId: string;
  },
): Promise<{ planId: string; mealIds: string[][] }> {
  const { days } = opts;
  if (!days.some((d) => d.meals.length)) throw new Error("Keine Mahlzeiten für diese Person.");
  const start = new Date(opts.startDate + "T00:00:00Z");
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + days.length - 1);
  const sum = days.reduce(
    (a, d) => {
      for (const m of d.meals) {
        a.k += m.kcal;
        a.p += m.protein_g;
        a.c += m.carbs_g;
        a.f += m.fat_g;
      }
      return a;
    },
    { k: 0, p: 0, c: 0, f: 0 },
  );
  const n = Math.max(1, days.length);

  const { data: planRow, error } = await admin
    .from("nutrition_plans")
    .insert({
      client_id: opts.clientId,
      title: opts.title,
      plan_type: "nutrition",
      is_active: false,
      status: "draft",
      source: "manual",
      generated_by: "coach",
      uploaded_by: opts.coachId,
      file_path: `ai-generated/${opts.clientId}/coach-partner-${Date.now()}.json`,
      file_name: "coach-partner-nutrition.json",
      scheduled_start_date: opts.startDate,
      scheduled_end_date: end.toISOString().slice(0, 10),
      weeks_count: Math.max(1, Math.ceil(days.length / 7)),
      kcal: Math.round(sum.k / n / 50) * 50,
      protein_g: Math.round(sum.p / n),
      carbs_g: Math.round(sum.c / n),
      fat_g: Math.round(sum.f / n),
      is_partner_plan: true,
      partner_group_id: opts.groupId,
    })
    .select("id")
    .single();
  if (error || !planRow) throw new Error(error?.message ?? "Plan konnte nicht angelegt werden.");

  const mealIds: string[][] = [];
  for (let i = 0; i < days.length; i++) {
    const d = days[i];
    const dayDate = new Date(start);
    dayDate.setUTCDate(dayDate.getUTCDate() + i);
    const dk = d.meals.reduce(
      (a, m) => ({ k: a.k + m.kcal, p: a.p + m.protein_g, c: a.c + m.carbs_g, f: a.f + m.fat_g }),
      { k: 0, p: 0, c: 0, f: 0 },
    );
    const { data: dayRow, error: dErr } = await admin
      .from("nutrition_plan_days")
      .insert({
        plan_id: planRow.id,
        name: d.name,
        sort_order: i,
        week_number: Math.floor(i / 7) + 1,
        day_type: d.type,
        day_date: dayDate.toISOString().slice(0, 10),
        target_kcal: Math.round(dk.k),
        target_protein_g: Math.round(dk.p),
        target_carbs_g: Math.round(dk.c),
        target_fat_g: Math.round(dk.f),
      })
      .select("id")
      .single();
    if (dErr || !dayRow) throw new Error(dErr?.message ?? "Tag konnte nicht angelegt werden.");
    let snack = 0;
    const rows = d.meals.map((m, idx) => {
      const label = SLOT_LABEL[m.slot] ?? `Snack ${++snack}`;
      return {
        day_id: dayRow.id,
        name: `${d.name} — ${label}: ${m.name}`,
        description: m.description,
        meal_slot: m.slot,
        ingredients_json: m.ingredients.map((ing: any) => ({
          name: ing.name,
          grams: Number(ing.grams ?? 0) || null,
          amount: ing.amount ?? null,
          unit: ing.unit ?? null,
        })),
        compute_warnings: m.warnings,
        kcal: Math.round(m.kcal),
        protein_g: Math.round(m.protein_g),
        carbs_g: Math.round(m.carbs_g),
        fat_g: Math.round(m.fat_g),
        sort_order: idx,
        data_source: m.data_source,
        verified_ratio: m.verified_ratio,
      };
    });
    const { data: inserted, error: mErr } = await admin
      .from("nutrition_plan_meals")
      .insert(rows)
      .select("id, sort_order");
    if (mErr) throw new Error(mErr.message);
    const ids: string[] = [];
    for (const r of inserted ?? []) ids[r.sort_order] = r.id;
    mealIds.push(ids);
  }
  return { planId: planRow.id, mealIds };
}

/**
 * Legt einen vollständigen Partnerplan an: Gruppe + zwei Kundenpläne + Verknüpfung
 * der gemeinsamen Mahlzeiten. Bei Fehlern wird alles Angelegte wieder entfernt.
 */
export async function createPartnerPlans(
  admin: any,
  input: {
    coachId: string;
    clientA: string;
    clientB: string;
    planA: PPlan;
    planB: PPlan;
    title: string;
    startDate: string;
    source: "pdf_import" | "text_import" | "duplicate" | "builder";
  },
) {
  if (input.clientA === input.clientB) throw new Error("Bitte zwei unterschiedliche Kunden wählen.");
  if (!input.planA.days.length || !input.planB.days.length)
    throw new Error("Beide Personen brauchen mindestens einen Tag mit Mahlzeiten.");

  // Erst alles berechnen (kann an Mengen scheitern) — noch nichts gespeichert.
  const daysA = await computePlanMeals(admin, input.planA);
  const daysB = await computePlanMeals(admin, input.planB);

  const { data: names } = await admin
    .from("profiles")
    .select("id, display_name")
    .in("id", [input.clientA, input.clientB]);
  const nameOf = (id: string) =>
    (names ?? []).find((p: any) => p.id === id)?.display_name ?? "Partner";

  const { data: group, error: gErr } = await admin
    .from("partner_plan_groups")
    .insert({
      coach_id: input.coachId,
      client_a_id: input.clientA,
      client_b_id: input.clientB,
      source: input.source,
      title: input.title,
    })
    .select("id")
    .single();
  if (gErr || !group) throw new Error(gErr?.message ?? "Partnerplan konnte nicht angelegt werden.");

  const created: string[] = [];
  try {
    const A = await insertClientPlan(admin, {
      clientId: input.clientA,
      coachId: input.coachId,
      title: `${input.title} · Partnerplan mit ${nameOf(input.clientB)}`,
      startDate: input.startDate,
      days: daysA,
      groupId: group.id,
    });
    created.push(A.planId);
    const B = await insertClientPlan(admin, {
      clientId: input.clientB,
      coachId: input.coachId,
      title: `${input.title} · Partnerplan mit ${nameOf(input.clientA)}`,
      startDate: input.startDate,
      days: daysB,
      groupId: group.id,
    });
    created.push(B.planId);

    await admin.from("nutrition_plans").update({ partner_plan_id: B.planId }).eq("id", A.planId);
    await admin.from("nutrition_plans").update({ partner_plan_id: A.planId }).eq("id", B.planId);
    await admin
      .from("partner_plan_groups")
      .update({ plan_a_id: A.planId, plan_b_id: B.planId })
      .eq("id", group.id);

    const pairs = pairSharedMeals(input.planA, input.planB);
    for (const [d, ia, ib] of pairs) {
      const ma = A.mealIds[d]?.[ia];
      const mb = B.mealIds[d]?.[ib];
      if (!ma || !mb) continue;
      await admin.from("nutrition_plan_meals").update({ partner_meal_id: mb, is_shared: true }).eq("id", ma);
      await admin.from("nutrition_plan_meals").update({ partner_meal_id: ma, is_shared: true }).eq("id", mb);
    }

    return {
      ok: true as const,
      group_id: group.id,
      plan_a_id: A.planId,
      plan_b_id: B.planId,
      shared_meals: pairs.length,
      meals_a: daysA.reduce((s, d) => s + d.meals.length, 0),
      meals_b: daysB.reduce((s, d) => s + d.meals.length, 0),
    };
  } catch (e) {
    if (created.length) await admin.from("nutrition_plans").delete().in("id", created);
    await admin.from("partner_plan_groups").delete().eq("id", group.id);
    throw e;
  }
}
