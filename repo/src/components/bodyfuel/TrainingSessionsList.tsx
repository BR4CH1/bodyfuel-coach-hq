import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Trash2, Activity, Heart, Users, Sparkles, Dumbbell, Wind } from "lucide-react";
import {
  listTrainingSessions,
  deleteTrainingSession,
  type SessionType,
} from "@/lib/training-sessions.functions";

const ICONS: Record<SessionType, React.ReactNode> = {
  strength: <Dumbbell className="h-3.5 w-3.5" />,
  cardio: <Heart className="h-3.5 w-3.5" />,
  class: <Users className="h-3.5 w-3.5" />,
  mobility: <Wind className="h-3.5 w-3.5" />,
  sport: <Activity className="h-3.5 w-3.5" />,
  other: <Sparkles className="h-3.5 w-3.5" />,
};

const LABEL: Record<SessionType, string> = {
  strength: "Kraft",
  cardio: "Cardio",
  class: "Kurs",
  mobility: "Mobility",
  sport: "Sport",
  other: "Sonstiges",
};

export function TrainingSessionsList({
  clientId,
  selfEdit = false,
  days = 14,
}: {
  clientId: string;
  selfEdit?: boolean;
  days?: number;
}) {
  const listFn = useServerFn(listTrainingSessions);
  const delFn = useServerFn(deleteTrainingSession);
  const qc = useQueryClient();

  const { data: sessions } = useQuery({
    queryKey: ["training-sessions", clientId, days],
    queryFn: () => listFn({ data: { client_id: clientId, days } }),
    enabled: !!clientId,
  });

  const del = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Gelöscht");
      qc.invalidateQueries({ queryKey: ["training-sessions"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Fehler"),
  });

  if (!sessions || sessions.length === 0) return null;

  return (
    <div className="rounded-xl border border-border/60 bg-background/40 p-3">
      <div className="mb-2 text-[11px] uppercase tracking-wider text-muted-foreground">
        Freie Einheiten (letzte {days} Tage)
      </div>
      <ul className="space-y-1.5">
        {sessions.map((s: any) => (
          <li
            key={s.id}
            className="flex items-center justify-between gap-2 rounded-lg border border-border/40 bg-card/40 px-2 py-1.5 text-xs"
          >
            <div className="flex min-w-0 items-center gap-2">
              <span className="text-gold">{ICONS[s.session_type as SessionType]}</span>
              <div className="min-w-0">
                <div className="truncate font-medium">{s.name}</div>
                <div className="text-[10px] text-muted-foreground">
                  {s.session_date} · {LABEL[s.session_type as SessionType]}
                  {s.duration_minutes ? ` · ${s.duration_minutes} min` : ""}
                  {s.intensity ? ` · Intensität ${s.intensity}/10` : ""}
                  {s.sets ? ` · ${s.sets}×${s.reps ?? "?"}${s.weight_kg ? ` @ ${s.weight_kg}kg` : ""}` : ""}
                </div>
              </div>
            </div>
            {selfEdit && (
              <button
                onClick={() => del.mutate(s.id)}
                className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                aria-label="Löschen"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
