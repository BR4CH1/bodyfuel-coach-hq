import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import {
  TeamGroupAthletePicker,
  type PickerValue,
} from "@/components/organizations/TeamGroupAthletePicker";
import {
  getAthleteNutritionSchedule,
  getGroupNutritionSchedule,
  getTeamNutritionSchedule,
  upsertAthleteNutritionSchedule,
  upsertGroupNutritionSchedule,
  upsertTeamNutritionSchedule,
} from "@/lib/organizations/roster-schedule.functions";
import type { OrgTeam, ScheduleEntry } from "../types";
import { Card, Empty } from "./OrgDetailPrimitives";
import { ScheduleEditor } from "./ScheduleEditor";

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Fehler beim Speichern.";
}

export function NutritionScheduleCard({ orgId, teams }: { orgId: string; teams: OrgTeam[] }) {
  const queryClient = useQueryClient();
  const fetchTeam = useServerFn(getTeamNutritionSchedule);
  const upsertTeam = useServerFn(upsertTeamNutritionSchedule);
  const fetchGroup = useServerFn(getGroupNutritionSchedule);
  const upsertGroup = useServerFn(upsertGroupNutritionSchedule);
  const fetchAthlete = useServerFn(getAthleteNutritionSchedule);
  const upsertAthlete = useServerFn(upsertAthleteNutritionSchedule);

  const [picker, setPicker] = useState<PickerValue>({
    scope: "team",
    team_id: teams[0]?.id ?? null,
    position_group: null,
    athlete_user_id: null,
    athlete_name: null,
  });
  const [message, setMessage] = useState<string | null>(null);

  const scheduleQuery = useQuery({
    queryKey: [
      "nutrition-schedule",
      picker.scope,
      picker.team_id,
      picker.position_group,
      picker.athlete_user_id,
    ],
    queryFn: async (): Promise<ScheduleEntry[]> => {
      if (picker.scope === "team") {
        if (!picker.team_id) return [];
        return fetchTeam({
          data: { organization_id: orgId, team_id: picker.team_id },
        }) as Promise<ScheduleEntry[]>;
      }

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

      if (!picker.athlete_user_id) return [];
      return fetchAthlete({
        data: { organization_id: orgId, user_id: picker.athlete_user_id },
      }) as Promise<ScheduleEntry[]>;
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (entries: ScheduleEntry[]) => {
      const mapped = entries.map((entry) => ({
        weekday: entry.weekday,
        title: entry.title ?? "Team Training",
        description: entry.description ?? null,
        active: Boolean(entry.active),
      }));

      if (picker.scope === "team") {
        if (!picker.team_id) throw new Error("Team wählen.");
        return upsertTeam({
          data: {
            organization_id: orgId,
            team_id: picker.team_id,
            entries: mapped,
          },
        });
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
            entries: mapped,
          },
        });
      }

      if (!picker.athlete_user_id) throw new Error("Spieler wählen.");
      return upsertAthlete({
        data: {
          organization_id: orgId,
          user_id: picker.athlete_user_id,
          team_id: picker.team_id,
          entries: mapped,
        },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["nutrition-schedule"] });
      setMessage("Gespeichert.");
    },
    onError: (error) => setMessage(errorMessage(error)),
  });

  const canEdit =
    (picker.scope === "team" && Boolean(picker.team_id)) ||
    (picker.scope === "group" && Boolean(picker.team_id) && Boolean(picker.position_group)) ||
    (picker.scope === "athlete" && Boolean(picker.athlete_user_id));

  const cardTitle =
    picker.scope === "team"
      ? "Ernährungsplan (Wochenplan)"
      : picker.scope === "group"
        ? `Gruppen-Ernährung · ${picker.position_group ?? ""}`
        : `Spieler-Ernährung · ${picker.athlete_name ?? "Spieler wählen"}`;

  return (
    <Card title={cardTitle}>
      <div className="mb-3">
        <TeamGroupAthletePicker orgId={orgId} teams={teams} value={picker} onChange={setPicker} />
      </div>

      {message && <div className="mb-2 text-xs text-green-500">{message}</div>}

      {!canEdit ? (
        <Empty>
          {picker.scope === "group"
            ? "Positionsgruppe wählen."
            : picker.scope === "athlete"
              ? "Spieler suchen und wählen."
              : "Team wählen."}
        </Empty>
      ) : (
        <>
          <ScheduleEditor
            teamId={picker.team_id}
            entries={scheduleQuery.data ?? []}
            onSave={(rows) => saveMutation.mutate(rows)}
            saving={saveMutation.isPending}
          />

          {picker.scope === "athlete" && picker.athlete_user_id && (
            <div className="mt-3 flex flex-wrap gap-2">
              <Link
                to="/coach/plan-builder/$userId"
                params={{ userId: picker.athlete_user_id }}
                className="inline-flex items-center gap-1 rounded-md border border-gold/40 bg-gold/10 px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-gold/20"
              >
                Ernährungsplan-Builder öffnen →
              </Link>
            </div>
          )}

          <div className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
            Der Plan-Builder greift auf die vollständige Lebensmitteldatenbank zu. Änderungen wirken
            sich auf zukünftige Tasks aus.
          </div>
        </>
      )}
    </Card>
  );
}
