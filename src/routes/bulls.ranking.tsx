import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Trophy, Flame, TrendingUp } from "lucide-react";
import { AppLayout } from "@/components/bodyfuel/AppLayout";
import { BullsGate } from "@/components/bodyfuel/BullsGate";
import {
  getBullsRanking,
  getBullsMyScore,
  getBullsMyHistory,
  listBullsTeams,
} from "@/lib/organizations/bulls-ranking.functions";

export const Route = createFileRoute("/bulls/ranking")({
  head: () => ({
    meta: [
      { title: "Rangliste — Bulls Hub" },
      {
        name: "description",
        content:
          "Bulls-Rangliste: Punkte für Konstanz, Planerfüllung, Training, Ernährung, Check-ins und persönliche Entwicklung.",
      },
    ],
  }),
  component: () => (
    <AppLayout>
      <BullsGate>
        <RankingPage />
      </BullsGate>
    </AppLayout>
  ),
});

const TIMEFRAMES: { value: Timeframe; label: string }[] = [
  { value: "week", label: "Woche" },
  { value: "last_week", label: "Letzte Woche" },
  { value: "month", label: "Monat" },
  { value: "last_month", label: "Letzter Monat" },
  { value: "season", label: "Saison" },
  { value: "all", label: "Gesamt" },
];

type Timeframe = "week" | "last_week" | "month" | "last_month" | "season" | "all";

const CATEGORY_LABEL: Record<string, string> = {
  training: "Training",
  team_training: "Team-Training",
  nutrition: "Ernährung",
  check_in: "Check-in",
  tasks: "Coach-Aufgaben",
  recovery: "Recovery",
  rehab: "Rehab",
  development: "Entwicklung",
  challenge: "Challenge",
  streak: "Streak",
};

