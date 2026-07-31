import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ChevronDown, ChevronUp, MessageCircleMore, UserRoundSearch } from "lucide-react";

import { Fuely } from "@/components/bodyfuel/Fuely";
import type {
  CoachFollowUpCategory,
  CoachWorkloadMetric,
  CoachWorkloadViewModel,
} from "@/features/coach-dashboard/types";
import { cn } from "@/lib/utils";

const TONES: Record<CoachWorkloadMetric["tone"], string> = {
  urgent: "border-red-500/30 bg-red-500/8 text-red-500",
  attention: "border-amber-500/30 bg-amber-500/8 text-amber-500",
  info: "border-gold/30 bg-gold/8 text-gold",
  neutral: "border-border bg-background/50 text-muted-foreground",
};

const CATEGORY_BY_KEY: Record<CoachWorkloadMetric["key"], CoachFollowUpCategory> = {
  risk: "risk",
  checkin: "checkin",
  plan: "plan",
  lead: "lead",
};

export function CoachFuelyWorkload({
  workload,
  onOpenFollowUps,
  focusKey,
}: {
  workload: CoachWorkloadViewModel;
  onOpenFollowUps?: (category: CoachFollowUpCategory) => void;
  focusKey?: CoachWorkloadMetric["key"] | null;
}) {
  const [openKey, setOpenKey] = useState<CoachWorkloadMetric["key"] | null>(null);

  useEffect(() => {
    if (focusKey) setOpenKey(focusKey);
  }, [focusKey]);

  return (
    <section className="rounded-3xl border border-border bg-card p-5 sm:p-6">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-start gap-4">
          <Fuely
            emotion={workload.state === "clear" ? "celebrating" : "focused"}
            animation="idle"
            size="md"
            className="shrink-0"
          />
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">
              Fuely Workload
            </p>
            <h2 className="mt-1 font-display text-xl font-bold">{workload.title}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{workload.summary}</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {workload.metrics.map((metric) => {
            const open = openKey === metric.key;
            return (
              <button
                type="button"
                key={metric.key}
                onClick={() => setOpenKey(open ? null : metric.key)}
                className={cn(
                  "min-w-28 rounded-2xl border px-3 py-3 text-left transition hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-gold/50",
                  TONES[metric.tone],
                )}
                aria-expanded={open}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="text-2xl font-bold">{metric.value}</div>
                  {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </div>
                <div className="mt-0.5 text-[11px] font-semibold uppercase tracking-wide">
                  {metric.label}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {openKey && (
        <div className="mt-5 rounded-2xl border border-border bg-background/45 p-3 sm:p-4">
          {workload.metrics
            .filter((metric) => metric.key === openKey)
            .map((metric) => (
              <div key={metric.key}>
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <div className="font-display font-bold">{metric.label}</div>
                    <div className="text-xs text-muted-foreground">
                      Nur die aktuell betroffenen Personen
                    </div>
                  </div>
                  {metric.value > 0 && (
                    <button
                      type="button"
                      onClick={() => onOpenFollowUps?.(CATEGORY_BY_KEY[metric.key])}
                      className="rounded-lg border border-gold/30 px-3 py-2 text-xs font-semibold text-gold hover:bg-gold/10"
                    >
                      Alle Follow-ups
                    </button>
                  )}
                </div>
                {metric.items.length === 0 ? (
                  <p className="rounded-xl border border-border/70 p-3 text-sm text-muted-foreground">
                    Keine offenen Fälle.
                  </p>
                ) : (
                  <div className="grid gap-2 lg:grid-cols-2">
                    {metric.items.map((item) => (
                      <div
                        key={item.sourceSignalId}
                        className="rounded-xl border border-border/70 bg-card/70 p-3"
                      >
                        <div className="font-semibold">{item.name}</div>
                        <div className="mt-1 text-xs leading-relaxed text-muted-foreground">
                          {item.reason}
                        </div>
                        <div className="mt-3 flex gap-2">
                          {item.target.kind === "customer" ? (
                            <Link
                              to="/coach/customers/$userId"
                              params={{ userId: item.target.userId }}
                              className="inline-flex h-9 items-center rounded-md border border-border px-3 text-xs hover:border-gold/50 hover:text-gold"
                            >
                              <UserRoundSearch className="mr-2 h-4 w-4" /> Profil
                            </Link>
                          ) : (
                            <Link
                              to="/coach/leads"
                              className="inline-flex h-9 items-center rounded-md border border-border px-3 text-xs hover:border-gold/50 hover:text-gold"
                            >
                              <UserRoundSearch className="mr-2 h-4 w-4" /> Anfrage
                            </Link>
                          )}
                          <button
                            type="button"
                            onClick={() => onOpenFollowUps?.(CATEGORY_BY_KEY[metric.key])}
                            className="inline-flex h-9 items-center rounded-md bg-gold px-3 text-xs font-semibold text-primary-foreground"
                          >
                            <MessageCircleMore className="mr-2 h-4 w-4" /> Follow-up
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
        </div>
      )}
    </section>
  );
}
