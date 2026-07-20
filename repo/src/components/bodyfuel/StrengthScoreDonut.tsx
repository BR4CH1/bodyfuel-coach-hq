import { STRENGTH_SCORE_COLOR_HEX, getStrengthScoreColor } from "@/lib/strengthScoreV2";

export function StrengthScoreDonut({
  value,
  label,
  size = 96,
  stroke = 10,
}: {
  value: number | null | undefined;
  label?: string;
  size?: number;
  stroke?: number;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, value ?? 0));
  const dash = (pct / 100) * c;
  const color = STRENGTH_SCORE_COLOR_HEX[getStrengthScoreColor(value)];

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke="currentColor"
            className="text-muted/30"
            strokeWidth={stroke}
            fill="none"
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke={color}
            strokeWidth={stroke}
            strokeLinecap="round"
            fill="none"
            strokeDasharray={`${dash} ${c - dash}`}
            style={{ transition: "stroke-dasharray 600ms ease" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className="font-display text-xl font-bold leading-none">{value ?? "—"}</div>
          <div className="text-[9px] uppercase tracking-wider text-muted-foreground">/100</div>
        </div>
      </div>
      {label && <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>}
    </div>
  );
}
