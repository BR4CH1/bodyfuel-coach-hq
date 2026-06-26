import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Sparkles, Loader2, CheckCircle2, AlertTriangle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getMyAutopilotJob } from "@/lib/autopilot-jobs.functions";

/**
 * Zeigt während der asynchronen Autopilot-Plan-Generierung einen
 * Status-Banner. Pollt alle 6s solange ein Job läuft.
 */
export function AutopilotStatusCard({ userId }: { userId: string }) {
  const qc = useQueryClient();
  const fn = useServerFn(getMyAutopilotJob);
  const [hidden, setHidden] = useState(false);

  const { data: job } = useQuery({
    queryKey: ["autopilot-job", userId],
    queryFn: () => fn(),
    enabled: !!userId && !hidden,
    refetchInterval: (q) => {
      const j: any = q.state.data;
      if (!j) return false;
      if (j.status === "pending" || j.status === "running") return 6000;
      return false;
    },
  });

  // Wenn der Job fertig ist, einmal die Plan-Caches invalidieren.
  useEffect(() => {
    if (job?.status === "done") {
      qc.invalidateQueries({ queryKey: ["plan-overview"] });
      qc.invalidateQueries({ queryKey: ["plan-content"] });
      qc.invalidateQueries({ queryKey: ["nutrition-targets"] });
    }
  }, [job?.status, qc]);

  if (!job || hidden) return null;
  if (job.status === "done") {
    return (
      <Card className="mb-4 flex items-center gap-3 border-emerald-500/40 bg-emerald-500/10 p-4">
        <CheckCircle2 className="h-5 w-5 text-emerald-500" />
        <div className="flex-1">
          <p className="text-sm font-semibold">Dein Autopilot ist startklar ✨</p>
          <p className="text-xs text-muted-foreground">
            Ernährungs- und Trainingsplan wurden im Hintergrund erstellt und aktiviert.
          </p>
        </div>
        <Button size="sm" variant="ghost" onClick={() => setHidden(true)}>
          OK
        </Button>
      </Card>
    );
  }
  if (job.status === "failed") {
    return (
      <Card className="mb-4 flex items-start gap-3 border-amber-500/40 bg-amber-500/10 p-4">
        <AlertTriangle className="mt-0.5 h-5 w-5 text-amber-500" />
        <div className="flex-1">
          <p className="text-sm font-semibold">Autopilot konnte nicht fertig stellen</p>
          <p className="text-xs text-muted-foreground">
            {job.error?.slice(0, 220) ?? "Bitte später erneut versuchen oder Coach kontaktieren."}
          </p>
        </div>
        <Button size="sm" variant="ghost" onClick={() => setHidden(true)}>
          OK
        </Button>
      </Card>
    );
  }

  const label =
    job.step === "training"
      ? "Trainingsplan wird erstellt …"
      : "Ernährungsplan wird erstellt …";
  const sub =
    job.step === "training"
      ? "Dein Ernährungsplan ist schon aktiv — Training folgt in ca. 1–2 Min."
      : "Wir bauen deinen 4-Wochen-Plan. Das dauert 1–2 Min — du kannst die App schon nutzen.";

  return (
    <Card className="mb-4 flex items-center gap-3 border-amber-500/30 bg-gradient-to-r from-amber-500/5 to-yellow-500/5 p-4">
      <div className="relative">
        <Sparkles className="h-5 w-5 text-amber-500" />
        <Loader2 className="absolute -right-1 -top-1 h-3 w-3 animate-spin text-amber-500" />
      </div>
      <div className="flex-1">
        <p className="text-sm font-semibold">{label}</p>
        <p className="text-xs text-muted-foreground">{sub}</p>
      </div>
    </Card>
  );
}
