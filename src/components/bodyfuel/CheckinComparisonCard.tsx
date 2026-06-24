import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { CalendarCheck, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type Row = {
  week_start: string;
  weight_kg: number | null;
  body_fat_pct: number | null;
  waist_cm: number | null;
  chest_cm: number | null;
  thigh_left_cm: number | null;
  thigh_right_cm: number | null;
  biceps_left_cm: number | null;
  biceps_right_cm: number | null;
};

function fmt(v: number | null, unit: string) {
  return v == null ? "—" : `${v}${unit}`;
}

function delta(curr: number | null, prev: number | null, unit: string) {
  if (curr == null || prev == null) return null;
  const d = Number((curr - prev).toFixed(1));
  if (d === 0) return { txt: "±0" + unit, tone: "muted" as const };
  const sign = d > 0 ? "+" : "";
  return { txt: `${sign}${d}${unit}`, tone: d < 0 ? "down" : "up" as const };
}

export function CheckinComparisonCard({ userId }: { userId: string }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("weekly_checkins")
        .select(
          "week_start, weight_kg, body_fat_pct, waist_cm, chest_cm, thigh_left_cm, thigh_right_cm, biceps_left_cm, biceps_right_cm",
        )
        .eq("user_id", userId)
        .order("week_start", { ascending: false })
        .limit(2);
      if (cancelled) return;
      setRows((data ?? []) as Row[]);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  if (loading || rows.length === 0) return null;

  const curr = rows[0];
  const prev = rows[1] ?? null;

  const metrics: Array<{ label: string; unit: string; key: keyof Row }> = [
    { label: "Gewicht", unit: "kg", key: "weight_kg" },
    { label: "KFA", unit: "%", key: "body_fat_pct" },
    { label: "Bauchumfang", unit: "cm", key: "waist_cm" },
    { label: "Brust", unit: "cm", key: "chest_cm" },
    { label: "Oberschenkel L", unit: "cm", key: "thigh_left_cm" },
    { label: "Oberschenkel R", unit: "cm", key: "thigh_right_cm" },
    { label: "Bizeps L", unit: "cm", key: "biceps_left_cm" },
    { label: "Bizeps R", unit: "cm", key: "biceps_right_cm" },
  ];

  return (
    <div className="rounded-2xl border border-border bg-card p-5 sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <CalendarCheck className="h-5 w-5 text-gold" />
          <h2 className="font-display text-lg font-bold">Check-in vs. Vorwoche</h2>
        </div>
        <Link
          to="/check-in"
          className="flex items-center gap-1 text-xs font-semibold text-gold hover:underline"
        >
          Zum Check-in <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        Aktuelle Woche ab {new Date(curr.week_start).toLocaleDateString("de-DE")}
        {prev
          ? ` · Vergleich zur Woche ab ${new Date(prev.week_start).toLocaleDateString("de-DE")}`
          : " · keine Vorwoche zum Vergleich"}
      </p>

      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {metrics.map((m) => {
          const c = curr[m.key] as number | null;
          const p = (prev?.[m.key] as number | null) ?? null;
          const d = delta(c, p, m.unit);
          return (
            <div
              key={m.key}
              className="rounded-xl border border-border bg-background/40 p-3"
            >
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                {m.label}
              </div>
              <div className="mt-0.5 font-display text-base font-bold">
                {fmt(c, m.unit)}
              </div>
              <div className="mt-0.5 text-[11px]">
                {p == null ? (
                  <span className="text-muted-foreground">Vorwoche —</span>
                ) : (
                  <span className="text-muted-foreground">
                    Vorw. {fmt(p, m.unit)}{" "}
                    {d && (
                      <span
                        className={
                          d.tone === "down"
                            ? "text-emerald-500"
                            : d.tone === "up"
                              ? "text-amber-400"
                              : "text-muted-foreground"
                        }
                      >
                        ({d.txt})
                      </span>
                    )}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
