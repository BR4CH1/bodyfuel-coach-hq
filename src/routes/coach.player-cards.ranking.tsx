/**
 * Coach — Player Cards Rangliste, Player of the Month, Hall of Fame.
 * Phase 4 des Player-Card-Moduls.
 */
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  ArrowLeft,
  Award,
  Crown,
  Loader2,
  Shield,
  TrendingUp,
  Trophy,
  Users,
} from "lucide-react";
import { AppLayout } from "@/components/bodyfuel/AppLayout";
import { useSession } from "@/lib/bodyfuel/session";
import {
  listCoachPlayerCards,
  getPlayerCardRanking,
  getPlayerOfTheMonthCandidates,
  finalizePlayerOfTheMonth,
  getPlayerCardHallOfFame,
  getTeamOfTheMonthCandidates,
} from "@/lib/player-cards.functions";

export const Route = createFileRoute("/coach/player-cards/ranking")({
  head: () => ({
    meta: [
      { title: "Rangliste — Player Cards" },
      { name: "description", content: "BFR-Rangliste, Player of the Month und Hall of Fame für alle Organisationen." },
    ],
  }),
  component: () => (
    <AppLayout>
      <RankingPage />
    </AppLayout>
  ),
});

type Tab = "ranking" | "potm" | "hof";

const MONTHS_DE = [
  "Januar","Februar","März","April","Mai","Juni",
  "Juli","August","September","Oktober","November","Dezember",
];

function tierColor(tier: string | null): string {
  switch (tier) {
    case "legendary": return "from-purple-500 to-fuchsia-500";
    case "elite": return "from-blue-500 to-cyan-400";
    case "gold": return "from-yellow-500 to-amber-400";
    case "silver": return "from-slate-300 to-slate-500";
    default: return "from-orange-600 to-amber-700";
  }
}

