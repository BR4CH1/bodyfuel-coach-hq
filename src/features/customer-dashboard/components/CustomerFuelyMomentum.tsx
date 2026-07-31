import { Check, Circle } from "lucide-react";

import { Fuely } from "@/components/bodyfuel/Fuely";
import { Progress } from "@/components/ui/progress";
import type { CustomerMomentumViewModel } from "@/features/customer-dashboard/types";

export function CustomerFuelyMomentum({ momentum }: { momentum: CustomerMomentumViewModel }) {
  return (
    <section className="rounded-3xl border border-border bg-card p-5 sm:p-6">
      <div className="flex items-start gap-4">
        <Fuely
          emotion={momentum.state === "complete" ? "celebrating" : "motivated"}
          animation={momentum.state === "complete" ? "success" : "idle"}
          size="md"
          className="shrink-0"
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">
                Fuely Momentum
              </p>
              <h2 className="mt-1 font-display text-xl font-bold">{momentum.title}</h2>
            </div>
            <div className="text-sm font-bold text-gold">{momentum.completion}%</div>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{momentum.summary}</p>
          <Progress value={momentum.completion} className="mt-4 h-2" />
          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            {momentum.signals.map((signal) => (
              <div
                key={signal.label}
                className="flex items-center gap-2 rounded-xl border border-border/70 bg-background/50 px-3 py-2 text-sm"
              >
                {signal.complete ? (
                  <Check className="h-4 w-4 text-emerald-500" />
                ) : (
                  <Circle className="h-4 w-4 text-muted-foreground" />
                )}
                <span className={signal.complete ? "font-medium" : "text-muted-foreground"}>
                  {signal.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
