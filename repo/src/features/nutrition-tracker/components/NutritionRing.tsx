export function NutritionRing({
  label,
  value,
  target,
  color,
  unit,
}: {
  label: string;
  value: number;
  target: number;
  color: string;
  unit: string;
}) {
  const percentage = target > 0 ? Math.min(100, (value / target) * 100) : 0;
  const radius = 28;
  const circumference = 2 * Math.PI * radius;
  const dash = (percentage / 100) * circumference;
  const reached = value >= target;

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative h-20 w-20">
        <svg viewBox="0 0 72 72" className="h-full w-full -rotate-90">
          <circle
            cx="36"
            cy="36"
            r={radius}
            stroke="hsl(var(--secondary))"
            strokeWidth="6"
            fill="none"
          />
          <circle
            cx="36"
            cy="36"
            r={radius}
            stroke={color}
            strokeWidth="6"
            fill="none"
            strokeLinecap="round"
            strokeDasharray={`${dash} ${circumference}`}
            className="transition-all"
          />
        </svg>
        <div className="absolute inset-0 grid place-items-center">
          <div className="text-center">
            <div className={`text-sm font-bold ${reached ? "text-gold" : ""}`}>
              {Math.round(value)}
            </div>
            <div className="text-[9px] text-muted-foreground">
              / {target}
              {unit}
            </div>
          </div>
        </div>
      </div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
    </div>
  );
}
