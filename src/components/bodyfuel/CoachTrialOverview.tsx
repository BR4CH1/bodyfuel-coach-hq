import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Sparkles, Clock, AlertTriangle, TrendingUp, ArrowRight } from "lucide-react";
import { listTrialUsers } from "@/lib/trial.functions";
import { supabase } from "@/integrations/supabase/client";

function daysLeft(endIso: string | null): number {
  if (!endIso) return 0;
  const end = new Date(`${endIso}T23:59:59Z`).getTime();
  return Math.ceil((end - Date.now()) / 86_400_000);
}

export function CoachTrialOverview() {
  const listFn = useServerFn(listTrialUsers);
  const { data: trials = [], isLoading } = useQuery({
    queryKey: ["coach-trials"],
    queryFn: () => listFn(),
  });

  // Conversion: aktive Mitglieder vs. (aktiv + alle Trials je registriert)
  const { data: activeCount = 0 } = useQuery({
    queryKey: ["coach-trials-active-count"],
    queryFn: async () => {
      const { count } = await supabase
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("trial_status", "active");
      return count ?? 0;
    },
  });

  const active = trials.filter((t) => t.trial_status === "trial" && daysLeft(t.trial_end) > 0);
  const expired = trials.filter((t) => t.trial_status === "trial_expired" || (t.trial_status === "trial" && daysLeft(t.trial_end) <= 0));
  const totalEver = activeCount + trials.length;
  const conversion = totalEver > 0 ? Math.round((activeCount / totalEver) * 100) : 0;

  return (
    <div className="rounded-2xl border border-gold/30 bg-gradient-to-br from-gold/5 via-card to-card p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-gold" />
          <h2 className="font-display text-lg font-bold">Trial-Übersicht</h2>
        </div>
        <Link
          to="/coach/customers"
          className="text-xs font-semibold text-gold hover:underline"
        >
          Alle Trials →
        </Link>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Stat icon={<Clock className="h-4 w-4" />} label="Aktiv" value={active.length} tone="gold" />
        <Stat icon={<AlertTriangle className="h-4 w-4" />} label="Abgelaufen" value={expired.length} tone="warn" />
        <Stat icon={<TrendingUp className="h-4 w-4" />} label="Conversion" value={`${conversion}%`} tone="green" />
      </div>

      {isLoading ? (
        <div className="mt-4 text-sm text-muted-foreground">Lade…</div>
      ) : active.length === 0 && expired.length === 0 ? (
        <div className="mt-4 rounded-xl border border-border bg-background/40 p-4 text-sm text-muted-foreground">
          Aktuell keine offenen Trials.
        </div>
      ) : (
        <ul className="mt-4 space-y-2">
          {[...active, ...expired].slice(0, 6).map((t) => {
            const d = daysLeft(t.trial_end);
            const isExpired = t.trial_status === "trial_expired" || d <= 0;
            return (
              <li key={t.id}>
                <Link
                  to="/coach/customers/$userId"
                  params={{ userId: t.id }}
                  className="flex items-center gap-3 rounded-xl border border-border bg-background/40 p-3 transition hover:border-gold/40"
                >
                  <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gradient-gold text-xs font-bold text-primary-foreground">
                    {(t.display_name ?? "??").slice(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold">{t.display_name ?? "Ohne Namen"}</div>
                    <div className="text-[11px] text-muted-foreground">
                      {isExpired
                        ? `Abgelaufen seit ${Math.abs(d)} Tag${Math.abs(d) === 1 ? "" : "en"}`
                        : `Noch ${d} Tag${d === 1 ? "" : "e"} · endet ${new Date(t.trial_end!).toLocaleDateString("de-DE")}`}
                    </div>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                      isExpired
                        ? "bg-destructive/15 text-destructive"
                        : d <= 2
                          ? "bg-warning/15 text-warning"
                          : "bg-gold/15 text-gold"
                    }`}
                  >
                    {isExpired ? "Abgelaufen" : `${d}T`}
                  </span>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function Stat({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: number | string; tone: "gold" | "warn" | "green" }) {
  const cls =
    tone === "warn"
      ? "border-destructive/30 text-destructive"
      : tone === "green"
        ? "border-emerald-500/30 text-emerald-400"
        : "border-gold/30 text-gold";
  return (
    <div className={`rounded-xl border bg-background/40 p-3 ${cls}`}>
      <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider">
        {icon}
        <span>{label}</span>
      </div>
      <div className="mt-1 font-display text-2xl font-bold text-foreground">{value}</div>
    </div>
  );
}
