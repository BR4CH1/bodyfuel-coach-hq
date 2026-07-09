import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertCoach(supabase: any, userId: string) {
  const { data: isCoach } = await supabase.rpc("has_role", {
    _user_id: userId,
    _role: "coach",
  });
  if (!isCoach) throw new Error("Forbidden — Coach-Rolle erforderlich");
}

export type CoachAlertSeverity = "red" | "orange";
export type CoachAlertKind = "weight" | "nutrition" | "tracking" | "plan";

export type CoachActionAlert = {
  user_id: string;
  name: string;
  severity: CoachAlertSeverity;
  kind: CoachAlertKind;
  key: string;
  title: string;
  detail: string;
  range: string;
};

export type CoachResolvedAlert = CoachActionAlert & {
  action: "done" | "ignored";
  resolved_at: string;
};

const CUT_GOALS = new Set(["fat_loss", "weight_loss", "aggressive_cut", "cut"]);
const BULK_GOALS = new Set(["lean_bulk", "muscle_gain", "bulk"]);

export const getCoachActionAlerts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(
    async ({
      context,
    }): Promise<{ alerts: CoachActionAlert[]; resolved: CoachResolvedAlert[] }> => {
      const { supabase, userId } = context;
      await assertCoach(supabase, userId);

      const { data: roles } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "client");
      const ids = (roles ?? []).map((r: any) => r.user_id);
      if (!ids.length) return { alerts: [], resolved: [] };

      const today = Date.now();
      const since30Date = new Date(today - 30 * 86400000).toISOString().slice(0, 10);
      const since14Date = new Date(today - 14 * 86400000).toISOString().slice(0, 10);
      const since30Iso = new Date(today - 30 * 86400000).toISOString();
      const since7dIso = new Date(today - 7 * 86400000).toISOString();

      const [profiles, gateEvents, measurements, foods, targets, skips, swaps, activePlans] = await Promise.all([
      supabase
        .from("profiles")
        .select("id, display_name, training_goal, goal_weight_kg, goal_target_date")
        .in("id", ids),
      supabase
        .from("training_progression_events")
        .select("client_id, readiness_gate, evaluated_at")
        .in("client_id", ids)
        .eq("readiness_gate", "reduce")
        .gte("evaluated_at", since7dIso),
      supabase
        .from("body_measurements")
        .select("user_id, weight_kg, measured_at")
        .in("user_id", ids)
        .gte("measured_at", since30Date)
        .order("measured_at", { ascending: false }),
      supabase
        .from("food_entries")
        .select("user_id, entry_date, kcal, protein_g")
        .in("user_id", ids)
        .gte("entry_date", since14Date),
      supabase
        .from("nutrition_targets")
        .select("user_id, kcal, protein_g")
        .in("user_id", ids),
      supabase
        .from("meal_skips")
        .select("user_id, skip_date")
        .in("user_id", ids)
        .gte("skip_date", since14Date),
      supabase
        .from("meal_interactions")
        .select("user_id, kind, created_at")
        .in("user_id", ids)
        .eq("kind", "swapped")
        .gte("created_at", since30Iso),
      supabase
        .from("nutrition_plans")
        .select("client_id, plan_type, status, scheduled_end_date")
        .in("client_id", ids)
        .in("status", ["active", "draft", "approved", "published"]),
    ]);

    const weightsByUser = new Map<string, Array<{ w: number; at: string }>>();
    ((measurements as any).data ?? []).forEach((m: any) => {
      if (m.weight_kg == null) return;
      const arr = weightsByUser.get(m.user_id) ?? [];
      arr.push({ w: Number(m.weight_kg), at: m.measured_at });
      weightsByUser.set(m.user_id, arr);
    });

    const foodsByUser = new Map<string, Map<string, { kcal: number; protein: number }>>();
    ((foods as any).data ?? []).forEach((f: any) => {
      const map = foodsByUser.get(f.user_id) ?? new Map();
      const cur = map.get(f.entry_date) ?? { kcal: 0, protein: 0 };
      cur.kcal += Number(f.kcal ?? 0);
      cur.protein += Number(f.protein_g ?? 0);
      map.set(f.entry_date, cur);
      foodsByUser.set(f.user_id, map);
    });

    const targetByUser = new Map<string, { kcal: number; protein: number }>();
    ((targets as any).data ?? []).forEach((t: any) =>
      targetByUser.set(t.user_id, {
        kcal: Number(t.kcal ?? 0),
        protein: Number(t.protein_g ?? 0),
      }),
    );

    const skipCountByUser = new Map<string, number>();
    ((skips as any).data ?? []).forEach((s: any) =>
      skipCountByUser.set(s.user_id, (skipCountByUser.get(s.user_id) ?? 0) + 1),
    );
    const swapCountByUser = new Map<string, number>();
    ((swaps as any).data ?? []).forEach((s: any) =>
      swapCountByUser.set(s.user_id, (swapCountByUser.get(s.user_id) ?? 0) + 1),
    );

    type PlanState = {
      activeNutrition: boolean;
      activeTraining: boolean;
      pendingNutrition: boolean;
      pendingTraining: boolean;
    };
    const planByUser = new Map<string, PlanState>();
    ((activePlans as any).data ?? []).forEach((p: any) => {
      const s = planByUser.get(p.client_id) ?? {
        activeNutrition: false,
        activeTraining: false,
        pendingNutrition: false,
        pendingTraining: false,
      };
      const isActive = p.status === "active";
      if (p.plan_type === "nutrition") {
        if (isActive) s.activeNutrition = true;
        else s.pendingNutrition = true;
      } else if (p.plan_type === "training") {
        if (isActive) s.activeTraining = true;
        else s.pendingTraining = true;
      }
      planByUser.set(p.client_id, s);
    });

    const alerts: CoachActionAlert[] = [];
    const push = (a: Omit<CoachActionAlert, "key">) =>
      alerts.push({ ...a, key: `${a.user_id}:${a.kind}:${a.title}` });

    for (const p of ((profiles as any).data ?? []) as any[]) {
      const name = p.display_name ?? "Ohne Namen";
      const goal = String(p.training_goal ?? "").toLowerCase();
      const isCut = CUT_GOALS.has(goal);
      const isBulk = BULK_GOALS.has(goal);

      // ----- PLAN -----
      const plan = planByUser.get(p.id) ?? {
        activeNutrition: false,
        activeTraining: false,
        pendingNutrition: false,
        pendingTraining: false,
      };
      if (!plan.activeNutrition) {
        push({
          user_id: p.id,
          name,
          severity: "red",
          kind: "plan",
          title: "Kein aktiver Ernährungsplan",
          detail: plan.pendingNutrition
            ? "Draft/Published vorhanden — Auto-Aktivierung hat nicht gegriffen."
            : "Kein Ernährungsplan vorhanden — Plan erstellen.",
          range: "akt.",
        });
      }
      if (!plan.activeTraining) {
        push({
          user_id: p.id,
          name,
          severity: "red",
          kind: "plan",
          title: "Kein aktiver Trainingsplan",
          detail: plan.pendingTraining
            ? "Draft/Published vorhanden — Auto-Aktivierung hat nicht gegriffen."
            : "Kein Trainingsplan vorhanden — Plan erstellen.",
          range: "akt.",
        });
      }


      // ----- WEIGHT -----
      const series = (weightsByUser.get(p.id) ?? [])
        .slice()
        .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
      const latest = series[0];

      if (!latest) {
        push({
          user_id: p.id,
          name,
          severity: "red",
          kind: "weight",
          title: "Kein Gewichtseintrag",
          detail: "Noch kein Gewicht in den letzten 30 Tagen erfasst.",
          range: "30 T",
        });
      } else {
        const ageDays = Math.floor((today - new Date(latest.at).getTime()) / 86400000);
        if (ageDays >= 7) {
          push({
            user_id: p.id,
            name,
            severity: "red",
            kind: "weight",
            title: `Kein Gewichtseintrag seit ${ageDays} Tagen`,
            detail: `Letzter Eintrag: ${new Date(latest.at).toLocaleDateString("de-DE")}`,
            range: `${ageDays} T`,
          });
        }

        const recent48h = series.filter(
          (m) => (today - new Date(m.at).getTime()) / 86400000 <= 2,
        );
        if (recent48h.length >= 2) {
          const w1 = recent48h[0].w;
          const w2 = recent48h[recent48h.length - 1].w;
          if (Math.abs(w1 - w2) > 2) {
            push({
              user_id: p.id,
              name,
              severity: "red",
              kind: "weight",
              title: "Gewichtssprung > 2 kg",
              detail: `${w2.toFixed(1)} → ${w1.toFixed(1)} kg innerhalb 24–48 h`,
              range: "48 h",
            });
          }
        }

        const ref7 = series.find(
          (m) => (today - new Date(m.at).getTime()) / 86400000 >= 7,
        );
        if (ref7 && ref7.w > 0) {
          const days =
            (new Date(latest.at).getTime() - new Date(ref7.at).getTime()) / 86400000;
          if (days > 0) {
            const pctPerWeek = ((latest.w - ref7.w) / ref7.w) * (7 / days) * 100;
            if (pctPerWeek < -1) {
              push({
                user_id: p.id,
                name,
                severity: "red",
                kind: "weight",
                title: "Gewichtsverlust > 1 %/Woche",
                detail: `${pctPerWeek.toFixed(1)} % / Woche — potenziell zu schnell`,
                range: "7 T",
              });
            }
          }
        }

        const ref14 = series.find(
          (m) => (today - new Date(m.at).getTime()) / 86400000 >= 14,
        );
        if (ref14) {
          const delta = latest.w - ref14.w;
          if (isCut && delta > 0.3) {
            push({
              user_id: p.id,
              name,
              severity: "red",
              kind: "weight",
              title: "Gewicht steigt trotz Abnehmziel",
              detail: `+${delta.toFixed(1)} kg in 14 Tagen`,
              range: "14 T",
            });
          } else if (isCut && Math.abs(delta) <= 0.3) {
            push({
              user_id: p.id,
              name,
              severity: "orange",
              kind: "weight",
              title: "Gewicht stagniert (Cut)",
              detail: `Δ ${delta.toFixed(1)} kg in 14 Tagen`,
              range: "14 T",
            });
          } else if (isCut && delta < -0.3) {
            const lossPerWeek = (-delta / 14) * 7;
            const targetRate = 0.005 * ref14.w;
            if (lossPerWeek < targetRate * 0.5) {
              push({
                user_id: p.id,
                name,
                severity: "orange",
                kind: "weight",
                title: "Abnahme unter Zielpfad",
                detail: `Nur ${lossPerWeek.toFixed(2)} kg/Woche`,
                range: "14 T",
              });
            }
          }
          if (isBulk) {
            const gainPerWeek = (delta / 14) * 7;
            if (gainPerWeek > 0.5) {
              push({
                user_id: p.id,
                name,
                severity: "orange",
                kind: "weight",
                title: "Aufbau zu schnell",
                detail: `+${gainPerWeek.toFixed(2)} kg/Woche`,
                range: "14 T",
              });
            }
          }
        }
      }

      // ----- NUTRITION / TRACKING -----
      const byDate = foodsByUser.get(p.id) ?? new Map();
      const trackedDates = Array.from(byDate.keys()).sort((a, b) => b.localeCompare(a));
      const lastEntryDate = trackedDates[0];
      const lastEntryAge = lastEntryDate
        ? Math.floor((today - new Date(lastEntryDate).getTime()) / 86400000)
        : null;

      if (lastEntryAge === null) {
        push({
          user_id: p.id,
          name,
          severity: "red",
          kind: "tracking",
          title: "Kein Ernährungstracking",
          detail: "Keine Einträge in den letzten 14 Tagen.",
          range: "14 T",
        });
      } else if (lastEntryAge >= 3) {
        push({
          user_id: p.id,
          name,
          severity: "red",
          kind: "tracking",
          title: `Kein Ernährungstracking seit ${lastEntryAge} Tagen`,
          detail: `Letzter Eintrag: ${new Date(lastEntryDate).toLocaleDateString("de-DE")}`,
          range: `${lastEntryAge} T`,
        });
      }

      const target = targetByUser.get(p.id);
      if (target && target.kcal > 0) {
        const last3 = trackedDates.slice(0, 3).map((d) => byDate.get(d)!);
        if (last3.length >= 2) {
          const avgKcal3 = last3.reduce((s, d) => s + d.kcal, 0) / last3.length;
          const avgProt3 = last3.reduce((s, d) => s + d.protein, 0) / last3.length;

          if (avgKcal3 > 0 && avgKcal3 < target.kcal * 0.6) {
            push({
              user_id: p.id,
              name,
              severity: "red",
              kind: "nutrition",
              title: "Kalorienzufuhr kritisch niedrig",
              detail: `Ø ${Math.round(avgKcal3)} kcal — gesundheitlich grenzwertig`,
              range: "3 T",
            });
          } else if (avgKcal3 < target.kcal * 0.8) {
            push({
              user_id: p.id,
              name,
              severity: "red",
              kind: "nutrition",
              title: "Kalorien < 80 % Ziel",
              detail: `Ø ${Math.round(avgKcal3)} kcal vs. Ziel ${target.kcal}`,
              range: "3 T",
            });
          }

          if (target.protein > 0 && avgProt3 < target.protein * 0.75) {
            push({
              user_id: p.id,
              name,
              severity: "red",
              kind: "nutrition",
              title: "Protein < 75 % Ziel",
              detail: `Ø ${Math.round(avgProt3)} g vs. Ziel ${target.protein} g`,
              range: "3 T",
            });
          }
        }

        const last7 = trackedDates.slice(0, 7).map((d) => byDate.get(d)!);
        if (last7.length >= 4) {
          const avgKcal7 = last7.reduce((s, d) => s + d.kcal, 0) / last7.length;
          const avgProt7 = last7.reduce((s, d) => s + d.protein, 0) / last7.length;
          const ratio = avgKcal7 / target.kcal;
          if (ratio > 1.1 && ratio <= 1.25) {
            push({
              user_id: p.id,
              name,
              severity: "orange",
              kind: "nutrition",
              title: "Kalorien 10–25 % über Ziel",
              detail: `Ø ${Math.round(avgKcal7)} kcal vs. ${target.kcal}`,
              range: "7 T",
            });
          } else if (ratio < 0.9 && ratio >= 0.8) {
            push({
              user_id: p.id,
              name,
              severity: "orange",
              kind: "nutrition",
              title: "Kalorien 10–20 % unter Ziel",
              detail: `Ø ${Math.round(avgKcal7)} kcal vs. ${target.kcal}`,
              range: "7 T",
            });
          }
          if (
            target.protein > 0 &&
            avgProt7 < target.protein * 0.85 &&
            avgProt7 >= target.protein * 0.75
          ) {
            push({
              user_id: p.id,
              name,
              severity: "orange",
              kind: "nutrition",
              title: "Protein < 85 % Ziel",
              detail: `Ø ${Math.round(avgProt7)} g vs. ${target.protein} g`,
              range: "7 T",
            });
          }
        }
      }

      const skipCount = skipCountByUser.get(p.id) ?? 0;
      if (skipCount >= 7) {
        push({
          user_id: p.id,
          name,
          severity: "orange",
          kind: "nutrition",
          title: "Viele Mahlzeiten übersprungen",
          detail: `${skipCount} Skips in 14 Tagen`,
          range: "14 T",
        });
      }
      const swapCount = swapCountByUser.get(p.id) ?? 0;
      if (swapCount >= 10) {
        push({
          user_id: p.id,
          name,
          severity: "orange",
          kind: "nutrition",
          title: "Viele Mahlzeiten getauscht",
          detail: `${swapCount} Tausche in 30 Tagen — Plan passt evtl. nicht`,
          range: "30 T",
        });
      }
    }

    const order = { red: 0, orange: 1 } as const;
    alerts.sort(
      (a, b) =>
        order[a.severity] - order[b.severity] || a.name.localeCompare(b.name),
    );

    const { data: resolvedRows } = await supabase
      .from("coach_alert_resolutions")
      .select("*")
      .eq("coach_user_id", userId)
      .gte("resolved_at", since7dIso)
      .order("resolved_at", { ascending: false });

    const resolvedKeys = new Set((resolvedRows ?? []).map((r: any) => r.alert_key));
    const filtered = alerts.filter((a) => !resolvedKeys.has(a.key));

    const resolved: CoachResolvedAlert[] = (resolvedRows ?? []).map((r: any) => ({
      user_id: r.alert_user_id,
      name: r.client_name ?? "Ohne Namen",
      severity: r.alert_severity as CoachAlertSeverity,
      kind: r.alert_kind as CoachAlertKind,
      key: r.alert_key,
      title: r.alert_title,
      detail: r.alert_detail ?? "",
      range: r.alert_range ?? "",
      action: r.action,
      resolved_at: r.resolved_at,
    }));

    return { alerts: filtered, resolved };
  });

export const resolveCoachAlert = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      alert: CoachActionAlert;
      action: "done" | "ignored";
    }) => input,
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertCoach(supabase, userId);
    const a = data.alert;
    const { error } = await supabase
      .from("coach_alert_resolutions")
      .upsert(
        {
          coach_user_id: userId,
          alert_key: a.key,
          alert_user_id: a.user_id,
          alert_kind: a.kind,
          alert_severity: a.severity,
          alert_title: a.title,
          alert_detail: a.detail,
          alert_range: a.range,
          client_name: a.name,
          action: data.action,
          resolved_at: new Date().toISOString(),
        },
        { onConflict: "coach_user_id,alert_key" },
      );
    if (error) throw error;
    return { ok: true };
  });

export const unresolveCoachAlert = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { alert_key: string }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertCoach(supabase, userId);
    const { error } = await supabase
      .from("coach_alert_resolutions")
      .delete()
      .eq("coach_user_id", userId)
      .eq("alert_key", data.alert_key);
    if (error) throw error;
    return { ok: true };
  });

