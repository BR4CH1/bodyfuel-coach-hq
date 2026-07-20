import { Link } from "@tanstack/react-router";
import { Activity, ChevronRight } from "lucide-react";

export function CoachPerformanceNotice({ pending }: { pending: number }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-bulls-red/15 text-bulls-red">
            <Activity className="h-5 w-5" />
          </div>
          <div>
            <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
              Bulls
            </div>
            <div className="font-display text-lg font-bold">Offene Performance Tests</div>
            <div className="text-xs text-muted-foreground">
              {pending > 0
                ? `${pending} ${pending === 1 ? "Test wartet" : "Tests warten"} auf Prüfung`
                : "Keine offenen Prüfungen"}
            </div>
          </div>
        </div>
        <Link
          to="/coach/bulls-performance"
          className="inline-flex items-center gap-1 rounded-lg bg-bulls-red px-3 py-2 text-sm font-semibold text-white hover:bg-bulls-red/90"
        >
          Tests prüfen
          <ChevronRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}
