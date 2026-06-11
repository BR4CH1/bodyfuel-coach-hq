import { Flame } from "lucide-react";

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-gradient-gold shadow-gold">
        <Flame className="h-5 w-5 text-primary-foreground" strokeWidth={2.5} />
      </div>
      {!compact && (
        <div className="leading-tight">
          <div className="font-display text-base font-bold tracking-wider text-foreground">
            BODYFUEL
          </div>
          <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            Nutrition Coaching
          </div>
        </div>
      )}
    </div>
  );
}
