import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import {
  TeamGroupAthletePicker,
  type PickerValue,
} from "@/components/organizations/TeamGroupAthletePicker";
import { createManualOrgTask, listOrgTasksForDay } from "@/lib/organizations/task-engine.functions";
import { listTeamAthletesForAssign } from "@/lib/organizations/roster-schedule.functions";
import type { OrgTeam } from "../types";
import { Card, Empty } from "./OrgDetailPrimitives";

type OrgTask = {
  id: string;
  scheduled_for: string;
  task_type: string;
  title: string;
  athlete_name: string | null;
  status: string;
};

export function TasksTab({ orgId, teams }: { orgId: string; teams: OrgTeam[] }) {
  const queryClient = useQueryClient();
  const fetchTasks = useServerFn(listOrgTasksForDay);
  const createTaskFn = useServerFn(createManualOrgTask);
  const resolveAthletes = useServerFn(listTeamAthletesForAssign);

  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [teamFilter, setTeamFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [title, setTitle] = useState("");
  const [organizationWide, setOrganizationWide] = useState(false);
  const [picker, setPicker] = useState<PickerValue>({
    scope: "team",
    team_id: null,
    position_group: null,
    athlete_user_id: null,
    athlete_name: null,
  });

  const tasksQuery = useQuery({
    queryKey: ["org-tasks", orgId, date, teamFilter],
    queryFn: () =>
      fetchTasks({
        data: {
          organization_id: orgId,
          date,
          team_id: teamFilter || null,
        },
      }),
  });

  const createTask = useMutation({
    mutationFn: async () => {
      let userIds: string[] | null = null;
      let teamId: string | null = null;

      if (organizationWide) {
        teamId = null;
        userIds = null;
      } else if (picker.scope === "athlete") {
        if (!picker.athlete_user_id) throw new Error("Bitte Spieler auswählen.");
        teamId = picker.team_id;
        userIds = [picker.athlete_user_id];
      } else if (picker.scope === "group") {
        if (!picker.team_id || !picker.position_group) {
          throw new Error("Bitte Team und Positionsgruppe wählen.");
        }

        const athletes = await resolveAthletes({
          data: {
            organization_id: orgId,
            team_id: picker.team_id,
            position_group: picker.position_group,
          },
        });

        if (!athletes.length) throw new Error("Keine Spieler in dieser Gruppe.");
        teamId = picker.team_id;
        userIds = athletes.map((athlete) => athlete.user_id);
      } else {
        if (!picker.team_id) throw new Error("Bitte Team wählen.");
        teamId = picker.team_id;
        userIds = null;
      }

      return createTaskFn({
        data: {
          organization_id: orgId,
          team_id: teamId,
          user_ids: userIds,
          task_type: "manual",
          title,
          scheduled_date: date,
        },
      });
    },
    onSuccess: () => {
      setTitle("");
      setPicker((current) => ({
        ...current,
        athlete_user_id: null,
        athlete_name: null,
      }));
      queryClient.invalidateQueries({ queryKey: ["org-tasks", orgId] });
    },
  });

  const filteredTasks = ((tasksQuery.data as OrgTask[] | undefined) ?? []).filter(
    (task) => !statusFilter || task.status === statusFilter,
  );
  const isBuilderTitle = /training|ernähr|nutrit/i.test(title);
  const canOpenBuilder =
    picker.scope === "athlete" && Boolean(picker.athlete_user_id) && isBuilderTitle;
  const builderTarget = /ernähr|nutrit/i.test(title) ? "plan-builder" : "training-builder";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <input
          type="date"
          value={date}
          onChange={(event) => setDate(event.target.value)}
          className="rounded border border-border bg-background px-2 py-1"
        />
        <select
          value={teamFilter}
          onChange={(event) => setTeamFilter(event.target.value)}
          className="rounded border border-border bg-background px-2 py-1"
        >
          <option value="">Alle Teams</option>
          {teams.map((team) => (
            <option key={team.id} value={team.id}>
              {team.name}
            </option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value)}
          className="rounded border border-border bg-background px-2 py-1"
        >
          <option value="">Alle Status</option>
          <option value="open">Offen</option>
          <option value="done">Erledigt</option>
          <option value="skipped">Übersprungen</option>
        </select>
      </div>

      <Card title="Manuelle Aufgabe">
        <div className="space-y-3">
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={organizationWide}
              onChange={(event) => setOrganizationWide(event.target.checked)}
            />
            An gesamte Organisation (Team/Gruppe/Spieler ignorieren)
          </label>

          {!organizationWide && (
            <TeamGroupAthletePicker
              orgId={orgId}
              teams={teams}
              value={picker}
              onChange={setPicker}
            />
          )}

          <div className="flex flex-wrap items-center gap-2 text-sm">
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Titel z.B. Mobility Routine"
              className="min-w-[200px] flex-1 rounded border border-border bg-background px-2 py-1"
            />
            <button
              onClick={() => createTask.mutate()}
              disabled={!title || createTask.isPending}
              className="rounded bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground disabled:opacity-50"
            >
              {createTask.isPending ? "Legt an…" : "Anlegen"}
            </button>

            {canOpenBuilder && picker.athlete_user_id && (
              <Link
                to={
                  builderTarget === "plan-builder"
                    ? "/coach/plan-builder/$userId"
                    : "/coach/training-builder/$userId"
                }
                params={{ userId: picker.athlete_user_id }}
                className="rounded border border-gold/40 bg-gold/10 px-3 py-1 text-xs font-semibold text-foreground hover:bg-gold/20"
              >
                Plan-Builder öffnen →
              </Link>
            )}
          </div>

          {createTask.error && (
            <div className="text-xs text-destructive">
              {createTask.error instanceof Error
                ? createTask.error.message
                : "Aufgabe konnte nicht angelegt werden."}
            </div>
          )}

          {picker.scope === "athlete" && picker.athlete_name && (
            <div className="text-[11px] text-muted-foreground">
              Ziel: <strong>{picker.athlete_name}</strong>
            </div>
          )}
        </div>
      </Card>

      {tasksQuery.isLoading ? (
        <div className="text-xs text-muted-foreground">Lädt…</div>
      ) : filteredTasks.length === 0 ? (
        <Empty>Keine Tasks für {date}.</Empty>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-secondary text-left text-[10px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-3 py-2">Zeit</th>
                <th className="px-3 py-2">Typ</th>
                <th className="px-3 py-2">Titel</th>
                <th className="px-3 py-2">Athlet</th>
                <th className="px-3 py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredTasks.map((task) => (
                <tr key={task.id} className="border-t border-border">
                  <td className="px-3 py-2 text-xs">
                    {new Date(task.scheduled_for).toLocaleTimeString("de-DE", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </td>
                  <td className="px-3 py-2 text-[10px] uppercase tracking-wider">
                    {task.task_type}
                  </td>
                  <td className="px-3 py-2">{task.title}</td>
                  <td className="px-3 py-2">{task.athlete_name}</td>
                  <td className="px-3 py-2">
                    <span
                      className={`rounded px-2 py-0.5 text-[10px] uppercase tracking-wider ${
                        task.status === "done"
                          ? "bg-green-500/20 text-green-500"
                          : task.status === "skipped"
                            ? "bg-muted text-muted-foreground"
                            : "bg-yellow-500/20 text-yellow-500"
                      }`}
                    >
                      {task.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
