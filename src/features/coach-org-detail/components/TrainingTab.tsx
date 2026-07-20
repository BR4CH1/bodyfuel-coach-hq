import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { CoachTeamWeekPlanner } from "@/components/coach/CoachTeamWeekPlanner";
import {
  TeamGroupAthletePicker,
  type PickerValue,
} from "@/components/organizations/TeamGroupAthletePicker";
import {
  getAthleteTrainingSchedule,
  getGroupTrainingSchedule,
  upsertAthleteTrainingSchedule,
  upsertGroupTrainingSchedule,
} from "@/lib/organizations/roster-schedule.functions";
import {
  getTeamTrainingSchedule,
  upsertTeamTrainingSchedule,
} from "@/lib/organizations/task-engine.functions";
import type { OrgTeam, ScheduleEntry } from "../types";
import { Card, Empty } from "./OrgDetailPrimitives";
import { ScheduleEditor } from "./ScheduleEditor";

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Fehler beim Speichern.";
}

export function TrainingTab({ orgId }: { orgId: string }) {
  const queryClient = useQueryClient();
  const fetchSchedule = useServerFn(getTeamTrainingSchedule);
  const upsertTeam = useServerFn(upsertTeamTrainingSchedule);
  const fetchGroup = useServerFn(getGroupTrainingSchedule);
  const upsertGroup = useServerFn(upsertGroupTrainingSchedule);
  const fetchAthlete = useServerFn(getAthleteTrainingSchedule);
  const upsertAthlete = useServerFn(upsertAthleteTrainingSchedule);

  const [message, setMessage] = useState<string | null>(null);
  const [picker, setPicker] = useState<PickerValue>({
    scope: "team",
    team_id: null,
    position_group: null,
    athlete_user_id: null,
    athlete_name: null,
  });

  const teamsQuery = useQuery({
    queryKey: ["org-team-schedule", orgId],
    queryFn: () => fetchSchedule({ data: { organization_id: orgId } }),
  });

  useEffect(() => {
    if (!picker.team_id && teamsQuery.data) {
      const firstTeamId = (teamsQuery.data.teams as OrgTeam[])[0]?.id;
      if (firstTeamId) {
        setPicker((current) => ({ ...current, team_id: firstTeamId }));
      }
    }
  }, [picker.team_id, teamsQuery.data]);

  const scheduleQuery = useQuery({
    queryKey: [
      "training-schedule",
      picker.scope,
      picker.team_id,
      picker.position_group,
      picker.athlete_user_id,
    ],
    queryFn: async (): Promise<ScheduleEntry[]> => {
      if (picker.scope === "group") {
        if (!picker.team_id || !picker.position_group) return [];
        return fetchGroup({
          data: {
            organization_id: orgId,
            team_id: picker.team_id,
            position_group: picker.position_group,
          },
        }) as Promise<ScheduleEntry[]>;
      }

      if (picker.scope === "athlete") {
        if (!picker.athlete_user_id) return [];
        return fetchAthlete({
          data: { organization_id: orgId, user_id: picker.athlete_user_id },
        }) as Promise<ScheduleEntry[]>;
      }

      if (!picker.team_id) return [];
      return ((teamsQuery.data?.schedules as ScheduleEntry[]) ?? []).filter(
        (schedule) => schedule.team_id === picker.team_id,
      );
    },
    enabled: Boolean(teamsQuery.data),
  });

  const saveMutation = useMutation({
    mutationFn: async (entries: ScheduleEntry[]) => {
      if (picker.scope === "team") {
        if (!picker.team_id) throw new Error("Team wählen.");
        return upsertTeam({ data: { team_id: picker.team_id, entries } });
      }

      if (picker.scope === "group") {
        if (!picker.team_id || !picker.position_group) {
          throw new Error("Team und Gruppe wählen.");
        }
        return upsertGroup({
          data: {
            organization_id: orgId,
            team_id: picker.team_id,
            position_group: picker.position_group,
            entries,
          },
        });
      }

      if (!picker.athlete_user_id) throw new Error("Spieler wählen.");
      return upsertAthlete({
        data: {
          organization_id: orgId,
          user_id: picker.athlete_user_id,
          team_id: picker.team_id,
          entries,
        },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["org-team-schedule", orgId] });
      queryClient.invalidateQueries({ queryKey: ["training-schedule"] });
      setMessage("Gespeichert.");
    },
    onError: (error) => setMessage(errorMessage(error)),
  });

  if (teamsQuery.isLoading || !teamsQuery.data) {
    return <div className="text-xs text-muted-foreground">Lädt…</div>;
  }

  const teams = (teamsQuery.data.teams as OrgTeam[]) ?? [];
  const entries = scheduleQuery.data ?? [];
  const canEdit =
    (picker.scope === "team" && Boolean(picker.team_id)) ||
    (picker.scope === "group" && Boolean(picker.team_id) && Boolean(picker.position_group)) ||
    (picker.scope === "athlete" && Boolean(picker.athlete_user_id));

  const cardTitle =
    picker.scope === "team"
      ? "Team Training Schedule (Wochenplan)"
      : picker.scope === "group"
        ? `Gruppen-Wochenplan · ${picker.position_group ?? ""}`
        : `Spieler-Wochenplan · ${picker.athlete_name ?? "Spieler wählen"}`;

  const activeTeamName = teams.find((team) => team.id === picker.team_id)?.name ?? "Team";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <TeamGroupAthletePicker orgId={orgId} teams={teams} value={picker} onChange={setPicker} />
      </div>

      {message && <div className="text-xs text-green-500">{message}</div>}

      {picker.scope === "team" ? (
        picker.team_id ? (
          <CoachTeamWeekPlanner orgId={orgId} teamId={picker.team_id} teamName={activeTeamName} />
        ) : (
          <Card title="Team Training Schedule">
            <Empty>Team wählen, um den Wochenplan zu bearbeiten.</Empty>
          </Card>
        )
      ) : (
        <Card title={cardTitle}>
          {!canEdit ? (
            <Empty>
              {picker.scope === "group"
                ? "Positionsgruppe wählen, um den Wochenplan zu bearbeiten."
                : "Spieler suchen und wählen, um einen individuellen Wochenplan anzulegen."}
            </Empty>
          ) : (
            <>
              <ScheduleEditor
                teamId={picker.team_id}
                entries={entries}
                onSave={(rows) => saveMutation.mutate(rows)}
                saving={saveMutation.isPending}
              />

              {picker.scope === "athlete" && picker.athlete_user_id && (
                <div className="mt-3 flex flex-wrap gap-2">
                  <Link
                    to="/coach/training-builder/$userId"
                    params={{ userId: picker.athlete_user_id }}
                    className="inline-flex items-center gap-1 rounded-md border border-gold/40 bg-gold/10 px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-gold/20"
                  >
                    Trainingsplan-Builder öffnen →
                  </Link>
                </div>
              )}

              <div className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
                Änderungen wirken auf zukünftige offene Tasks. Abgeschlossene historische Tasks
                bleiben unverändert.
              </div>
            </>
          )}
        </Card>
      )}
    </div>
  );
}
