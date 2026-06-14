import { useEffect, useState } from "react";
import { CalendarCheck, ChevronDown, ChevronUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type Checkin = {
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
};

export function CustomerCheckinsCard({ userId }: { userId: string }) {
  const [items, setItems] = useState<Checkin[]>([]);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("weekly_checkins")
        .select(
          "id, week_start, submitted_at, weight_kg, body_fat_pct, waist_cm, chest_cm, thigh_left_cm, thigh_right_cm, biceps_left_cm, biceps_right_cm, mood, energy, sleep_quality, training_adherence, nutrition_adherence, wins, struggles",
        )
        .eq("user_id", userId)
        .order("week_start", { ascending: false })
        .limit(12);
      if (cancelled) return;
      setItems((data ?? []) as Checkin[]);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  return (
    <div className="rounded-2xl border border-border bg-card p-6">
      <div className="flex items-center gap-2">
        <CalendarCheck className="h-5 w-5 text-gold" />
        <h2 className="font-display text-lg font-bold">Check-in Ergebnisse</h2>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        Letzte Wochen-Check-ins des Kunden.
      </p>

      {loading ? (
        <p className="mt-4 text-sm text-muted-foreground">Lade…</p>
      ) : items.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">
          Noch keine Check-ins eingetragen.
        </p>
      ) : (
        <ul className="mt-4 space-y-2">
          {items.map((c) => {
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
                      {c.mood ? ` · Stimmung ${c.mood}/5` : ""}
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
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                      <Metric label="Gewicht" value={c.weight_kg} unit="kg" />
                      <Metric label="KFA" value={c.body_fat_pct} unit="%" />
                      <Metric label="Taille" value={c.waist_cm} unit="cm" />
                      <Metric label="Brust" value={c.chest_cm} unit="cm" />
                      <Metric label="Oberschenkel L" value={c.thigh_left_cm} unit="cm" />
                      <Metric label="Oberschenkel R" value={c.thigh_right_cm} unit="cm" />
                      <Metric label="Bizeps L" value={c.biceps_left_cm} unit="cm" />
                      <Metric label="Bizeps R" value={c.biceps_right_cm} unit="cm" />
                    </div>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                      <Metric label="Stimmung" value={c.mood} unit="/5" />
                      <Metric label="Energie" value={c.energy} unit="/5" />
                      <Metric label="Schlaf" value={c.sleep_quality} unit="/5" />
                      <Metric label="Training" value={c.training_adherence} unit="/5" />
                      <Metric label="Ernährung" value={c.nutrition_adherence} unit="/5" />
                    </div>
                    {c.wins && (
                      <div>
                        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                          Erfolge
                        </div>
                        <p className="mt-1 whitespace-pre-wrap">{c.wins}</p>
                      </div>
                    )}
                    {c.struggles && (
                      <div>
                        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                          Herausforderungen
                        </div>
                        <p className="mt-1 whitespace-pre-wrap">{c.struggles}</p>
                      </div>
                    )}
                    <div className="text-[10px] text-muted-foreground">
                      Eingetragen am{" "}
                      {new Date(c.submitted_at).toLocaleString("de-DE")}
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function Metric({
  label,
  value,
  unit,
}: {
  label: string;
  value: number | null;
  unit: string;
}) {
  return (
    <div className="rounded-md border border-border bg-secondary/20 p-2">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="text-sm font-bold text-foreground">
        {value != null ? `${value}${unit}` : "—"}
      </div>
    </div>
  );
}
