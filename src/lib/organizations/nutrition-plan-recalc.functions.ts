import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Dirty-Recalc für Ernährungspläne bei Belastungsänderungen.
 *
 * Grundprinzipien (siehe Architektur-Vorgabe):
 *  - Vergangene Tage sind unveränderlich.
 *  - `day_closed` Tage sind unveränderlich (falls Feld existiert).
 *  - Bereits getrackte Mahlzeiten (food_entries an dem Tag im gleichen Slot)
 *    werden NIE ersetzt.
 *  - `is_locked` (Coach-Sperre) Mahlzeiten werden NIE ersetzt.
 *  - `nutrition_plan_meal_overrides` (Coach Override) werden NIE ersetzt.
 *  - Nur die verbleibenden offenen Meals dürfen recalcuiert werden.
 *
 * Diese Datei liefert das Skelett + die Klassifizierung. Die eigentliche
 * kcal/Makro-Neuverteilung auf offene Meals bleibt ein bewusst getrennter,
 * eng gescopter nächster Ausbauschritt — wir schreiben aber bereits jetzt
 * eine strukturierte Änderungshistorie, damit spätere Recalc-Schritte
 * nachvollziehbar sind.
 */

export type RecalcReason =
  | "matchday_context"
  | "intensity_increase"
  | "intensity_decrease"
  | "md_minus_1_pre_fuel"
  | "recovery_context"
  | "rest_context"
  | "manual_override";

export type DirtyDayCategory =
  | "skipped_past"
  | "skipped_day_closed"
  | "fully_regenerable"
  | "partial_recalc"
  | "no_plan";

export type DirtyDayReport = {
  user_id: string;
  date: string;
  category: DirtyDayCategory;
  protected_meal_ids: string[];
  open_meal_ids: string[];
};

function isPastDate(iso: string): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(iso + "T00:00:00");
  return target < today;
}

async function resolveAffectedAthletes(
  supabase: SupabaseClient,
  orgId: string,
  teamId: string | null,
): Promise<string[]> {
  if (teamId) {
    const { data } = await supabase
      .from("team_memberships")
      .select("user_id")
      .eq("team_id", teamId)
      .eq("status", "active");
    return ((data ?? []) as Array<{ user_id: string }>).map((r) => r.user_id);
  }
  const { data } = await supabase
    .from("organization_memberships")
    .select("user_id, status")
    .eq("organization_id", orgId)
    .eq("status", "active");
  return ((data ?? []) as Array<{ user_id: string }>).map((r) => r.user_id);
}

/**
 * Klassifiziert für einen (user, date) den Recalc-Bedarf.
 * Schreibt NICHT — nur Analyse. Aufrufer entscheidet über Aktion.
 */
export async function classifyDirtyDay(
  supabase: SupabaseClient,
  params: { userId: string; date: string },
): Promise<DirtyDayReport> {
  const { userId, date } = params;
  if (isPastDate(date)) {
    return { user_id: userId, date, category: "skipped_past", protected_meal_ids: [], open_meal_ids: [] };
  }

  // Aktiven Ernährungsplan des Athleten finden
  const { data: plans } = await supabase
    .from("nutrition_plans")
    .select("id")
    .eq("user_id", userId)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1);
  const planId = ((plans ?? [])[0] as { id?: string } | undefined)?.id;
  if (!planId) {
    return { user_id: userId, date, category: "no_plan", protected_meal_ids: [], open_meal_ids: [] };
  }

  // Plan-Tag für Datum finden
  const { data: dayRows } = await supabase
    .from("nutrition_plan_days")
    .select("id, day_date")
    .eq("plan_id", planId)
    .eq("day_date", date);
  const dayId = ((dayRows ?? [])[0] as { id?: string } | undefined)?.id;
  if (!dayId) {
    // Keine Plan-Zuordnung an dem Datum → nichts zu tun
    return { user_id: userId, date, category: "no_plan", protected_meal_ids: [], open_meal_ids: [] };
  }

  // Meals + Overrides + getrackte Mahlzeiten (food_entries) parallel
  const [mealsRes, overridesRes, entriesRes] = await Promise.all([
    supabase
      .from("nutrition_plan_meals")
      .select("id, name, meal_slot, is_locked")
      .eq("day_id", dayId),
    supabase
      .from("nutrition_plan_meal_overrides")
      .select("plan_meal_id")
      .eq("user_id", userId)
      .eq("override_date", date),
    supabase
      .from("food_entries")
      .select("meal")
      .eq("user_id", userId)
      .eq("entry_date", date),
  ]);

  const meals = (mealsRes.data ?? []) as Array<{
    id: string;
    name: string;
    meal_slot: string | null;
    is_locked: boolean;
  }>;
  const overrideMealIds = new Set(
    ((overridesRes.data ?? []) as Array<{ plan_meal_id: string }>).map((r) => r.plan_meal_id),
  );
  const trackedSlots = new Set(
    ((entriesRes.data ?? []) as Array<{ meal: string }>).map((r) => r.meal),
  );

  const protectedIds: string[] = [];
  const openIds: string[] = [];
  for (const m of meals) {
    const trackedForSlot = m.meal_slot ? trackedSlots.has(m.meal_slot) : false;
    if (m.is_locked || overrideMealIds.has(m.id) || trackedForSlot) {
      protectedIds.push(m.id);
    } else {
      openIds.push(m.id);
    }
  }

  const category: DirtyDayCategory =
    protectedIds.length === 0
      ? "fully_regenerable"
      : openIds.length === 0
        ? "skipped_day_closed" // faktisch alles geschützt → Tag unveränderlich
        : "partial_recalc";

  return { user_id: userId, date, category, protected_meal_ids: protectedIds, open_meal_ids: openIds };
}