function RankingPage() {
  const [timeframe, setTimeframe] = useState<Timeframe>("season");
  const [teamId, setTeamId] = useState<string | null>(null);
  const [position, setPosition] = useState<string>("");

  const rankingFn = useServerFn(getBullsRanking);
  const myScoreFn = useServerFn(getBullsMyScore);
  const historyFn = useServerFn(getBullsMyHistory);
  const teamsFn = useServerFn(listBullsTeams);

  const { data: teams = [] } = useQuery({
    queryKey: ["bulls-teams"],
    queryFn: () => teamsFn() as Promise<{ id: string; name: string }[]>,
  });

  const { data: ranking } = useQuery({
    queryKey: ["bulls-ranking", timeframe, teamId, position],
    queryFn: () =>
      rankingFn({ data: { timeframe, teamId, position: position || null } }) as Promise<{
        rows: any[];
      }>,
  });

  const { data: myScore } = useQuery({
    queryKey: ["bulls-my-score", timeframe],
    queryFn: () => myScoreFn({ data: { timeframe } }) as Promise<any>,
  });

  const { data: history } = useQuery({
    queryKey: ["bulls-my-history"],
    queryFn: () => historyFn({ data: { limit: 40 } }) as Promise<{ rows: any[] }>,
  });

  const rows = ranking?.rows ?? [];
  const myRankIndex = useMemo(() => rows.findIndex((r: any) => r.total_points && r.display_name && r._me), [rows]);

  const totalAllTime = useMemo(() => {
    const arr = (myScore?.allTimeBreakdown ?? []) as { total_points: number }[];
    return arr.reduce((s, r) => s + (r.total_points || 0), 0);
  }, [myScore]);
  const totalInFrame = useMemo(() => {
    const arr = (myScore?.breakdown ?? []) as { total_points: number }[];
    return arr.reduce((s, r) => s + (r.total_points || 0), 0);
  }, [myScore]);

  return (
    <div className="mx-auto max-w-3xl space-y-5 px-4 pb-24 pt-3">
      <Link
        to="/bulls"
        className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Zurück zum Bulls Hub
      </Link>

      <header className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/15 text-primary">
          <Trophy className="h-5 w-5" />
        </div>
        <div>
          <h1 className="font-display text-2xl font-bold uppercase leading-tight tracking-tight">Rangliste</h1>
          <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
            Konstanz · Planerfüllung · Entwicklung
          </p>
        </div>
      </header>

      {/* Filters */}
      <section className="space-y-3 rounded-2xl border border-border/40 bg-card/60 p-4">
        <div className="flex flex-wrap gap-2">
          {TIMEFRAMES.map((tf) => (
            <button
              key={tf.value}
              onClick={() => setTimeframe(tf.value)}
              className={`rounded-full border px-3 py-1 text-[11px] font-bold uppercase tracking-[0.15em] transition ${
                timeframe === tf.value
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border/50 bg-background hover:border-primary/50"
              }`}
            >
              {tf.label}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <select
            value={teamId ?? ""}
            onChange={(e) => setTeamId(e.target.value || null)}
            className="rounded-lg border border-border/40 bg-background px-3 py-2 text-sm"
          >
            <option value="">Alle Teams</option>
            {teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          <input
            type="text"
            value={position}
            onChange={(e) => setPosition(e.target.value)}
            placeholder="Position (z.B. QB, DL)"
            className="rounded-lg border border-border/40 bg-background px-3 py-2 text-sm"
          />
        </div>
      </section>

      {/* Mein Score */}
      <section className="space-y-3 rounded-2xl border border-primary/30 bg-primary/5 p-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Mein Score</div>
            <div className="font-display text-3xl font-black">
              {totalInFrame} <span className="text-base font-normal text-muted-foreground">Pkt</span>
            </div>
            <div className="text-xs text-muted-foreground">Gesamt: {totalAllTime} Pkt</div>
          </div>
          {myScore?.streak && (
            <div className="flex items-center gap-2 rounded-full bg-orange-500/15 px-3 py-1 text-orange-500">
              <Flame className="h-4 w-4" />
              <span className="text-sm font-bold">{myScore.streak.days ?? "–"} Tage</span>
            </div>
          )}
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {(myScore?.breakdown ?? []).map((row: any) => (
            <div key={row.category} className="rounded-lg border border-border/40 bg-background/60 p-2">
              <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                {CATEGORY_LABEL[row.category] ?? row.category}
              </div>
              <div className="text-lg font-bold">{row.total_points}</div>
              <div className="text-[10px] text-muted-foreground">{row.event_count} Ereignisse</div>
            </div>
          ))}
          {(!myScore?.breakdown || myScore.breakdown.length === 0) && (
            <div className="col-span-full text-sm text-muted-foreground">
              Noch keine Punkte in diesem Zeitraum. Check-in, Training oder Ernährungs-Ziel — jeder Beitrag zählt.
            </div>
          )}
        </div>
      </section>

      {/* Ranking Liste */}
      <section className="space-y-2">
        <h2 className="text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Team-Ranking</h2>
        <ol className="space-y-1">
          {rows.map((r: any, i: number) => (
            <li
              key={r.user_id}
              className="flex items-center justify-between rounded-xl border border-border/40 bg-card/60 px-3 py-2"
            >
              <div className="flex items-center gap-3">
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${
                    i === 0
                      ? "bg-yellow-500 text-black"
                      : i === 1
                        ? "bg-slate-300 text-black"
                        : i === 2
                          ? "bg-amber-700 text-white"
                          : "bg-muted text-muted-foreground"
                  }`}
                >
                  {i + 1}
                </div>
                <div>
                  <div className="text-sm font-semibold">{r.display_name || r.nickname || "—"}</div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    {r.sport_position || "Bulls"}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1 text-primary">
                <TrendingUp className="h-3.5 w-3.5" />
                <span className="text-sm font-bold">{r.total_points}</span>
              </div>
            </li>
          ))}
          {rows.length === 0 && (
            <li className="rounded-xl border border-dashed border-border/40 p-4 text-center text-sm text-muted-foreground">
              Noch keine Einträge in diesem Zeitraum.
            </li>
          )}
        </ol>
      </section>

      {/* Historie */}
      <section className="space-y-2">
        <h2 className="text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Meine Punkte-Historie</h2>
        <ul className="space-y-1">
          {(history?.rows ?? []).map((h: any) => (
            <li
              key={h.id}
              className="flex items-center justify-between rounded-lg border border-border/40 bg-card/60 px-3 py-2"
            >
              <div>
                <div className="text-sm font-medium">{h.reason || CATEGORY_LABEL[h.category] || h.event_kind}</div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  {h.event_date} · {CATEGORY_LABEL[h.category] ?? h.category}
                </div>
              </div>
              <div className={`text-sm font-bold ${h.points >= 0 ? "text-emerald-500" : "text-red-500"}`}>
                {h.points > 0 ? "+" : ""}
                {h.points}
              </div>
            </li>
          ))}
          {(!history?.rows || history.rows.length === 0) && (
            <li className="rounded-lg border border-dashed border-border/40 p-3 text-center text-xs text-muted-foreground">
              Noch keine Punkte-Historie.
            </li>
          )}
        </ul>
      </section>
    </div>
  );
}
