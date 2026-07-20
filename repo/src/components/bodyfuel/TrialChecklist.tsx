import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Check, Circle, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type StepKey = "checkin" | "weight" | "nutrition" | "training" | "plan";

const STEPS: { key: StepKey; title: string; desc: string; to: string; points: number }[] = [
  { key: "checkin", title: "Tagescheck abhaken", desc: "Eiweiß, Wasser, Schlaf – starte mit deinen Gewohnheiten.", to: "/daily-checklist", points: 5 },
  { key: "weight", title: "Erstes Gewicht eintragen", desc: "Damit dein Coach deinen Fortschritt sehen kann.", to: "/measurements", points: 5 },
  { key: "nutrition", title: "Erste Mahlzeit tracken", desc: "Barcode-Scanner oder manuell – los geht's.", to: "/nutrition/tracking", points: 5 },
  { key: "training", title: "Erstes Training loggen", desc: "Sätze & Wiederholungen festhalten.", to: "/training", points: 5 },
  { key: "plan", title: "Starterplan ansehen", desc: "Ernährungs- & Trainingsplan für deinen Start.", to: "/nutrition", points: 5 },
];

export function TrialChecklist({ userId }: { userId: string }) {
  const [done, setDone] = useState<Record<StepKey, boolean>>({
    checkin: false, weight: false, nutrition: false, training: false, plan: false,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const today = new Date().toISOString().slice(0, 10);
      const [{ count: checkCount }, { count: weightCount }, { count: foodCount }, { count: setCount }] = await Promise.all([
        supabase.from("daily_checks").select("id", { count: "exact", head: true }).eq("user_id", userId),
        supabase.from("body_measurements").select("id", { count: "exact", head: true }).eq("user_id", userId),
        supabase.from("food_entries").select("id", { count: "exact", head: true }).eq("user_id", userId),
        supabase.from("training_set_logs").select("id", { count: "exact", head: true }).eq("client_id", userId),
      ]);
      let planSeen = false;
      try { planSeen = localStorage.getItem("bf:trial:plan-seen") === "1"; } catch {}
      if (cancelled) return;
      setDone({
        checkin: (checkCount ?? 0) > 0,
        weight: (weightCount ?? 0) > 0,
        nutrition: (foodCount ?? 0) > 0,
        training: (setCount ?? 0) > 0,
        plan: planSeen,
      });
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [userId]);

  if (loading) return null;

  const doneCount = STEPS.filter((s) => done[s.key]).length;
  const pct = Math.round((doneCount / STEPS.length) * 100);
  if (doneCount === STEPS.length) return null;

  return (
    <div className="rounded-3xl border border-gold/40 bg-gradient-to-br from-gold/10 via-card to-card p-5 sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-gold">
            <Sparkles className="h-3 w-3" /> Trial Startpaket
          </div>
          <h2 className="mt-1 font-display text-xl font-bold">
            Komm in 5 Schritten in Fahrt
          </h2>
          <p className="text-xs text-muted-foreground">
            {doneCount} von {STEPS.length} erledigt · jeder Schritt = +5 Bonus-Punkte
          </p>
        </div>
        <div className="text-right">
          <div className="font-display text-3xl font-bold text-gold">{pct}%</div>
        </div>
      </div>

      <div className="mt-3 h-2 overflow-hidden rounded-full bg-secondary">
        <div className="h-full rounded-full bg-gradient-gold transition-all" style={{ width: `${pct}%` }} />
      </div>

      <ul className="mt-4 space-y-2">
        {STEPS.map((s) => {
          const ok = done[s.key];
          return (
            <li key={s.key}>
              <Link
                to={s.to}
                onClick={() => {
                  if (s.key === "plan") {
                    try { localStorage.setItem("bf:trial:plan-seen", "1"); } catch {}
                  }
                }}
                className={`flex items-center gap-3 rounded-xl border p-3 transition ${
                  ok ? "border-emerald-500/40 bg-emerald-500/5" : "border-border bg-background/40 hover:border-gold/40"
                }`}
              >
                <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${ok ? "bg-emerald-500/20 text-emerald-400" : "bg-secondary text-muted-foreground"}`}>
                  {ok ? <Check className="h-4 w-4" /> : <Circle className="h-4 w-4" />}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold">{s.title}</div>
                  <div className="truncate text-xs text-muted-foreground">{s.desc}</div>
                </div>
                <span className="shrink-0 text-[10px] font-bold uppercase tracking-wider text-gold">+{s.points}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
