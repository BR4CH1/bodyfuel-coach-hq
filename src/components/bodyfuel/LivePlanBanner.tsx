import { useEffect, useState } from "react";
import { Activity, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type StateRow = {
  exercise_name: string;
  progression_status: string;
  trend: string;
  last_reason: string | null;
  last_completed_at: string | null;
};

/**
 * "DEIN PLAN IST LIVE" — kompakter Banner, der zeigt dass der Plan
 * sich anhand der letzten Trainingseinheiten anpasst. Zeigt die
 * jüngsten Progressions-Entscheidungen aus `athlete_exercise_state`.
 */
export function LivePlanBanner({ userId }: { userId: string }) {
  const [rows, setRows] = useState<StateRow[] | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data } = await supabase
        .from("athlete_exercise_state")
        .select("exercise_name, progression_status, trend, last_reason, last_completed_at")
        .eq("user_id", userId)
        .order("last_completed_at", { ascending: false })
        .limit(3);
      if (alive) setRows(((data ?? []) as any[]) as StateRow[]);
    })();
    return () => {
      alive = false;
    };
  }, [userId]);

  if (!rows || rows.length === 0) return null;

  return (
    <section className="rounded-2xl border border-gold/40 bg-gradient-to-br from-gold/10 via-background to-background p-4">
      <div className="flex items-center gap-2">
        <div className="grid h-8 w-8 place-items-center rounded-full bg-gold/20 text-gold">
          <Activity className="h-4 w-4" />
        </div>
        <div>
          <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-gold">
            Dein Plan ist live
          </div>
          <div className="text-xs text-muted-foreground">
            Smart-Progression passt Gewicht & Wiederholungen automatisch an.
          </div>
        </div>
      </div>
      <ul className="mt-3 space-y-1.5">
        {rows.map((r, i) => (
          <li key={i} className="flex items-start gap-2 text-xs">
            <TrendIcon trend={r.trend} />
            <div className="min-w-0 flex-1">
              <div className="truncate font-semibold">{r.exercise_name}</div>
              {r.last_reason && (
                <div className="truncate text-[11px] text-muted-foreground">{r.last_reason}</div>
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

function TrendIcon({ trend }: { trend: string }) {
  if (trend === "up") return <TrendingUp className="mt-0.5 h-3.5 w-3.5 text-emerald-500" />;
  if (trend === "down") return <TrendingDown className="mt-0.5 h-3.5 w-3.5 text-orange-500" />;
  return <Minus className="mt-0.5 h-3.5 w-3.5 text-muted-foreground" />;
}
