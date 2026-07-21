import { Link } from "@tanstack/react-router";
import {
  Activity,
  AlertTriangle,
  Brain,
  ChevronRight,
  MessageCircleMore,
  TrendingDown,
} from "lucide-react";
import type {
  CoachFollowUpCategory,
  CoachIntelligenceSignal,
  CoachIntelligenceViewModel,
} from "@/features/coach-dashboard/types";
import { cn } from "@/lib/utils";

export function CoachFuelyIntelligence({
  intelligence,
  onOpenFollowUps,
}: {
  intelligence: CoachIntelligenceViewModel;
  onOpenFollowUps?: (category: CoachFollowUpCategory) => void;
}) {
  const groups = [
    {
      title: "Wer stagniert?",
      icon: TrendingDown,
      signals: intelligence.stagnating,
      category: "stagnation" as const,
    },
    {
      title: "Wer ist gefährdet?",
      icon: AlertTriangle,
      signals: intelligence.atRisk,
      category: "risk" as const,
    },
    {
      title: "Wer braucht Aufmerksamkeit?",
      icon: Activity,
      signals: intelligence.needsAttention,
      category: "attention" as const,
    },
  ];

  return (
    <section className="rounded-3xl border border-gold/25 bg-gradient-to-br from-gold/10 via-card to-card p-5 sm:p-6">
      <div className="flex items-start gap-3">
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-gradient-gold text-primary-foreground shadow-gold">
          <Brain className="h-5 w-5" />
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">Fuely V2</p>
          <h2 className="mt-1 font-display text-xl font-bold">{intelligence.title}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{intelligence.summary}</p>
        </div>
      </div>
      <div className="mt-5 grid gap-4 xl:grid-cols-3">
        {groups.map(({ title, icon: Icon, signals, category }) => (
          <div key={title} className="rounded-2xl border border-border bg-background/50 p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 font-display font-bold">
                <Icon className="h-4 w-4 text-gold" /> {title}
              </div>
              {signals.length > 0 && (
                <button
                  type="button"
                  onClick={() => onOpenFollowUps?.(category)}
                  className="rounded-md border border-gold/30 p-2 text-gold"
                  title="Passende Follow-ups anzeigen"
                >
                  <MessageCircleMore className="h-4 w-4" />
                </button>
              )}
            </div>
            <div className="mt-3 space-y-2">
              {signals.length === 0 ? (
                <p className="text-sm text-muted-foreground">Keine auffälligen Signale.</p>
              ) : (
                signals.map((signal) => (
                  <SignalRow
                    key={signal.id}
                    signal={signal}
                    onFollowUp={() => onOpenFollowUps?.(category)}
                  />
                ))
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function SignalRow({
  signal,
  onFollowUp,
}: {
  signal: CoachIntelligenceSignal;
  onFollowUp: () => void;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border p-3",
        signal.severity === "urgent"
          ? "border-red-500/30 bg-red-500/8"
          : "border-amber-500/25 bg-amber-500/8",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold leading-tight">{signal.headline}</div>
          <div className="mt-1 text-xs leading-relaxed text-muted-foreground">{signal.detail}</div>
        </div>
        <Link to="/coach/customers/$userId" params={{ userId: signal.userId }}>
          <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
        </Link>
      </div>
      <button
        type="button"
        onClick={onFollowUp}
        className="mt-3 inline-flex items-center text-xs font-semibold text-gold"
      >
        <MessageCircleMore className="mr-1.5 h-4 w-4" /> Follow-up anzeigen
      </button>
    </div>
  );
}
