import { useMemo, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  UserPlus,
  Copy,
  X,
  MoreHorizontal,
  Search,
  ChevronRight,
  Users,
  Activity,
  ClipboardList,
  ShieldCheck,
} from "lucide-react";
import { getOrgAthletesOnboardingAudit } from "@/lib/organizations/task-engine.functions";
import { UserAvatar } from "@/components/bodyfuel/UserAvatar";
import {
  canManageRoster,
  createAthleteInvite,
  createPendingRosterAthlete,
  listPendingRosterAthletes,
  deletePendingRosterAthlete,
  removeAthleteFromTeam,
  searchExistingAthletes,
  addExistingUserToTeam,
} from "@/lib/organizations/roster.functions";


type Team = { id: string; name: string };

export function AthletesTab({
  orgId,
  teamFilter,
  teams,
  allowedUserIds,
  onClearFilter,
  onTeamFilterChange,
}: {
  orgId: string;
  teamFilter: string | null;
  teams: Team[];
  allowedUserIds: Set<string> | null;
  onClearFilter: () => void;
  onTeamFilterChange?: (teamId: string | null) => void;
}) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const fetchAudit = useServerFn(getOrgAthletesOnboardingAudit);
  const fetchPerm = useServerFn(canManageRoster);
  const fetchPending = useServerFn(listPendingRosterAthletes);

  const { data: audit, isLoading } = useQuery({
    queryKey: ["org-onboarding-audit", orgId],
    queryFn: () => fetchAudit({ data: { organization_id: orgId } }),
  });
  const { data: perm } = useQuery({
    queryKey: ["roster-perm", orgId],
    queryFn: () => fetchPerm({ data: { organization_id: orgId } }),
    staleTime: 60_000,
  });
  const { data: pending = [] } = useQuery({
    queryKey: ["roster-pending", orgId],
    queryFn: () => fetchPending({ data: { organization_id: orgId } }),
    enabled: !!perm?.ok,
  });

  const [dialogOpen, setDialogOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  if (isLoading || !audit) return <div className="text-xs text-muted-foreground">Lädt…</div>;

  const rows = allowedUserIds
    ? (audit.athletes as any[]).filter((a) => allowedUserIds.has(a.user_id))
    : (audit.athletes as any[]);
  const [posGroup, setPosGroup] = useState<"all" | "offense" | "defense" | "special">("all");

  const normalizedSearch = searchTerm.trim().toLowerCase();

  const withGroup = useMemo(
    () => rows.map((a) => ({ ...a, __group: positionGroup(a.position) })),
    [rows],
  );

  const bySearch = normalizedSearch
    ? withGroup.filter((a) =>
        [a.name, a.position, a.team_name, ...(a.missing ?? [])]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(normalizedSearch),
      )
    : withGroup;
  const visibleRows = posGroup === "all" ? bySearch : bySearch.filter((a) => a.__group === posGroup);

  const visiblePending = normalizedSearch
    ? (pending as any[]).filter((p) =>
        [p.first_name, p.last_name, p.primary_position, p.jersey_number ? `#${p.jersey_number}` : null]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(normalizedSearch),
      )
    : (pending as any[]);

  const filterTeam = teamFilter ? teams.find((t) => t.id === teamFilter) : null;
  const canManage = !!perm?.ok;

  const totalCount = rows.length;
  const activeCount = rows.filter((a) => a.derived_complete && a.status !== "inactive").length;
  const openOnboarding = rows.filter((a) => !a.derived_complete).length;
  const teamsCount = teams.length;

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["org-onboarding-audit", orgId] });
    qc.invalidateQueries({ queryKey: ["roster-pending", orgId] });
    qc.invalidateQueries({ queryKey: ["coach-org-detail", orgId] });
  };

  const grouped = useMemo(() => {
    const g: Record<"offense" | "defense" | "special" | "other", typeof visibleRows> = {
      offense: [],
      defense: [],
      special: [],
      other: [],
    };
    for (const a of visibleRows) g[a.__group as keyof typeof g].push(a);
    return g;
  }, [visibleRows]);

  const showGrouped = posGroup === "all" && !normalizedSearch;

  return (
    <div className="space-y-4">
      {/* Header */}
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-display text-2xl font-bold uppercase tracking-tight text-foreground">
            Athleten
          </h2>
          <p className="mt-0.5 text-[10px] font-bold uppercase tracking-[0.24em] text-muted-foreground">
            Kader · Aktivität · Entwicklung
          </p>
        </div>
        {canManage && (
          <button
            onClick={() => setDialogOpen(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-bulls-red px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-white shadow-bulls transition hover:brightness-110"
          >
            <UserPlus className="h-4 w-4" />
            Athlet hinzufügen
          </button>
        )}
      </header>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <SummaryCard icon={<Users className="h-4 w-4" />} label="Athleten" value={String(totalCount)} sub="Gesamt" />
        <SummaryCard
          icon={<Activity className="h-4 w-4 text-green-500" />}
          label="Aktiv"
          value={String(activeCount)}
          sub={totalCount > 0 ? `${Math.round((activeCount / totalCount) * 100)} %` : "—"}
          accent="green"
        />
        <SummaryCard
          icon={<ClipboardList className="h-4 w-4 text-orange-400" />}
          label="Onboarding offen"
          value={String(openOnboarding)}
          sub={totalCount > 0 ? `${Math.round((openOnboarding / totalCount) * 100)} %` : "—"}
          accent="orange"
        />
        <SummaryCard icon={<ShieldCheck className="h-4 w-4" />} label="Teams" value={String(teamsCount)} sub="Teams" />
      </div>

      {/* Team Chips */}
      {teams.length > 1 && (
        <div className="-mx-4 overflow-x-auto px-4">
          <div className="flex min-w-max gap-1.5">
            <TeamChip
              label="Alle"
              active={!teamFilter}
              onClick={() => (onTeamFilterChange ? onTeamFilterChange(null) : onClearFilter())}
            />
            {teams.map((t) => (
              <TeamChip
                key={t.id}
                label={t.name}
                active={teamFilter === t.id}
                onClick={() => onTeamFilterChange?.(t.id)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Search + Position group */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <label className="relative block flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Athlet suchen…"
            className="w-full rounded-lg border border-[#252525] bg-[#0b0b0b] py-2.5 pl-9 pr-3 text-sm outline-none transition focus:border-bulls-red"
          />
        </label>
        <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <div className="flex min-w-max gap-1.5">
            {(
              [
                ["all", "Alle"],
                ["offense", "Offense"],
                ["defense", "Defense"],
                ["special", "Special"],
              ] as const
            ).map(([k, l]) => (
              <TeamChip key={k} label={l} active={posGroup === k} onClick={() => setPosGroup(k)} />
            ))}
          </div>
        </div>
      </div>

      {filterTeam && (
        <div className="text-[11px] text-muted-foreground">
          {rows.length} Athlet{rows.length === 1 ? "" : "en"} im Team{" "}
          <strong className="text-foreground">{filterTeam.name}</strong>.
        </div>
      )}

      {/* List */}
      {visibleRows.length === 0 && visiblePending.length === 0 ? (
        <div className="rounded-xl border border-[#252525] bg-[#0b0b0b] p-8 text-center text-sm text-muted-foreground">
          {normalizedSearch
            ? `Keine Ergebnisse für „${searchTerm}“.`
            : posGroup !== "all"
            ? "Keine Athleten in dieser Positionsgruppe."
            : filterTeam
            ? "Keine Athleten in diesem Team."
            : "Noch keine Athleten."}
        </div>
      ) : showGrouped ? (
        <div className="space-y-4">
          {(["offense", "defense", "special", "other"] as const).map((g) =>
            grouped[g].length > 0 ? (
              <PositionGroupSection
                key={g}
                title={GROUP_LABEL[g]}
                count={grouped[g].length}
                rows={grouped[g]}
                orgId={orgId}
                canManage={canManage}
                onInvalidate={invalidate}
                navigate={navigate}
              />
            ) : null,
          )}
          {visiblePending.length > 0 && (
            <PendingList pending={visiblePending} canManage={canManage} onInvalidate={invalidate} />
          )}
        </div>
      ) : (
        <div className="space-y-2">
          <AthleteRowList
            rows={visibleRows}
            orgId={orgId}
            canManage={canManage}
            onInvalidate={invalidate}
            navigate={navigate}
          />
          {visiblePending.length > 0 && (
            <PendingList pending={visiblePending} canManage={canManage} onInvalidate={invalidate} />
          )}
        </div>
      )}

      {dialogOpen && (
        <AddAthleteDialog
          orgId={orgId}
          teams={teams}
          onClose={() => setDialogOpen(false)}
          onDone={() => {
            invalidate();
            setDialogOpen(false);
          }}
        />
      )}
    </div>
  );
}

// ---------- Position Groups (zentrale Mapping-Funktion) ----------

import { positionGroup as _positionGroup, POSITION_GROUP_LABEL } from "@/lib/football-positions";

const GROUP_LABEL: Record<string, string> = {
  offense: POSITION_GROUP_LABEL.offense,
  defense: POSITION_GROUP_LABEL.defense,
  special: POSITION_GROUP_LABEL.special,
  other: POSITION_GROUP_LABEL.other,
};

function positionGroup(pos: string | null | undefined): "offense" | "defense" | "special" | "other" {
  return _positionGroup(pos);
}


function initials(name: string) {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((s) => s[0]?.toUpperCase())
      .join("") || "?"
  );
}

function SummaryCard({
  icon,
  label,
  value,
  sub,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub: string;
  accent?: "green" | "orange";
}) {
  const valueCls =
    accent === "green" ? "text-green-500" : accent === "orange" ? "text-orange-400" : "text-foreground";
  return (
    <div className="rounded-xl border border-[#252525] bg-[#0b0b0b] p-3">
      <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
        {icon}
        <span className="truncate">{label}</span>
      </div>
      <div className={`mt-1 font-display text-2xl font-bold leading-none ${valueCls}`}>{value}</div>
      <div className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{sub}</div>
    </div>
  );
}

function PositionGroupSection({
  title,
  count,
  rows,
  orgId,
  canManage,
  onInvalidate,
  navigate,
}: {
  title: string;
  count: number;
  rows: any[];
  orgId: string;
  canManage: boolean;
  onInvalidate: () => void;
  navigate: ReturnType<typeof useNavigate>;
}) {
  return (
    <section>
      <h3 className="mb-2 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.2em] text-bulls-red">
        <span className="inline-block h-1.5 w-1.5 rounded-full bg-bulls-red" />
        {title}
        <span className="text-muted-foreground">({count})</span>
      </h3>
      <AthleteRowList
        rows={rows}
        orgId={orgId}
        canManage={canManage}
        onInvalidate={onInvalidate}
        navigate={navigate}
      />
    </section>
  );
}

function AthleteRowList({
  rows,
  orgId,
  canManage,
  onInvalidate,
  navigate,
}: {
  rows: any[];
  orgId: string;
  canManage: boolean;
  onInvalidate: () => void;
  navigate: ReturnType<typeof useNavigate>;
}) {
  return (
    <ul className="divide-y divide-[#1a1a1a] overflow-hidden rounded-xl border border-[#252525] bg-[#0b0b0b]">
      {rows.map((a) => (
        <li key={a.user_id} className="relative">
          <Link
            to="/coach/teams/$orgId/athletes/$userId"
            params={{ orgId, userId: a.user_id }}
            preload="intent"
            onClick={(event) => {
              if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
              event.preventDefault();
              navigate({
                to: "/coach/teams/$orgId/athletes/$userId",
                params: { orgId, userId: a.user_id },
              });
            }}
            className="flex touch-manipulation items-center gap-3 px-3 py-3 transition hover:bg-[#111111] active:bg-[#141414]"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-bulls-red/15 font-display text-sm font-bold text-bulls-red">
              {initials(a.name)}
            </div>
            <div className="min-w-0 flex-1 pr-8">
              <div className="flex items-center gap-2">
                <span className="truncate text-sm font-semibold text-foreground">{a.name}</span>
                {a.jersey_number != null && (
                  <span className="text-[10px] font-bold text-muted-foreground">#{a.jersey_number}</span>
                )}
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px]">
                {a.position && (
                  <span className="rounded border border-bulls-red/40 bg-bulls-red/10 px-1.5 py-0.5 font-bold uppercase tracking-wider text-bulls-red">
                    {a.position}
                  </span>
                )}
                {a.team_name && (
                  <span className="font-semibold uppercase tracking-wider text-muted-foreground">
                    {a.team_name}
                  </span>
                )}
                {a.derived_complete ? (
                  <span className="rounded border border-green-500/30 bg-green-500/10 px-1.5 py-0.5 font-bold uppercase tracking-wider text-green-500">
                    Aktiv
                  </span>
                ) : (
                  <span className="rounded border border-orange-500/30 bg-orange-500/10 px-1.5 py-0.5 font-bold uppercase tracking-wider text-orange-400">
                    Onboarding offen
                  </span>
                )}
                {!a.derived_complete && a.missing?.length > 0 && (
                  <span className="truncate text-muted-foreground">· fehlt: {a.missing.slice(0, 2).join(", ")}</span>
                )}
              </div>
            </div>
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
          </Link>
          {canManage && a.team_id && (
            <div className="absolute right-9 top-1/2 -translate-y-1/2">
              <RowActions
                orgId={orgId}
                userId={a.user_id}
                teamId={a.team_id}
                name={a.name}
                onDone={onInvalidate}
              />
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}

function PendingList({
  pending,
  canManage,
  onInvalidate,
}: {
  pending: any[];
  canManage: boolean;
  onInvalidate: () => void;
}) {
  return (
    <section>
      <h3 className="mb-2 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.2em] text-orange-400">
        <span className="inline-block h-1.5 w-1.5 rounded-full bg-orange-400" />
        Einladungen ausstehend
        <span className="text-muted-foreground">({pending.length})</span>
      </h3>
      <ul className="divide-y divide-[#1a1a1a] overflow-hidden rounded-xl border border-[#252525] bg-[#0b0b0b]">
        {pending.map((p) => (
          <li key={`pending-${p.id}`} className="flex items-center gap-3 px-3 py-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-orange-500/15 font-display text-sm font-bold text-orange-400">
              {initials(`${p.first_name ?? ""} ${p.last_name ?? ""}`.trim() || "?")}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold">
                {p.first_name} {p.last_name}
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px]">
                {p.primary_position && (
                  <span className="rounded border border-bulls-red/40 bg-bulls-red/10 px-1.5 py-0.5 font-bold uppercase tracking-wider text-bulls-red">
                    {p.primary_position}
                  </span>
                )}
                {p.jersey_number && (
                  <span className="font-bold text-muted-foreground">#{p.jersey_number}</span>
                )}
                <span className="rounded border border-orange-500/30 bg-orange-500/10 px-1.5 py-0.5 font-bold uppercase tracking-wider text-orange-400">
                  Einladung ausstehend
                </span>
              </div>
            </div>
            {canManage && <PendingActions id={p.id} onDone={onInvalidate} />}
          </li>
        ))}
      </ul>
    </section>
  );
}

function TeamChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider transition ${
        active
          ? "border-bulls-red bg-bulls-red text-white shadow-bulls"
          : "border-[#252525] bg-[#0b0b0b] text-muted-foreground hover:border-bulls-red/40 hover:text-foreground"
      }`}
    >
      {label}
    </button>
  );
}

function RowActions({
  orgId,
  userId,
  teamId,
  name,
  onDone,
}: {
  orgId: string;
  userId: string;
  teamId: string;
  name: string;
  onDone: () => void;
}) {
  const [open, setOpen] = useState(false);
  const removeFn = useServerFn(removeAthleteFromTeam);
  const mut = useMutation({
    mutationFn: () =>
      removeFn({ data: { organization_id: orgId, user_id: userId, team_id: teamId } }),
    onSuccess: () => {
      setOpen(false);
      onDone();
    },
  });
  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>
      {open && (
        <div className="absolute right-0 z-20 mt-1 w-56 rounded-lg border border-border bg-popover p-1 shadow-lg">
          <button
            disabled={mut.isPending}
            onClick={() => {
              if (
                window.confirm(
                  `${name} aus dem Team entfernen? Der Account bleibt erhalten, nur die Team-Zuordnung wird deaktiviert.`,
                )
              )
                mut.mutate();
            }}
            className="w-full rounded px-3 py-2 text-left text-xs hover:bg-muted"
          >
            Aus Team entfernen
          </button>
        </div>
      )}
    </div>
  );
}

function PendingActions({ id, onDone }: { id: string; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const del = useServerFn(deletePendingRosterAthlete);
  const mut = useMutation({
    mutationFn: () => del({ data: { id } }),
    onSuccess: () => {
      setOpen(false);
      onDone();
    },
  });
  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>
      {open && (
        <div className="absolute right-0 z-20 mt-1 w-52 rounded-lg border border-border bg-popover p-1 shadow-lg">
          <button
            disabled={mut.isPending}
            onClick={() => mut.mutate()}
            className="w-full rounded px-3 py-2 text-left text-xs text-red-500 hover:bg-muted"
          >
            Kaderplatz löschen
          </button>
        </div>
      )}
    </div>
  );
}

function AddAthleteDialog({
  orgId,
  teams,
  onClose,
  onDone,
}: {
  orgId: string;
  teams: Team[];
  onClose: () => void;
  onDone: () => void;
}) {
  const [mode, setMode] = useState<"choose" | "invite" | "manual" | "existing">("choose");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-lg rounded-xl border border-border bg-card p-5 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-display text-lg font-bold">
            {mode === "choose" && "Athlet hinzufügen"}
            {mode === "invite" && "Athlet einladen"}
            {mode === "manual" && "Athlet manuell anlegen"}
            {mode === "existing" && "Existierenden Nutzer hinzufügen"}
          </h3>
          <button onClick={onClose} className="rounded p-1 text-muted-foreground hover:bg-muted">
            <X className="h-4 w-4" />
          </button>
        </div>

        {mode === "choose" && (
          <div className="space-y-2">
            <p className="mb-3 text-xs text-muted-foreground">Wie möchtest du den Athleten hinzufügen?</p>
            <button
              onClick={() => setMode("existing")}
              className="block w-full rounded-lg border border-border p-3 text-left hover:bg-muted"
            >
              <div className="text-sm font-semibold">Existierenden BODYFUEL-Nutzer hinzufügen</div>
              <div className="text-xs text-muted-foreground">
                Nach E-Mail oder Name suchen und direkt zum Team hinzufügen.
              </div>
            </button>
            <button
              onClick={() => setMode("invite")}
              className="block w-full rounded-lg border border-border p-3 text-left hover:bg-muted"
            >
              <div className="text-sm font-semibold">Athlet einladen</div>
              <div className="text-xs text-muted-foreground">
                Einladungslink per E-Mail senden und Profil selbst vervollständigen lassen.
              </div>
            </button>
            <button
              onClick={() => setMode("manual")}
              className="block w-full rounded-lg border border-border p-3 text-left hover:bg-muted"
            >
              <div className="text-sm font-semibold">Athlet manuell anlegen</div>
              <div className="text-xs text-muted-foreground">
                Spieler direkt zum Kader hinzufügen. Onboarding kann später per Einladung ergänzt werden.
              </div>
            </button>
          </div>
        )}

        {mode === "invite" && <InviteForm orgId={orgId} teams={teams} onDone={onDone} />}
        {mode === "manual" && <ManualForm orgId={orgId} teams={teams} onDone={onDone} />}
        {mode === "existing" && <ExistingUserForm orgId={orgId} teams={teams} onDone={onDone} />}
      </div>
    </div>
  );
}

function ExistingUserForm({
  orgId,
  teams,
  onDone,
}: {
  orgId: string;
  teams: Team[];
  onDone: () => void;
}) {
  const search = useServerFn(searchExistingAthletes);
  const add = useServerFn(addExistingUserToTeam);
  const [query, setQuery] = useState("");
  const [teamId, setTeamId] = useState<string>(teams[0]?.id ?? "");
  const [primary, setPrimary] = useState("");
  const [secondary, setSecondary] = useState("");
  const [jersey, setJersey] = useState("");
  const [selected, setSelected] = useState<{ user_id: string; display_name: string | null; email: string | null } | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const searchMut = useMutation({
    mutationFn: () => search({ data: { organization_id: orgId, query: query.trim() } }),
    onError: (e: any) => setErr(e.message ?? String(e)),
  });

  const addMut = useMutation({
    mutationFn: async () => {
      setErr(null);
      if (!selected) throw new Error("Bitte einen Nutzer auswählen.");
      if (!teamId) throw new Error("Bitte ein Team auswählen.");
      return add({
        data: {
          organization_id: orgId,
          team_id: teamId,
          user_id: selected.user_id,
          primary_position: primary || null,
          secondary_position: secondary || null,
          jersey_number: jersey ? parseInt(jersey, 10) : null,
        },
      });
    },
    onSuccess: onDone,
    onError: (e: any) => setErr(e.message ?? String(e)),
  });

  return (
    <div className="space-y-3">
      {!selected ? (
        <>
          <Field label="Suche nach E-Mail oder Name *">
            <div className="flex gap-2">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && query.trim().length >= 2) searchMut.mutate();
                }}
                placeholder="z. B. max@... oder Max Muster"
                className="flex-1 rounded border border-border bg-background px-2 py-1.5 text-sm"
              />
              <button
                disabled={searchMut.isPending || query.trim().length < 2}
                onClick={() => searchMut.mutate()}
                className="inline-flex items-center gap-1 rounded border border-border px-3 py-1.5 text-xs font-semibold uppercase tracking-wider hover:bg-muted disabled:opacity-50"
              >
                <Search className="h-3 w-3" /> Suchen
              </button>
            </div>
          </Field>

          {searchMut.data && (
            <div className="max-h-64 overflow-y-auto rounded border border-border">
              {(searchMut.data as any[]).length === 0 ? (
                <div className="p-3 text-center text-xs text-muted-foreground">
                  Keine passenden Nutzer gefunden.
                </div>
              ) : (
                (searchMut.data as any[]).map((u) => (
                  <button
                    key={u.user_id}
                    disabled={u.already_in_org}
                    onClick={() =>
                      setSelected({
                        user_id: u.user_id,
                        display_name: u.display_name,
                        email: u.email,
                      })
                    }
                    className="flex w-full items-center justify-between border-b border-border p-2 text-left last:border-0 hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <div>
                      <div className="text-sm font-semibold">{u.display_name ?? "(kein Name)"}</div>
                      <div className="text-[11px] text-muted-foreground">{u.email ?? "—"}</div>
                    </div>
                    {u.already_in_org && (
                      <span className="rounded bg-muted px-2 py-0.5 text-[9px] font-bold uppercase text-muted-foreground">
                        bereits im Verein
                      </span>
                    )}
                  </button>
                ))
              )}
            </div>
          )}
        </>
      ) : (
        <>
          <div className="flex items-center justify-between rounded border border-border bg-muted/40 p-2">
            <div>
              <div className="text-sm font-semibold">{selected.display_name ?? "(kein Name)"}</div>
              <div className="text-[11px] text-muted-foreground">{selected.email ?? "—"}</div>
            </div>
            <button
              onClick={() => setSelected(null)}
              className="text-[11px] uppercase tracking-wider text-muted-foreground hover:text-foreground"
            >
              Ändern
            </button>
          </div>
          <Field label="Team *">
            <select
              value={teamId}
              onChange={(e) => setTeamId(e.target.value)}
              className="w-full rounded border border-border bg-background px-2 py-1.5 text-sm"
            >
              {teams.length === 0 && <option value="">Kein Team vorhanden</option>}
              {teams.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </Field>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Position">
              <input
                value={primary}
                onChange={(e) => setPrimary(e.target.value)}
                className="w-full rounded border border-border bg-background px-2 py-1.5 text-sm"
              />
            </Field>
            <Field label="Secondary">
              <input
                value={secondary}
                onChange={(e) => setSecondary(e.target.value)}
                className="w-full rounded border border-border bg-background px-2 py-1.5 text-sm"
              />
            </Field>
            <Field label="Nummer">
              <input
                type="number"
                value={jersey}
                onChange={(e) => setJersey(e.target.value)}
                className="w-full rounded border border-border bg-background px-2 py-1.5 text-sm"
              />
            </Field>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              disabled={addMut.isPending || !teamId}
              onClick={() => addMut.mutate()}
              className="rounded bg-primary px-4 py-2 text-xs font-semibold uppercase tracking-wider text-primary-foreground disabled:opacity-50"
            >
              {addMut.isPending ? "Füge hinzu…" : "Zum Team hinzufügen"}
            </button>
          </div>
        </>
      )}
      {err && <p className="text-xs text-red-500">{err}</p>}
    </div>
  );
}


function InviteForm({
  orgId,
  teams,
  onDone,
}: {
  orgId: string;
  teams: Team[];
  onDone: () => void;
}) {
  const invite = useServerFn(createAthleteInvite);
  const [teamId, setTeamId] = useState<string>(teams[0]?.id ?? "");
  const [email, setEmail] = useState("");
  const [primary, setPrimary] = useState("");
  const [secondary, setSecondary] = useState("");
  const [jersey, setJersey] = useState("");
  const [result, setResult] = useState<{ url: string } | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const mut = useMutation({
    mutationFn: async () => {
      setErr(null);
      const res = await invite({
        data: {
          organization_id: orgId,
          team_id: teamId,
          email: email.trim(),
          primary_position: primary || null,
          secondary_position: secondary || null,
          jersey_number: jersey ? parseInt(jersey, 10) : null,
        },
      });
      return res;
    },
    onSuccess: (r) => {
      const url = `${window.location.origin}/invite/${r.invite_token}`;
      setResult({ url });
    },
    onError: (e: any) => setErr(e.message ?? String(e)),
  });

  if (result) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-green-500">Einladung erstellt und E-Mail versendet.</p>
        <div className="rounded border border-border bg-muted/40 p-2 text-xs break-all">{result.url}</div>
        <div className="flex gap-2">
          <button
            onClick={() => navigator.clipboard.writeText(result.url)}
            className="inline-flex items-center gap-2 rounded border border-border px-3 py-1.5 text-xs font-semibold uppercase tracking-wider hover:bg-muted"
          >
            <Copy className="h-3 w-3" /> Link kopieren
          </button>
          <button
            onClick={onDone}
            className="ml-auto rounded bg-primary px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-primary-foreground"
          >
            Fertig
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <Field label="Team *">
        <select
          value={teamId}
          onChange={(e) => setTeamId(e.target.value)}
          className="w-full rounded border border-border bg-background px-2 py-1.5 text-sm"
        >
          {teams.length === 0 && <option value="">Kein Team vorhanden</option>}
          {teams.map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
      </Field>
      <Field label="E-Mail *">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="spieler@example.com"
          className="w-full rounded border border-border bg-background px-2 py-1.5 text-sm"
        />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Primary Position">
          <input
            value={primary}
            onChange={(e) => setPrimary(e.target.value)}
            placeholder="z. B. QB, WR"
            className="w-full rounded border border-border bg-background px-2 py-1.5 text-sm"
          />
        </Field>
        <Field label="Secondary">
          <input
            value={secondary}
            onChange={(e) => setSecondary(e.target.value)}
            className="w-full rounded border border-border bg-background px-2 py-1.5 text-sm"
          />
        </Field>
      </div>
      <Field label="Trikotnummer">
        <input
          type="number"
          value={jersey}
          onChange={(e) => setJersey(e.target.value)}
          className="w-32 rounded border border-border bg-background px-2 py-1.5 text-sm"
        />
      </Field>
      {err && <p className="text-xs text-red-500">{err}</p>}
      <div className="flex justify-end gap-2 pt-2">
        <button
          disabled={mut.isPending || !teamId || !email.trim()}
          onClick={() => mut.mutate()}
          className="rounded bg-primary px-4 py-2 text-xs font-semibold uppercase tracking-wider text-primary-foreground disabled:opacity-50"
        >
          {mut.isPending ? "Sende…" : "Einladung erstellen"}
        </button>
      </div>
    </div>
  );
}

function ManualForm({
  orgId,
  teams,
  onDone,
}: {
  orgId: string;
  teams: Team[];
  onDone: () => void;
}) {
  const create = useServerFn(createPendingRosterAthlete);
  const [teamId, setTeamId] = useState<string>(teams[0]?.id ?? "");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [dob, setDob] = useState("");
  const [heightCm, setHeightCm] = useState("");
  const [weightKg, setWeightKg] = useState("");
  const [primary, setPrimary] = useState("");
  const [secondary, setSecondary] = useState("");
  const [jersey, setJersey] = useState("");
  const [err, setErr] = useState<string | null>(null);

  const mut = useMutation({
    mutationFn: async () => {
      setErr(null);
      return create({
        data: {
          organization_id: orgId,
          team_id: teamId || null,
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          date_of_birth: dob || null,
          height_cm: heightCm ? parseInt(heightCm, 10) : null,
          weight_kg: weightKg ? parseFloat(weightKg) : null,
          primary_position: primary || null,
          secondary_position: secondary || null,
          jersey_number: jersey ? parseInt(jersey, 10) : null,
        },
      });
    },
    onSuccess: onDone,
    onError: (e: any) => setErr(e.message ?? String(e)),
  });

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Vorname *">
          <input
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            className="w-full rounded border border-border bg-background px-2 py-1.5 text-sm"
          />
        </Field>
        <Field label="Nachname *">
          <input
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            className="w-full rounded border border-border bg-background px-2 py-1.5 text-sm"
          />
        </Field>
      </div>
      <Field label="Team">
        <select
          value={teamId}
          onChange={(e) => setTeamId(e.target.value)}
          className="w-full rounded border border-border bg-background px-2 py-1.5 text-sm"
        >
          <option value="">— Kein Team —</option>
          {teams.map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
      </Field>
      <div className="grid grid-cols-3 gap-3">
        <Field label="Geburtsdatum">
          <input
            type="date"
            value={dob}
            onChange={(e) => setDob(e.target.value)}
            className="w-full rounded border border-border bg-background px-2 py-1.5 text-sm"
          />
        </Field>
        <Field label="Größe (cm)">
          <input
            type="number"
            value={heightCm}
            onChange={(e) => setHeightCm(e.target.value)}
            className="w-full rounded border border-border bg-background px-2 py-1.5 text-sm"
          />
        </Field>
        <Field label="Gewicht (kg)">
          <input
            type="number"
            step="0.1"
            value={weightKg}
            onChange={(e) => setWeightKg(e.target.value)}
            className="w-full rounded border border-border bg-background px-2 py-1.5 text-sm"
          />
        </Field>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <Field label="Position">
          <input
            value={primary}
            onChange={(e) => setPrimary(e.target.value)}
            className="w-full rounded border border-border bg-background px-2 py-1.5 text-sm"
          />
        </Field>
        <Field label="Secondary">
          <input
            value={secondary}
            onChange={(e) => setSecondary(e.target.value)}
            className="w-full rounded border border-border bg-background px-2 py-1.5 text-sm"
          />
        </Field>
        <Field label="Nummer">
          <input
            type="number"
            value={jersey}
            onChange={(e) => setJersey(e.target.value)}
            className="w-full rounded border border-border bg-background px-2 py-1.5 text-sm"
          />
        </Field>
      </div>
      <p className="rounded border border-border bg-muted/30 p-2 text-[11px] text-muted-foreground">
        Der Athlet erscheint zunächst als „Einladung ausstehend". Sobald er über eine E-Mail-Einladung
        seinen Account aktiviert, wird der Kaderplatz verknüpft.
      </p>
      {err && <p className="text-xs text-red-500">{err}</p>}
      <div className="flex justify-end gap-2 pt-2">
        <button
          disabled={mut.isPending || !firstName.trim() || !lastName.trim()}
          onClick={() => mut.mutate()}
          className="rounded bg-primary px-4 py-2 text-xs font-semibold uppercase tracking-wider text-primary-foreground disabled:opacity-50"
        >
          {mut.isPending ? "Speichere…" : "Kaderplatz anlegen"}
        </button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      {children}
    </label>
  );
}
