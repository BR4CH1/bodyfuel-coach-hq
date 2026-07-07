import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import {
  listTeamPositionGroups,
  listTeamAthletesForAssign,
} from "@/lib/organizations/roster-schedule.functions";

export type AssignScope = "team" | "group" | "athlete";

export type PickerValue = {
  scope: AssignScope;
  team_id: string | null;
  position_group: string | null;
  athlete_user_id: string | null;
  athlete_name: string | null;
};

/**
 * Kaskaden-Selector: Ganzes Team / Positionsgruppe / Einzelner Spieler.
 * Auf jeder Ebene kann gestoppt werden. Bei Einzelspieler mit Live-Suche.
 */
export function TeamGroupAthletePicker({
  orgId,
  teams,
  value,
  onChange,
  showScope = true,
  className = "",
}: {
  orgId: string;
  teams: { id: string; name: string }[];
  value: PickerValue;
  onChange: (v: PickerValue) => void;
  showScope?: boolean;
  className?: string;
}) {
  const listGroups = useServerFn(listTeamPositionGroups);
  const listAthletes = useServerFn(listTeamAthletesForAssign);

  const [query, setQuery] = useState("");

  const groupsQ = useQuery({
    queryKey: ["team-position-groups", orgId, value.team_id],
    queryFn: () =>
      value.team_id
        ? listGroups({ data: { organization_id: orgId, team_id: value.team_id } })
        : Promise.resolve([]),
    enabled: !!value.team_id && (value.scope === "group" || value.scope === "athlete"),
  });

  const athletesQ = useQuery({
    queryKey: [
      "team-athletes-assign",
      orgId,
      value.team_id,
      value.position_group,
      query,
    ],
    queryFn: () =>
      value.team_id
        ? listAthletes({
            data: {
              organization_id: orgId,
              team_id: value.team_id,
              position_group: value.position_group || null,
              query: query || null,
            },
          })
        : Promise.resolve([]),
    enabled: !!value.team_id && value.scope === "athlete",
  });

  // Reset dependent fields when scope or team changes
  useEffect(() => {
    if (value.scope === "team" && (value.position_group || value.athlete_user_id)) {
      onChange({ ...value, position_group: null, athlete_user_id: null, athlete_name: null });
    }
    if (value.scope === "group" && value.athlete_user_id) {
      onChange({ ...value, athlete_user_id: null, athlete_name: null });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value.scope, value.team_id]);

  const groups = (groupsQ.data as any[]) ?? [];
  const athletes = (athletesQ.data as any[]) ?? [];

  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      {showScope && (
        <select
          value={value.scope}
          onChange={(e) =>
            onChange({ ...value, scope: e.target.value as AssignScope })
          }
          className="rounded border border-border bg-background px-2 py-1 text-sm"
          title="Zielebene"
        >
          <option value="team">Ganzes Team</option>
          <option value="group">Positionsgruppe</option>
          <option value="athlete">Einzelner Spieler</option>
        </select>
      )}

      <select
        value={value.team_id ?? ""}
        onChange={(e) =>
          onChange({ ...value, team_id: e.target.value || null })
        }
        className="rounded border border-border bg-background px-2 py-1 text-sm"
      >
        <option value="">Team wählen…</option>
        {teams.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
          </option>
        ))}
      </select>

      {(value.scope === "group" || value.scope === "athlete") && value.team_id && (
        <select
          value={value.position_group ?? ""}
          onChange={(e) =>
            onChange({ ...value, position_group: e.target.value || null })
          }
          className="rounded border border-border bg-background px-2 py-1 text-sm"
          disabled={groupsQ.isLoading}
        >
          <option value="">
            {value.scope === "group" ? "Position wählen…" : "Alle Positionen"}
          </option>
          {groups.map((g) => (
            <option key={g.position_group} value={g.position_group}>
              {g.position_group} ({g.athlete_count})
            </option>
          ))}
        </select>
      )}

      {value.scope === "athlete" && value.team_id && (
        <AthleteSearchCombo
          athletes={athletes}
          query={query}
          setQuery={setQuery}
          loading={athletesQ.isLoading}
          selectedId={value.athlete_user_id}
          onSelect={(a) =>
            onChange({
              ...value,
              athlete_user_id: a.user_id,
              athlete_name: a.name,
            })
          }
        />
      )}
    </div>
  );
}

function AthleteSearchCombo({
  athletes,
  query,
  setQuery,
  loading,
  selectedId,
  onSelect,
}: {
  athletes: { user_id: string; name: string; position: string | null; jersey_number: number | null }[];
  query: string;
  setQuery: (v: string) => void;
  loading: boolean;
  selectedId: string | null;
  onSelect: (a: { user_id: string; name: string }) => void;
}) {
  const [open, setOpen] = useState(false);
  const selected = athletes.find((a) => a.user_id === selectedId);
  return (
    <div className="relative min-w-[220px]">
      <div className="flex items-center gap-1 rounded border border-border bg-background px-2 py-1">
        <Search className="h-3.5 w-3.5 text-muted-foreground" />
        <input
          value={query}
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          placeholder={selected?.name ?? "Spieler suchen…"}
          className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
        {selected && !query && (
          <span className="text-[10px] font-semibold uppercase text-primary">
            {selected.name.split(" ").slice(-1)[0]}
          </span>
        )}
      </div>
      {open && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-64 overflow-y-auto rounded border border-border bg-popover text-sm shadow-lg">
          {loading ? (
            <div className="px-3 py-2 text-xs text-muted-foreground">Lädt…</div>
          ) : athletes.length === 0 ? (
            <div className="px-3 py-2 text-xs text-muted-foreground">
              Keine Spieler gefunden.
            </div>
          ) : (
            athletes.map((a) => (
              <button
                type="button"
                key={a.user_id}
                onMouseDown={(e) => {
                  e.preventDefault();
                  onSelect({ user_id: a.user_id, name: a.name });
                  setQuery("");
                  setOpen(false);
                }}
                className={`flex w-full items-center justify-between px-3 py-2 text-left hover:bg-muted/50 ${
                  a.user_id === selectedId ? "bg-primary/10" : ""
                }`}
              >
                <span className="font-medium">{a.name}</span>
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  {a.position ?? "—"}
                  {a.jersey_number != null ? ` · #${a.jersey_number}` : ""}
                </span>
              </button>
            ))
          )}
        </div>
      )}
      {open && (
        <button
          type="button"
          aria-hidden
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-40 cursor-default bg-transparent"
        />
      )}
    </div>
  );
}
