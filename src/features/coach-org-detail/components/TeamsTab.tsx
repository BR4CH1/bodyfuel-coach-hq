import { orgTerminology } from "@/lib/organizations/org-type";
import { useOrgTeams } from "@/features/coach-org-detail/hooks/useOrgTeams";
import { getTeamKpi } from "@/features/coach-org-detail/lib/team.logic";
import type { OrgTeamDetail, TeamKpi } from "@/features/coach-org-detail/types";

export function TeamsTab({
  orgId,
  orgSport,
  orgType,
  teams,
  teamKpis,
  onJumpToAthletes,
  onJoinLink,
}: {
  orgId: string;
  orgSport: string | null;
  orgType: string | null;
  teams: OrgTeamDetail[];
  teamKpis: TeamKpi[];
  onJumpToAthletes: (teamId: string) => void;
  onJoinLink: (team: { id: string; name: string }) => void;
}) {
  const term = orgTerminology(orgType);
  const teamForm = useOrgTeams({ orgId, orgSport, teamLabel: term.team });

  return (
    <div className="space-y-4">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          teamForm.submit();
        }}
        className="rounded-lg border border-border bg-card p-3 sm:p-4"
      >
        <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
          Neues {term.team} anlegen
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            value={teamForm.name}
            onChange={(event) => teamForm.setName(event.target.value)}
            placeholder={`${term.team}name (z. B. ${term.isFitnessStudio ? "Mobility-Gruppe" : "U19"})`}
            className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
            maxLength={80}
            required
          />
          <input
            value={teamForm.ageGroup}
            onChange={(event) => teamForm.setAgeGroup(event.target.value)}
            placeholder="Altersklasse (optional)"
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary sm:w-48"
            maxLength={40}
          />
          <button
            type="submit"
            disabled={teamForm.isCreating || teamForm.name.trim().length < 2}
            className="rounded-md bg-primary px-4 py-2 text-[11px] font-bold uppercase tracking-wider text-primary-foreground transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {teamForm.isCreating ? "Legt an…" : `${term.team} anlegen`}
          </button>
        </div>
        {teamForm.error && <div className="mt-2 text-xs text-red-500">{teamForm.error}</div>}
      </form>

      <ul className="grid gap-2 sm:grid-cols-2">
        {teams.map((team) => {
          const kpi = getTeamKpi(teamKpis, team.id);
          return (
            <li key={team.id} className="rounded-lg border border-border bg-card p-4">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className="font-semibold">{team.name}</div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    {team.sport ?? "—"} {team.age_group ? `· ${team.age_group}` : ""}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <button
                    type="button"
                    onClick={() => onJumpToAthletes(team.id)}
                    className="rounded border border-border px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground"
                  >
                    {term.athletes} →
                  </button>
                  <button
                    type="button"
                    onClick={() => onJoinLink({ id: team.id, name: team.name })}
                    className="rounded border border-border px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-primary hover:bg-primary/10"
                  >
                    Beitrittslink
                  </button>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                <TeamMetric value={kpi?.athletes ?? 0} label={term.athletes} />
                <TeamMetric
                  value={kpi?.weekly_compliance != null ? `${kpi.weekly_compliance}%` : "—"}
                  label="Compliance"
                />
                <TeamMetric value={kpi?.pending_onboardings ?? 0} label="Offen" />
              </div>
            </li>
          );
        })}
        {teams.length === 0 && (
          <li className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground sm:col-span-2">
            Noch keine {term.teams} angelegt.
          </li>
        )}
      </ul>
    </div>
  );
}

function TeamMetric({ value, label }: { value: string | number; label: string }) {
  return (
    <div className="rounded bg-muted/40 p-2">
      <div className="font-display text-lg font-bold">{value}</div>
      <div className="text-[9px] uppercase tracking-wider text-muted-foreground">{label}</div>
    </div>
  );
}
