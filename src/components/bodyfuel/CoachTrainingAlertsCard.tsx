import { useEffect, useState } from "react";
import { AlertTriangle, TrendingDown, CalendarClock, Scale, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type Alert = {
  level: "warn" | "info" | "danger";
  icon: "stagnation" | "missed" | "balance" | "expired";
  title: string;
  detail: string;
};

const ICONS = {
  stagnation: TrendingDown,
  missed: CalendarClock,
  balance: Scale,
  expired: AlertTriangle,
} as const;

/**
 * Surfaces stagnation, dysbalance, expired plans and adherence drops
 * directly to the coach in the customer detail view.
 */
export function CoachTrainingAlertsCard({ userId }: { userId: string }) {
  const [alerts, setAlerts] = useState<Alert[] | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const out: Alert[] = [];

      // 1) Active plan + expiry
      const { data: plan } = await supabase
        .from("nutrition_plans")
        .select("id, title, scheduled_start_date, scheduled_end_date, weeks_count")
        .eq("client_id", userId)
        .eq("plan_type", "training")
        .eq("is_active", true)
        .maybeSingle();

      const today = new Date().toISOString().slice(0, 10);
      if (plan?.scheduled_end_date && plan.scheduled_end_date < today) {
        out.push({
          level: "danger",
          icon: "expired",
          title: "Trainingsplan abgelaufen",
          detail: `Der aktuelle Plan endete am ${new Date(plan.scheduled_end_date).toLocaleDateString("de-DE")}. Es wird automatisch ein neuer Plan generiert.`,
        });
      } else if (plan?.scheduled_end_date) {
        const daysLeft = Math.ceil((new Date(plan.scheduled_end_date).getTime() - Date.now()) / 86400000);
        if (daysLeft <= 7) {
          out.push({
            level: "info",
            icon: "expired",
            title: `Plan endet in ${daysLeft} Tagen`,
            detail: "Bereite die nächste 4-Wochen-Phase vor.",
          });
        }
      }

      // 2) Stagnation per Übung: kein PR in den letzten 3 Sessions
      if (plan?.id) {
        const { data: days } = await supabase
          .from("training_days").select("id").eq("plan_id", plan.id);
        const dayIds = (days ?? []).map((d) => d.id);
        if (dayIds.length) {
          const { data: exs } = await supabase
            .from("training_exercises").select("id, name").in("day_id", dayIds);
          const exIds = (exs ?? []).map((e) => e.id);
          if (exIds.length) {
            const since = new Date(Date.now() - 60 * 86400000).toISOString();
            const { data: logs } = await supabase
              .from("training_set_logs")
              .select("exercise_id, weight_kg, performed_at")
              .in("exercise_id", exIds)
              .eq("client_id", userId)
              .gte("performed_at", since)
              .order("performed_at", { ascending: false })
              .limit(1000);

            const byEx = new Map<string, { date: string; max: number }[]>();
            for (const l of logs ?? []) {
              const d = String(l.performed_at).slice(0, 10);
              const arr = byEx.get(l.exercise_id) ?? [];
              const hit = arr.find((x) => x.date === d);
              const w = Number(l.weight_kg ?? 0);
              if (hit) hit.max = Math.max(hit.max, w);
              else arr.push({ date: d, max: w });
              byEx.set(l.exercise_id, arr);
            }

            const stagnating: string[] = [];
            for (const ex of exs ?? []) {
              const sessions = (byEx.get(ex.id) ?? []).slice(0, 3);
              if (sessions.length >= 3) {
                const maxLast = Math.max(...sessions.map((s) => s.max));
                const maxPrev = sessions[sessions.length - 1].max;
                if (maxLast <= maxPrev && maxLast > 0) stagnating.push(ex.name);
              }
            }
            const unique = Array.from(new Set(stagnating)).slice(0, 4);
            if (unique.length) {
              out.push({
                level: "warn",
                icon: "stagnation",
                title: `Stagnation bei ${unique.length} Übung${unique.length > 1 ? "en" : ""}`,
                detail: unique.join(" · ") + " — Gewicht/Wdh seit 3 Sessions nicht gesteigert.",
              });
            }
          }
        }
      }

      // 3) Dysbalance aus letztem Strength Check
      const { data: check } = await supabase
        .from("strength_checks")
        .select("score_lower, score_push, score_pull, score_core, performed_at")
        .eq("user_id", userId).eq("status", "completed")
        .order("performed_at", { ascending: false }).limit(1).maybeSingle();

      if (check) {
        const scores = {
          Unterkörper: check.score_lower ?? 0,
          Push: check.score_push ?? 0,
          Pull: check.score_pull ?? 0,
          Core: check.score_core ?? 0,
        };
        const values = Object.values(scores).filter((v) => v > 0);
        if (values.length >= 2) {
          const max = Math.max(...values);
          const min = Math.min(...values);
          if (max - min >= 25) {
            const weakest = Object.entries(scores).filter(([, v]) => v === min).map(([k]) => k);
            out.push({
              level: "warn",
              icon: "balance",
              title: "Dysbalance erkannt",
              detail: `Schwächste Region: ${weakest.join(", ")} (${min}/100 vs. ${max}/100). Im Plan stärker priorisieren.`,
            });
          }
        }
      }

      // 4) Adhärenz: Sessions in den letzten 14 Tagen
      const since14 = new Date(Date.now() - 14 * 86400000).toISOString();
      const { data: recent } = await supabase
        .from("training_set_logs")
        .select("performed_at")
        .eq("client_id", userId)
        .gte("performed_at", since14)
        .order("performed_at", { ascending: false });
      const sessions14 = new Set((recent ?? []).map((r) => String(r.performed_at).slice(0, 10))).size;
      if (sessions14 < 2) {
        out.push({
          level: "warn",
          icon: "missed",
          title: "Wenig Trainings-Adhärenz",
          detail: `Nur ${sessions14} Trainingssession${sessions14 === 1 ? "" : "s"} in den letzten 14 Tagen.`,
        });
      }

      if (!cancelled) setAlerts(out);
    })();

    return () => { cancelled = true; };
  }, [userId]);

  if (alerts === null) {
    return (
      <div className="rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground">
        Analysiere Trainingsdaten…
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-6 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg font-bold">Training-Insights</h2>
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
          Smart-Analyse
        </span>
      </div>

      {alerts.length === 0 ? (
        <div className="flex items-center gap-2 rounded-xl border border-border/60 bg-background/40 p-3 text-sm text-muted-foreground">
          <CheckCircle2 className="h-4 w-4 text-gold" />
          Alles im grünen Bereich — keine Auffälligkeiten.
        </div>
      ) : (
        alerts.map((a, i) => {
          const Icon = ICONS[a.icon];
          const tone =
            a.level === "danger"
              ? "border-destructive/40 bg-destructive/5 text-destructive"
              : a.level === "warn"
                ? "border-warning/40 bg-warning/10 text-warning"
                : "border-primary/30 bg-primary/5 text-primary";
          return (
            <div key={i} className={`flex items-start gap-3 rounded-xl border p-3 ${tone}`}>
              <Icon className="mt-0.5 h-4 w-4 shrink-0" />
              <div className="min-w-0">
                <div className="text-sm font-semibold">{a.title}</div>
                <div className="text-xs opacity-90">{a.detail}</div>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
