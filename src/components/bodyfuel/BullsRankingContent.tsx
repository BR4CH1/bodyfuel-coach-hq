import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Trophy, Flame, Crown, Medal, Award, Lock } from "lucide-react";
import {
  getBullsRanking,
  getBullsMyScore,
  getBullsMyHistory,
  getBullsMonthlyRanking,
  getBullsHallOfFame,
  getBullsMyAwards,
  getBullsArchivedMonth,
} from "@/lib/organizations/bulls-ranking.functions";

const MONTH_NAMES = [
  "Januar",
  "Februar",
  "März",
  "April",
  "Mai",
  "Juni",
  "Juli",
  "August",
  "September",
  "Oktober",
  "November",
  "Dezember",
];

type ViewMode = "current" | "last" | "all_time";

function nowYearMonth() {
  const d = new Date();
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
}

function lastYearMonth() {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - 1);
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
}

function daysLeftInMonth(year: number, month: number): number {
  const now = new Date();
  const end = new Date(year, month, 0);
  end.setHours(23, 59, 59, 999);
  const ms = end.getTime() - now.getTime();
  return Math.max(0, Math.ceil(ms / (24 * 60 * 60 * 1000)));
}

export function BullsRankingContent({ showBackLink = true }: { showBackLink?: boolean }) {
  const [mode, setMode] = useState<ViewMode>("current");
  const [archiveKey, setArchiveKey] = useState<{ year: number; month: number } | null>(null);

  const current = useMemo(() => nowYearMonth(), []);
  const last = useMemo(() => lastYearMonth(), []);
  const target = mode === "current" ? current : mode === "last" ? last : null;

  const monthlyFn = useServerFn(getBullsMonthlyRanking);
  const allTimeFn = useServerFn(getBullsRanking);
  const myScoreFn = useServerFn(getBullsMyScore);
  const historyFn = useServerFn(getBullsMyHistory);
  const hofFn = useServerFn(getBullsHallOfFame);
  const awardsFn = useServerFn(getBullsMyAwards);
  const archiveFn = useServerFn(getBullsArchivedMonth);

  const monthly = useQuery({
    queryKey: ["bulls-monthly", target?.year, target?.month],
    queryFn: () =>
      monthlyFn({ data: { year: target!.year, month: target!.month } }) as Promise<any>,
    enabled: mode !== "all_time" && !!target,
  });

  const allTime = useQuery({
    queryKey: ["bulls-alltime"],
    queryFn: () => allTimeFn({ data: { timeframe: "all" } }) as Promise<{ rows: any[] }>,
    enabled: mode === "all_time",
  });

  const monthMyScoreTf = mode === "last" ? "last_month" : "month";
  const myScore = useQuery({
    queryKey: ["bulls-my-score", mode],
    queryFn: () =>
      myScoreFn({ data: { timeframe: mode === "all_time" ? "all" : monthMyScoreTf } }) as Promise<any>,
  });

  const history = useQuery({
    queryKey: ["bulls-my-history"],
    queryFn: () => historyFn({ data: { limit: 40 } }) as Promise<{ rows: any[] }>,
  });

  const hof = useQuery({
    queryKey: ["bulls-hof"],
    queryFn: () => hofFn({ data: { limit: 24 } }) as Promise<{ rows: any[] }>,
  });

  const awards = useQuery({
    queryKey: ["bulls-my-awards"],
    queryFn: () => awardsFn() as Promise<{ rows: any[] }>,
  });

  const archive = useQuery({
    queryKey: ["bulls-archive", archiveKey?.year, archiveKey?.month],
    queryFn: () =>
      archiveFn({
        data: { year: archiveKey!.year, month: archiveKey!.month, limit: 10 },
      }) as Promise<{ rows: any[] }>,
    enabled: !!archiveKey,
  });

  const viewerUserId = monthly.data?.viewerUserId as string | undefined;
  const rows: any[] =
    mode === "all_time" ? (allTime.data?.rows ?? []) : (monthly.data?.rows ?? []);

  const displayRows = rows.map((r, i) => ({
    ...r,
    rank: r.rank ?? i + 1,
    points: r.total_points ?? r.final_points ?? 0,
  }));

  const mySelf = displayRows.find((r) => r.user_id === viewerUserId);
  const rank10Points = displayRows.length >= 10 ? (displayRows[9].points as number) : null;
  const gapTo10 =
    mySelf && rank10Points !== null && mySelf.rank > 10
      ? Math.max(0, rank10Points - (mySelf.points as number))
      : null;

  const finalization = monthly.data?.finalization as
    | {
        status: string;
        winner_user_id: string | null;
        winner_points: number | null;
        finalized_at: string;
      }
    | null;

  const topThree = displayRows.slice(0, 3);
  const rest = displayRows.slice(3);

  const monthLabel = target ? `${MONTH_NAMES[target.month - 1]} ${target.year}` : "Gesamt";
  const daysLeft = target ? daysLeftInMonth(target.year, target.month) : 0;
  const isFinalized = !!finalization && finalization.status === "finalized";

  return (
    <div className="mx-auto max-w-3xl space-y-5 px-4 pb-24 pt-3">
      {showBackLink && (
        <Link
          to="/dashboard"
          className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Zurück zum Bulls Hub
        </Link>
      )}

      <header className="rounded-2xl border border-primary/40 bg-gradient-to-br from-black via-neutral-900 to-black p-5 text-white">
        <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.3em] text-primary">
          <Trophy className="h-4 w-4" />
          Bulls Rangliste
        </div>
        <h1 className="mt-1 font-display text-3xl font-black uppercase tracking-tight">
          {mode === "all_time" ? "All-Time" : monthLabel}
        </h1>
        {mode === "current" && (
          <p className="mt-1 text-xs text-white/70">
            {isFinalized
              ? "Monat finalisiert"
              : daysLeft > 0
                ? `Noch ${daysLeft} Tag${daysLeft === 1 ? "" : "e"} bis zum Monatsabschluss`
                : "Monatsabschluss steht bevor"}
          </p>
        )}
        {mode === "last" && (
          <p className="mt-1 text-xs text-white/70">
            {isFinalized
              ? `Finalisiert am ${new Date(finalization!.finalized_at).toLocaleDateString("de-DE")}`
              : "Wird beim nächsten Cron-Lauf finalisiert"}
          </p>
        )}
        {mode === "all_time" && (
          <p className="mt-1 text-xs text-white/70">
            Alle BodyFuel-Punkte seit Start · Monatsplatzierungen bleiben davon unberührt
          </p>
        )}

        <div className="mt-4 flex flex-wrap gap-2">
          {[
            { v: "current" as ViewMode, label: "Aktueller Monat" },
            { v: "last" as ViewMode, label: "Letzter Monat" },
            { v: "all_time" as ViewMode, label: "All-Time" },
          ].map((f) => (
            <button
              key={f.v}
              onClick={() => setMode(f.v)}
              className={`rounded-full border px-3 py-1 text-[11px] font-bold uppercase tracking-[0.15em] transition ${
                mode === f.v
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-white/20 bg-transparent text-white/80 hover:border-primary/60"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </header>

      {mode !== "all_time" && isFinalized && finalization?.winner_user_id && (
        <section className="rounded-2xl border-2 border-yellow-400/60 bg-yellow-400/10 p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-yellow-400 text-black">
              <Crown className="h-5 w-5" />
            </div>
            <div>
              <div className="text-[10px] font-bold uppercase tracking-[0.25em] text-yellow-500">
                🏆 BodyFuel Player of the Month
              </div>
              <div className="font-display text-xl font-black">
                {displayRows[0]?.display_name || displayRows[0]?.nickname || "—"}
              </div>
              <div className="text-xs text-muted-foreground">
                {finalization.winner_points} Punkte · {monthLabel}
              </div>
            </div>
          </div>
        </section>
      )}

      {viewerUserId && mode !== "all_time" && (
        <section className="rounded-2xl border border-primary/30 bg-primary/5 p-4">
          <div className="text-[10px] font-bold uppercase tracking-[0.25em] text-muted-foreground">
            Deine Position
          </div>
          {mySelf ? (
            <>
              <div className="mt-1 flex items-baseline gap-2">
                <div className="font-display text-3xl font-black">Platz {mySelf.rank}</div>
                <div className="text-sm text-muted-foreground">von {displayRows.length}</div>
              </div>
              <div className="text-sm font-semibold">{mySelf.points} Punkte</div>
              {gapTo10 !== null && gapTo10 > 0 && (
                <div className="mt-1 text-xs text-muted-foreground">
                  Zum 10. Platz fehlen {gapTo10} Punkte
                </div>
              )}
              {myScore.data?.streak && (
                <div className="mt-2 inline-flex items-center gap-1 rounded-full bg-orange-500/15 px-2 py-0.5 text-xs font-bold text-orange-500">
                  <Flame className="h-3 w-3" />
                  {myScore.data.streak.days ?? "–"} Tage Streak
                </div>
              )}
            </>
          ) : (
            <div className="mt-1 text-sm text-muted-foreground">
              Noch keine Punkte in {monthLabel}. Check-in, Training oder Ernährungsziel — jeder Beitrag zählt.
            </div>
          )}
        </section>
      )}

      {(awards.data?.rows?.length ?? 0) > 0 && (
        <section className="rounded-2xl border border-border/40 bg-card/60 p-4">
          <div className="text-[10px] font-bold uppercase tracking-[0.25em] text-muted-foreground">
            Deine Auszeichnungen
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {awards.data!.rows.map((a) => (
              <div
                key={`${a.year}-${a.month}`}
                className="inline-flex items-center gap-1.5 rounded-full border border-yellow-400/60 bg-yellow-400/10 px-3 py-1 text-xs font-bold text-yellow-600"
              >
                <Crown className="h-3 w-3" />
                Player of the Month · {MONTH_NAMES[a.month - 1]} {a.year}
              </div>
            ))}
          </div>
        </section>
      )}

      {topThree.length > 0 && (
        <section>
          <h2 className="mb-2 text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
            Top 3
          </h2>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {topThree.map((r, i) => {
              const styles =
                i === 0
                  ? "border-yellow-400/60 bg-gradient-to-br from-yellow-400/20 to-transparent"
                  : i === 1
                    ? "border-slate-300/60 bg-gradient-to-br from-slate-300/15 to-transparent"
                    : "border-amber-700/60 bg-gradient-to-br from-amber-700/15 to-transparent";
              const icon =
                i === 0 ? (
                  <Crown className="h-4 w-4 text-yellow-500" />
                ) : i === 1 ? (
                  <Medal className="h-4 w-4 text-slate-400" />
                ) : (
                  <Award className="h-4 w-4 text-amber-700" />
                );
              return (
                <div key={r.user_id} className={`rounded-xl border-2 p-3 ${styles}`}>
                  <div className="flex items-center gap-2">
                    {icon}
                    <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                      Platz {r.rank}
                    </div>
                  </div>
                  <div className="mt-1 truncate font-display text-lg font-black">
                    {r.display_name || r.nickname || "—"}
                  </div>
                  <div className="text-sm font-bold text-primary">{r.points} Pkt</div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <section className="space-y-2">
        <h2 className="text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
          Rangliste {mode === "all_time" ? "(All-Time)" : monthLabel}
        </h2>
        <ol className="space-y-1">
          {rest.map((r) => (
            <li
              key={r.user_id}
              className={`flex items-center justify-between rounded-xl border px-3 py-2 ${
                r.user_id === viewerUserId
                  ? "border-primary/60 bg-primary/10"
                  : "border-border/40 bg-card/60"
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-sm font-bold text-muted-foreground">
                  {r.rank}
                </div>
                <div>
                  <div className="text-sm font-semibold">
                    {r.display_name || r.nickname || "—"}
                  </div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    {r.sport_position || "Bulls"}
                  </div>
                </div>
              </div>
              <div className="text-sm font-bold text-primary">{r.points}</div>
            </li>
          ))}
          {displayRows.length === 0 && (
            <li className="rounded-xl border border-dashed border-border/40 p-4 text-center text-sm text-muted-foreground">
              Noch keine Einträge in diesem Zeitraum.
            </li>
          )}
        </ol>
      </section>

      {(hof.data?.rows?.length ?? 0) > 0 && (
        <section className="space-y-2">
          <h2 className="text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
            Hall of Fame · Vergangene Sieger
          </h2>
          <ul className="space-y-1">
            {hof.data!.rows.map((w) => {
              const isOpen = archiveKey?.year === w.year && archiveKey?.month === w.month;
              return (
                <li
                  key={`${w.year}-${w.month}`}
                  className="rounded-xl border border-border/40 bg-card/60"
                >
                  <button
                    onClick={() =>
                      setArchiveKey(isOpen ? null : { year: w.year, month: w.month })
                    }
                    className="flex w-full items-center justify-between px-3 py-2 text-left"
                  >
                    <div className="flex items-center gap-2">
                      <Crown className="h-4 w-4 text-yellow-500" />
                      <div>
                        <div className="text-sm font-semibold">
                          {MONTH_NAMES[w.month - 1]} {w.year}
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                          {w.winner_display_name || "—"}
                        </div>
                      </div>
                    </div>
                    <div className="text-sm font-bold text-primary">
                      {w.winner_points} Pkt
                    </div>
                  </button>
                  {isOpen && (
                    <div className="border-t border-border/40 p-3">
                      {archive.isLoading ? (
                        <div className="text-xs text-muted-foreground">Lade…</div>
                      ) : (
                        <ol className="space-y-1">
                          {(archive.data?.rows ?? []).slice(0, 10).map((r: any) => (
                            <li
                              key={r.user_id}
                              className="flex items-center justify-between text-sm"
                            >
                              <span className="flex items-center gap-2">
                                <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-muted text-[11px] font-bold">
                                  {r.rank}
                                </span>
                                {r.profiles?.is_minor
                                  ? r.profiles?.nickname || "Athlet*in"
                                  : r.profiles?.display_name || r.profiles?.nickname || "—"}
                              </span>
                              <span className="font-bold">{r.final_points} Pkt</span>
                            </li>
                          ))}
                        </ol>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section className="space-y-2">
        <h2 className="text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
          Meine Punkte-Historie
        </h2>
        <ul className="space-y-1">
          {(history.data?.rows ?? []).map((h: any) => (
            <li
              key={h.id}
              className="flex items-center justify-between rounded-lg border border-border/40 bg-card/60 px-3 py-2"
            >
              <div>
                <div className="text-sm font-medium">{h.reason || h.event_kind}</div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  {h.event_date} · {h.category}
                </div>
              </div>
              <div
                className={`text-sm font-bold ${h.points >= 0 ? "text-emerald-500" : "text-red-500"}`}
              >
                {h.points > 0 ? "+" : ""}
                {h.points}
              </div>
            </li>
          ))}
          {(!history.data?.rows || history.data.rows.length === 0) && (
            <li className="rounded-lg border border-dashed border-border/40 p-3 text-center text-xs text-muted-foreground">
              Noch keine Punkte-Historie.
            </li>
          )}
        </ul>
      </section>

      {mode === "current" && !isFinalized && (
        <div className="rounded-xl border border-dashed border-border/40 p-3 text-center text-[11px] text-muted-foreground">
          <Lock className="mr-1 inline h-3 w-3" />
          Die Monatswertung wird automatisch am 1. des Folgemonats finalisiert. Historische Punkte bleiben erhalten.
        </div>
      )}
    </div>
  );
}
