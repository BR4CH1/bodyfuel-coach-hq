import { AlertTriangle, Check, CloudOff, Loader2 } from "lucide-react";
import type { WorkoutSaveStatus } from "@/lib/training/workout-session-draft.types";

type Props = {
  status: WorkoutSaveStatus;
};

const labels: Record<WorkoutSaveStatus, string> = {
  restoring: "Wird wiederhergestellt …",
  saving: "Speichert …",
  saved: "Gespeichert",
  "saved-locally": "Auf diesem Gerät gespeichert",
  offline: "Offline gespeichert",
  conflict: "Synchronisierung nötig",
  error: "Lokal gesichert · Sync ausstehend",
};

export function WorkoutSaveIndicator({ status }: Props) {
  const healthy = status === "saved" || status === "saved-locally" || status === "offline";
  const Icon =
    status === "saving" || status === "restoring"
      ? Loader2
      : status === "offline"
        ? CloudOff
        : healthy
          ? Check
          : AlertTriangle;

  return (
    <div
      aria-live="polite"
      className={`inline-flex min-h-8 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-black ${
        healthy
          ? "border-primary/25 bg-primary/10 text-primary"
          : "border-amber-500/30 bg-amber-500/10 text-amber-400"
      }`}
    >
      <Icon
        className={`h-3.5 w-3.5 ${
          status === "saving" || status === "restoring" ? "animate-spin" : ""
        }`}
      />
      {labels[status]}
    </div>
  );
}
