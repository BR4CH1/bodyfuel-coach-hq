import { useEffect, useState } from "react";
import { CalendarCheck, ChevronDown, ChevronUp, MessageSquare, Sparkles } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  getPublishedCheckinForClient,
  type ClientPublishedCheckin,
} from "@/lib/checkin-ai.functions";

type Row = {
  id: string;
  week_start: string;
  submitted_at: string;
  weight_kg: number | null;
  body_fat_pct: number | null;
  waist_cm: number | null;
  chest_cm: number | null;
  thigh_left_cm: number | null;
  thigh_right_cm: number | null;
  biceps_left_cm: number | null;
  biceps_right_cm: number | null;
  mood: number | null;
  energy: number | null;
  sleep_quality: number | null;
  training_adherence: number | null;
  nutrition_adherence: number | null;
  wins: string | null;
  struggles: string | null;
  coach_notes: string | null;
};

function fmt(v: number | null, unit: string) {
  return v == null ? "—" : `${v}${unit}`;
}

function delta(curr: number | null, prev: number | null, unit: string) {
  if (curr == null || prev == null) return null;
  const d = Number((curr - prev).toFixed(1));
  if (d === 0) return { txt: "±0" + unit, tone: "muted" as const };
  const sign = d > 0 ? "+" : "";
  return { txt: `${sign}${d}${unit}`, tone: d < 0 ? "down" : ("up" as const) };
}

export function MyCheckinsHistorySection({ userId }: { userId: string }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [openArchive, setOpenArchive] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("weekly_checkins")
        .select(
          "id, week_start, submitted_at, weight_kg, body_fat_pct, waist_cm, chest_cm, thigh_left_cm, thigh_right_cm, biceps_left_cm, biceps_right_cm, mood, energy, sleep_quality, training_adherence, nutrition_adherence, wins, struggles, coach_notes",
        )
        .eq("user_id", userId)
        .order("week_start", { ascending: false })
        .limit(24);
      if (cancelled) return;
      setRows((data ?? []) as Row[]);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const curr = rows[0] ?? null;
  const prev = rows[1] ?? null;
  const archive = rows.slice(1);

  return (
    <section className="rounded-2xl border border-border bg-card p-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <CalendarCheck className="h-5 w-5 text-gold" />
          <h2 className="font-display text-lg font-bold">Check-ins</h2>
        </div>
        <Link
          to="/check-in"
          className="text-xs font-semibold text-gold hover:underline"
        >
          Neuen Check-in eintragen →
        </Link>
      </div>

      {loading ? (
        <p className="mt-4 text-sm text-muted-foreground">Lade…</p>
      ) : !curr ? (
        <p className="mt-4 text-sm text-muted-foreground">
          Noch keine Check-ins eingetragen.
        </p>
      ) : (
        <>
          <p className="mt-1 text-xs text-muted-foreground">
            Aktuelle Woche ab {new Date(curr.week_start).toLocaleDateString("de-DE")}
            {prev
              ? ` · Vergleich zur Woche ab ${new Date(prev.week_start).toLocaleDateString("de-DE")}`
              : " · keine Vorwoche zum Vergleich"}
          </p>

          <ComparisonGrid curr={curr} prev={prev} />

          {curr.coach_notes ? (
            <div className="mt-4 rounded-xl border border-gold/40 bg-gold/5 p-4">
              <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-gold">
                <MessageSquare className="h-4 w-4" /> Antwort vom Coach
              </div>
              <p className="mt-2 whitespace-pre-wrap text-sm text-foreground">
                {curr.coach_notes}
              </p>
            </div>
          ) : (
            <div className="mt-4 rounded-xl border border-dashed border-border bg-background/40 p-4 text-xs text-muted-foreground">
              Dein Coach hat zu diesem Check-in noch keine Antwort hinterlegt.
            </div>
          )}

          {archive.length > 0 && (
            <div className="mt-5 border-t border-border pt-4">
              <button
                type="button"
                onClick={() => setOpenArchive((o) => !o)}
                className="flex w-full items-center justify-between text-left text-sm font-semibold"
              >
                <span>Archiv ({archive.length})</span>
                {openArchive ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </button>
              {openArchive && (
                <ul className="mt-3 space-y-2">
                  {archive.map((c) => {
                    const open = openId === c.id;
                    return (
                      <li
                        key={c.id}
                        className="rounded-xl border border-border bg-background/40"
                      >
                        <button
                          type="button"
                          onClick={() => setOpenId(open ? null : c.id)}
                          className="flex w-full items-center justify-between gap-3 px-3 py-3 text-left"
                        >
                          <div className="min-w-0">
                            <div className="text-sm font-semibold">
                              Woche ab{" "}
                              {new Date(c.week_start).toLocaleDateString("de-DE")}
                            </div>
                            <div className="text-[11px] text-muted-foreground">
                              {c.weight_kg ? `${c.weight_kg} kg` : "—"}
                              {c.body_fat_pct ? ` · ${c.body_fat_pct}% KFA` : ""}
                              {c.coach_notes ? " · Coach-Antwort vorhanden" : ""}
                            </div>
                          </div>
                          {open ? (
                            <ChevronUp className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          )}
                        </button>
                        {open && (
                          <div className="space-y-3 border-t border-border px-3 py-3 text-xs">
                            <ComparisonGrid curr={c} prev={null} compact />
                            {c.coach_notes && (
                              <div className="rounded-lg border border-gold/30 bg-gold/5 p-3">
                                <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-gold">
                                  <MessageSquare className="h-3 w-3" /> Coach-Antwort
                                </div>
                                <p className="mt-1 whitespace-pre-wrap text-foreground">
                                  {c.coach_notes}
                                </p>
                              </div>
                            )}
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          )}
        </>
      )}
    </section>
  );
}

function ComparisonGrid({
  curr,
  prev,
  compact,
}: {
  curr: Row;
  prev: Row | null;
  compact?: boolean;
}) {
  const metrics: Array<{ label: string; unit: string; key: keyof Row }> = [
    { label: "Gewicht", unit: "kg", key: "weight_kg" },
    { label: "KFA", unit: "%", key: "body_fat_pct" },
    { label: "Taille", unit: "cm", key: "waist_cm" },
    { label: "Brust", unit: "cm", key: "chest_cm" },
    { label: "Oberschenkel L", unit: "cm", key: "thigh_left_cm" },
    { label: "Oberschenkel R", unit: "cm", key: "thigh_right_cm" },
    { label: "Bizeps L", unit: "cm", key: "biceps_left_cm" },
    { label: "Bizeps R", unit: "cm", key: "biceps_right_cm" },
  ];
  return (
    <div className={`grid gap-2 ${compact ? "grid-cols-2 sm:grid-cols-4" : "mt-4 grid-cols-2 sm:grid-cols-4"}`}>
      {metrics.map((m) => {
        const c = curr[m.key] as number | null;
        const p = (prev?.[m.key] as number | null) ?? null;
        const d = delta(c, p, m.unit);
        return (
          <div key={m.key} className="rounded-xl border border-border bg-background/40 p-3">
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
  );
}
