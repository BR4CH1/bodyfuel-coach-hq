import { Link } from "@tanstack/react-router";
import { Apple, ClipboardCheck, Dumbbell, Scale } from "lucide-react";

import {
  activityKindLabel,
  buildCoachActivityFeed,
  formatActivityTime,
  type CoachActivityKind,
} from "@/features/coach-dashboard/lib/coach-recent-activity.logic";
import type { CoachClient } from "@/features/coach-dashboard/types";

const ICON: Record<CoachActivityKind, typeof Apple> = {
  nutrition: Apple,
  training: Dumbbell,
  weight: Scale,
  checkin: ClipboardCheck,
};

export function CoachRecentTrackingFeed({
  clients,
  limit = 10,
}: {
  clients: CoachClient[];
  limit?: number;
}) {
  const feed = buildCoachActivityFeed(clients, limit);

  return (
    <section className="rounded-2xl border border-border bg-card p-4 sm:p-5">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-bold sm:text-xl">Zuletzt getrackt</h2>
          <p className="text-xs text-muted-foreground">
            Wer hat was und wann erfasst — neueste Aktivitäten zuerst.
          </p>
        </div>
      </div>

      {feed.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">Noch keine Tracking-Aktivität.</p>
      ) : (
        <ul className="mt-3 divide-y divide-border/60">
          {feed.map((entry) => {
            const Icon = ICON[entry.kind];
            return (
              <li key={entry.id}>
                <Link
                  to="/coach/customers/$userId"
                  params={{ userId: entry.userId }}
                  className="flex items-center gap-3 py-2.5 transition-colors hover:bg-secondary/40"
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-secondary/60 text-gold">
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{entry.name}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {activityKindLabel(entry.kind)} · {entry.detail}
                    </span>
                  </span>
                  <span className="shrink-0 text-[11px] text-muted-foreground">
                    {formatActivityTime(entry.at)}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
