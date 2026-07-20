import type { RadarLevel } from "@/lib/coach-radar.functions";

const STYLES: Record<RadarLevel, { dot: string; ring: string; label: string; text: string }> = {
  red: {
    dot: "bg-destructive",
    ring: "border-destructive/50 bg-destructive/10",
    label: "Sofort handeln",
    text: "text-destructive",
  },
  orange: {
    dot: "bg-warning",
    ring: "border-warning/50 bg-warning/10",
    label: "Eingreifen",
    text: "text-warning",
  },
  yellow: {
    dot: "bg-yellow-400",
    ring: "border-yellow-400/50 bg-yellow-400/10",
    label: "Beobachten",
    text: "text-yellow-400",
  },
  green: {
    dot: "bg-emerald-500",
    ring: "border-emerald-500/40 bg-emerald-500/10",
    label: "Auf Kurs",
    text: "text-emerald-500",
  },
};

export function CustomerStatusBadge({
  level,
  size = "sm",
  showLabel = false,
}: {
  level: RadarLevel | null | undefined;
  size?: "xs" | "sm" | "md";
  showLabel?: boolean;
}) {
  if (!level) return null;
  const s = STYLES[level];
  const pad =
    size === "xs" ? "px-1.5 py-0.5 text-[10px]" : size === "md" ? "px-2.5 py-1 text-xs" : "px-2 py-0.5 text-[11px]";
  return (
    <span
      title={s.label}
      className={`inline-flex shrink-0 items-center gap-1 rounded-full border font-semibold ${pad} ${s.ring} ${s.text}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
      {showLabel && <span>{s.label}</span>}
    </span>
  );
}
