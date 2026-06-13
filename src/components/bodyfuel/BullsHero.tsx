import { Shield } from "lucide-react";
import type { ReactNode } from "react";

export function BullsHero({
  eyebrow = "Bulls Performance Hub",
  title,
  subtitle,
  children,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  children?: ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-3xl border border-bulls-red/40 bg-gradient-to-br from-black via-[oklch(0.12_0.005_250)] to-background p-6 sm:p-8 shadow-bulls">
      <div className="flex items-center gap-2 text-xs uppercase tracking-[0.25em] text-bulls-red">
        <Shield className="h-4 w-4" /> {eyebrow}
      </div>
      <h1 className="mt-2 font-display text-3xl font-bold text-white sm:text-4xl">{title}</h1>
      {subtitle && <p className="mt-2 text-sm text-muted-foreground sm:text-base">{subtitle}</p>}
      {children && <div className="mt-4">{children}</div>}
    </div>
  );
}