async function writeHistory(
  supabase: SupabaseClient,
  args: {
    coachId: string;
    userId: string;
    reason: RecalcReason;
    date: string;
    report: DirtyDayReport;
  },
): Promise<void> {
  const summary =
    args.report.category === "fully_regenerable"
      ? `Belastungsänderung → Ernährungsplan für ${args.date} wird neu berechnet.`
      : args.report.category === "partial_recalc"
        ? `Belastungsänderung → offene Mahlzeiten für ${args.date} werden angepasst (${args.report.protected_meal_ids.length} geschützt).`
        : args.report.category === "skipped_day_closed"
          ? `Belastungsänderung erkannt für ${args.date}, aber alle Mahlzeiten geschützt.`
          : `Belastungsänderung für ${args.date} — keine Aktion (${args.report.category}).`;

  await supabase.from("plan_adjustment_history").insert({
    client_id: args.userId,
    coach_id: args.coachId,
    kind: `load_change:${args.reason}`,
    area: "nutrition",
    summary,
    rationale: `Dirty-Recalc protection-aware. Kategorie: ${args.report.category}.`,
    after_json: {
      date: args.date,
      category: args.report.category,
      open_meal_ids: args.report.open_meal_ids,
      protected_meal_ids: args.report.protected_meal_ids,
    },
  });
}

/**
 * Öffentliche Server Fn — vom Coach-UI oder von Load/Match-Mutations
 * (fire-and-forget) aufrufbar, sobald ein Belastungsereignis Ernährungstage
 * potenziell verändert.
 *
 * WICHTIG: Diese Version schreibt NICHT an Meals. Sie klassifiziert, logged
 * strukturiert und liefert eine Report-Liste zurück. Der eigentliche
 * Meal-Redistribution-Recalc kommt im Folgeschritt und respektiert exakt
 * die hier gelieferten `protected_meal_ids` und `open_meal_ids`.
 */
export const recalcNutritionForDirtyDays = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: {
      orgId: string;
      teamId?: string | null;
      dates: string[];
      reason: RecalcReason;
    }) => data,
  )
  .handler(async ({ data, context }) => {
    const users = await resolveAffectedAthletes(
      context.supabase,
      data.orgId,
      data.teamId ?? null,
    );
    const dates = Array.from(new Set(data.dates)).filter((d) => !isPastDate(d));

    const reports: DirtyDayReport[] = [];
    for (const userId of users) {
      for (const date of dates) {
        const report = await classifyDirtyDay(context.supabase, { userId, date });
        reports.push(report);
        // Nur Aktionen historisieren, bei denen sich real etwas ändern
        // würde — sonst floodet die Historie.
        if (
          report.category === "fully_regenerable" ||
          report.category === "partial_recalc"
        ) {
          await writeHistory(context.supabase, {
            coachId: context.userId,
            userId,
            reason: data.reason,
            date,
            report,
          });
        }
      }
    }
    return { affected_users: users.length, reports };
  });
