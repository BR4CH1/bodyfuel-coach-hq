import type { ReactNode } from "react";

export function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="mb-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
        {title}
      </div>
      {children}
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-border p-5 text-center text-xs text-muted-foreground">
      {children}
    </div>
  );
}

export function PerfKpi({
  icon,
  label,
  value,
  sub,
  tone = "default",
}: {
  icon: ReactNode;
  label: string;
  value: ReactNode;
  sub?: string;
  tone?: "default" | "positive" | "warn" | "critical" | "muted";
}) {
  const toneClass =
    tone === "positive"
      ? "text-emerald-500"
      : tone === "warn"
        ? "text-amber-500"
        : tone === "critical"
          ? "text-bulls-red"
          : tone === "muted"
            ? "text-neutral-500"
            : "text-white";

  return (
    <div className="rounded-2xl border border-[#252525] bg-[#111111] p-3.5 sm:p-4">
      <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-neutral-400">
        <span className="text-bulls-red">{icon}</span>
        <span className="truncate">{label}</span>
      </div>
      <div
        className={`mt-1.5 font-display text-3xl font-bold leading-none tabular-nums sm:text-4xl ${toneClass}`}
      >
        {value}
      </div>
      {sub && (
        <div className="mt-1.5 text-[10px] font-medium uppercase tracking-wider text-neutral-500">
          {sub}
        </div>
      )}
    </div>
  );
}
