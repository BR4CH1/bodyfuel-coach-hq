import type { CoachClient } from "@/features/coach-dashboard/types";

export type CoachActivityKind = "nutrition" | "training" | "weight" | "checkin";

export type CoachActivityEntry = {
  id: string;
  userId: string;
  name: string;
  kind: CoachActivityKind;
  detail: string;
  at: string;
  timestamp: number;
};

const KIND_LABEL: Record<CoachActivityKind, string> = {
  nutrition: "Ernährung",
  training: "Training",
  weight: "Gewicht",
  checkin: "Check-in",
};

export function activityKindLabel(kind: CoachActivityKind) {
  return KIND_LABEL[kind];
}

function toTimestamp(value: string | null | undefined): number | null {
  if (!value) return null;
  const ts = new Date(value).getTime();
  return Number.isFinite(ts) ? ts : null;
}

export function buildCoachActivityFeed(
  clients: CoachClient[],
  limit = 10,
): CoachActivityEntry[] {
  const entries: CoachActivityEntry[] = [];

  for (const client of clients) {
    const name = client.display_name?.trim() || "Unbenannt";
    const push = (kind: CoachActivityKind, at: string | null, detail: string) => {
      const timestamp = toTimestamp(at);
      if (timestamp == null || !at) return;
      entries.push({ id: `${client.id}-${kind}`, userId: client.id, name, kind, detail, at, timestamp });
    };

    push(
      "nutrition",
      client.last_nutrition_at,
      client.last_nutrition_name?.trim() || "Mahlzeit getrackt",
    );
    push("training", client.last_training_at, "Training getrackt");
    push(
      "weight",
      client.last_weight_at,
      client.last_weight != null ? `Gewicht ${client.last_weight} kg` : "Gewicht getrackt",
    );
    push("checkin", client.last_checkin_submitted_at, "Check-in eingereicht");
  }

  return entries
    .sort((a, b) => b.timestamp - a.timestamp || a.name.localeCompare(b.name, "de"))
    .slice(0, limit);
}

export function formatActivityTime(iso: string, now: Date = new Date()): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  const time = date.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
  const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  if (sameDay(date, now)) return `Heute · ${time}`;
  const yesterday = new Date(now.getTime() - 86_400_000);
  if (sameDay(date, yesterday)) return `Gestern · ${time}`;
  return `${date.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "2-digit" })} · ${time}`;
}