function RankingPage() {
  const navigate = useNavigate();
  const { supabaseUser, loading } = useSession();
  const listFn = useServerFn(listCoachPlayerCards);

  useEffect(() => {
    if (!loading && !supabaseUser) navigate({ to: "/auth" });
  }, [loading, supabaseUser, navigate]);

  const orgsQ = useQuery({
    queryKey: ["coach-player-cards", "orgs"],
    queryFn: () => listFn(),
    enabled: !!supabaseUser,
  });

  const organizations = orgsQ.data?.organizations ?? [];
  const [orgId, setOrgId] = useState<string>("");
  useEffect(() => {
    if (!orgId && organizations.length > 0) setOrgId(organizations[0].id);
  }, [organizations, orgId]);

  const [tab, setTab] = useState<Tab>("ranking");

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <Link
          to="/coach/player-cards"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-white"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Zurück zum Grid
        </Link>
        <div className="text-[10px] font-bold uppercase tracking-[0.3em] text-bulls-red">
          Rangliste
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            <select
              value={orgId}
              onChange={(e) => setOrgId(e.target.value)}
              className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm"
            >
              {organizations.length === 0 && <option>Keine Organisation</option>}
              {organizations.map((o: any) => (
                <option key={o.id} value={o.id}>{o.name}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <TabBtn active={tab === "ranking"} onClick={() => setTab("ranking")} icon={<Trophy className="h-3.5 w-3.5" />} label="BFR-Rangliste" />
            <TabBtn active={tab === "potm"} onClick={() => setTab("potm")} icon={<Crown className="h-3.5 w-3.5" />} label="Player of the Month" />
            <TabBtn active={tab === "hof"} onClick={() => setTab("hof")} icon={<Award className="h-3.5 w-3.5" />} label="Hall of Fame" />
          </div>
        </div>
      </div>

      {!orgId ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">
          {orgsQ.isLoading ? <Loader2 className="mx-auto h-5 w-5 animate-spin" /> : "Keine Organisation gefunden."}
        </div>
      ) : tab === "ranking" ? (
        <RankingList orgId={orgId} />
      ) : tab === "potm" ? (
        <PlayerOfMonth orgId={orgId} />
      ) : (
        <HallOfFame orgId={orgId} />
      )}
    </div>
  );
}

function TabBtn({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition ${
        active
          ? "bg-bulls-red text-white"
          : "border border-border bg-card text-muted-foreground hover:text-white"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

// -------------------- Ranking --------------------

function RankingList({ orgId }: { orgId: string }) {
  const fn = useServerFn(getPlayerCardRanking);
  const [teamId, setTeamId] = useState<string>("all");
  const q = useQuery({
    queryKey: ["player-card-ranking", orgId, teamId],
    queryFn: () => fn({ data: { organization_id: orgId, team_id: teamId === "all" ? null : teamId } }),
    enabled: !!orgId,
  });

  const rows = q.data?.rows ?? [];
  const teams = q.data?.teams ?? [];

  return (
    <div className="space-y-3">
      {teams.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          <TeamChip active={teamId === "all"} onClick={() => setTeamId("all")} label="Alle Teams" />
          {teams.map((t: any) => (
            <TeamChip key={t.id} active={teamId === t.id} onClick={() => setTeamId(t.id)} label={t.name} />
          ))}
        </div>
      )}

      {q.isLoading ? (
        <div className="grid place-items-center rounded-2xl border border-border bg-card p-10">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">
          Noch keine Player Cards für diese Auswahl.
        </div>
      ) : (
        <div className="space-y-1.5">
          {rows.map((r: any) => (
            <div
              key={r.user_id}
              className="flex items-center gap-3 rounded-xl border border-border bg-card p-3"
            >
              <div className={`grid h-10 w-10 place-items-center rounded-lg bg-gradient-to-br ${tierColor(r.tier)} text-sm font-black text-white shadow`}>
                #{r.rank_num}
              </div>
              {r.avatar_url ? (
                <img src={r.avatar_url} alt="" className="h-10 w-10 rounded-full object-cover" />
              ) : (
                <div className="grid h-10 w-10 place-items-center rounded-full bg-muted text-xs font-bold">
                  {(r.display_name ?? "?").slice(0, 2).toUpperCase()}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold">{r.display_name ?? "Unbenannt"}</div>
                <div className="truncate text-[11px] text-muted-foreground">
                  {[r.team_name, r.position_key].filter(Boolean).join(" · ") || "—"}
                </div>
              </div>
              <div className="text-right">
                <div className="text-2xl font-black leading-none">{r.bfr}</div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  BFR{r.is_provisional ? " · vorl." : ""}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function TeamChip({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-3 py-1 text-[11px] font-semibold transition ${
        active ? "bg-bulls-red text-white" : "border border-border bg-card text-muted-foreground hover:text-white"
      }`}
    >
      {label}
    </button>
  );
}

// -------------------- Player of the Month --------------------

function PlayerOfMonth({ orgId }: { orgId: string }) {
  const qc = useQueryClient();
  const now = new Date();
  const [year, setYear] = useState(now.getUTCFullYear());
  const [month, setMonth] = useState(now.getUTCMonth() + 1);

  const fn = useServerFn(getPlayerOfTheMonthCandidates);
  const finFn = useServerFn(finalizePlayerOfTheMonth);

  const q = useQuery({
    queryKey: ["potm-candidates", orgId, year, month],
    queryFn: () => fn({ data: { organization_id: orgId, year, month } }),
    enabled: !!orgId,
  });

  const mut = useMutation({
    mutationFn: (v: { user_id: string; award_kind: "top_bfr" | "top_delta"; bfr_at_award: number; bfr_delta: number }) =>
      finFn({ data: { organization_id: orgId, year, month, ...v } }),
    onSuccess: () => {
      toast.success("Player of the Month gespeichert.");
      qc.invalidateQueries({ queryKey: ["potm-candidates", orgId, year, month] });
      qc.invalidateQueries({ queryKey: ["hof", orgId] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Fehler"),
  });

  const candidates = q.data?.candidates ?? [];
  const awards = q.data?.awards ?? [];
  const awardByKind = new Map<string, any>();
  for (const a of awards) awardByKind.set(a.award_kind, a);

  const topBFR = useMemo(() => [...candidates].sort((a, b) => b.bfr_end - a.bfr_end)[0], [candidates]);
  const topDelta = useMemo(() => [...candidates].sort((a, b) => b.bfr_delta - a.bfr_delta)[0], [candidates]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={month}
          onChange={(e) => setMonth(Number(e.target.value))}
          className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm"
        >
          {MONTHS_DE.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
        </select>
        <select
          value={year}
          onChange={(e) => setYear(Number(e.target.value))}
          className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm"
        >
          {[year + 1, year, year - 1, year - 2].map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>

      {q.isLoading ? (
        <div className="grid place-items-center rounded-2xl border border-border bg-card p-10">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : candidates.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">
          Keine Kandidaten in {MONTHS_DE[month - 1]} {year}.
        </div>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <AwardCard
              label="Höchstes BFR"
              icon={<Trophy className="h-4 w-4" />}
              candidate={topBFR}
              current={awardByKind.get("top_bfr")}
              mainValue={topBFR?.bfr_end}
              subValue={null}
              onSet={() => topBFR && mut.mutate({
                user_id: topBFR.user_id,
                award_kind: "top_bfr",
                bfr_at_award: topBFR.bfr_end,
                bfr_delta: topBFR.bfr_delta,
              })}
              busy={mut.isPending}
            />
            <AwardCard
              label="Größter Fortschritt"
              icon={<TrendingUp className="h-4 w-4" />}
              candidate={topDelta}
              current={awardByKind.get("top_delta")}
              mainValue={topDelta?.bfr_end}
              subValue={topDelta ? `+${topDelta.bfr_delta} BFR` : null}
              onSet={() => topDelta && mut.mutate({
                user_id: topDelta.user_id,
                award_kind: "top_delta",
                bfr_at_award: topDelta.bfr_end,
                bfr_delta: topDelta.bfr_delta,
              })}
              busy={mut.isPending}
            />
          </div>

          <div>
            <div className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.3em] text-muted-foreground">
              Alle Kandidaten
            </div>
            <div className="space-y-1.5">
              {candidates.map((c: any) => (
                <div key={c.user_id} className="flex items-center gap-3 rounded-xl border border-border bg-card p-3">
                  {c.avatar_url ? (
                    <img src={c.avatar_url} alt="" className="h-9 w-9 rounded-full object-cover" />
                  ) : (
                    <div className="grid h-9 w-9 place-items-center rounded-full bg-muted text-xs font-bold">
                      {(c.display_name ?? "?").slice(0, 2).toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold">{c.display_name ?? "Unbenannt"}</div>
                    <div className="text-[11px] text-muted-foreground">{c.position_key ?? "—"}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-black leading-none">{c.bfr_end}</div>
                    <div className={`text-[10px] font-bold uppercase tracking-wider ${c.bfr_delta > 0 ? "text-emerald-400" : c.bfr_delta < 0 ? "text-red-400" : "text-muted-foreground"}`}>
                      {c.bfr_delta > 0 ? `+${c.bfr_delta}` : c.bfr_delta}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function AwardCard({
  label, icon, candidate, current, mainValue, subValue, onSet, busy,
}: {
  label: string;
  icon: React.ReactNode;
  candidate: any;
  current: any;
  mainValue: number | undefined;
  subValue: string | null;
  onSet: () => void;
  busy: boolean;
}) {
  const isSet = current && candidate && current.user_id === candidate.user_id;
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.3em] text-muted-foreground">
        {icon}
        {label}
      </div>
      {!candidate ? (
        <div className="text-sm text-muted-foreground">Keine Daten.</div>
      ) : (
        <>
          <div className="flex items-center gap-3">
            {candidate.avatar_url ? (
              <img src={candidate.avatar_url} alt="" className="h-12 w-12 rounded-full object-cover" />
            ) : (
              <div className="grid h-12 w-12 place-items-center rounded-full bg-muted text-sm font-bold">
                {(candidate.display_name ?? "?").slice(0, 2).toUpperCase()}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold">{candidate.display_name ?? "Unbenannt"}</div>
              <div className="text-[11px] text-muted-foreground">{candidate.position_key ?? "—"}</div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-black leading-none">{mainValue}</div>
              {subValue && <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">{subValue}</div>}
            </div>
          </div>
          <button
            type="button"
            onClick={onSet}
            disabled={busy}
            className={`mt-3 w-full rounded-full px-3 py-1.5 text-xs font-bold uppercase tracking-wider transition ${
              isSet ? "bg-emerald-600 text-white" : "bg-bulls-red text-white hover:opacity-90"
            } disabled:opacity-50`}
          >
            {busy ? <Loader2 className="mx-auto h-3.5 w-3.5 animate-spin" /> : isSet ? "Ausgezeichnet ✓" : "Auszeichnen"}
          </button>
          {current && !isSet && (
            <div className="mt-1.5 text-center text-[10px] text-muted-foreground">
              Aktuell: anderer Spieler ausgezeichnet
            </div>
          )}
        </>
      )}
    </div>
  );
}

// -------------------- Hall of Fame --------------------

function HallOfFame({ orgId }: { orgId: string }) {
  const fn = useServerFn(getPlayerCardHallOfFame);
  const q = useQuery({
    queryKey: ["hof", orgId],
    queryFn: () => fn({ data: { organization_id: orgId } }),
    enabled: !!orgId,
  });

  const awards = q.data?.awards ?? [];

  if (q.isLoading) {
    return (
      <div className="grid place-items-center rounded-2xl border border-border bg-card p-10">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (awards.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">
        Noch keine Auszeichnungen vergeben.
      </div>
    );
  }

  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {awards.map((a: any) => (
        <div key={a.id} className="flex items-center gap-3 rounded-xl border border-border bg-card p-3">
          <div className="grid h-10 w-10 place-items-center rounded-lg bg-gradient-to-br from-yellow-500 to-amber-400 text-white shadow">
            {a.award_kind === "top_delta" ? <TrendingUp className="h-4 w-4" /> : <Crown className="h-4 w-4" />}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold">
              {a.profile?.display_name ?? a.profile?.nickname ?? "Unbenannt"}
            </div>
            <div className="text-[11px] text-muted-foreground">
              {MONTHS_DE[a.month - 1]} {a.year} · {a.award_kind === "top_delta" ? "Größter Fortschritt" : "Höchstes BFR"}
              {a.team?.name ? ` · ${a.team.name}` : ""}
            </div>
          </div>
          <div className="text-right">
            <div className="text-lg font-black leading-none">{a.bfr_at_award}</div>
            {a.award_kind === "top_delta" && a.bfr_delta > 0 && (
              <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">+{a.bfr_delta}</div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
