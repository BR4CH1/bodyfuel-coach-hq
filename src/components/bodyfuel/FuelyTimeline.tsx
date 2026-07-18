import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { listFuelyTimeline, type FuelyTimelineEvent } from "@/lib/fuely-timeline.functions";
import { Fuely } from "@/components/bodyfuel/Fuely";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Sparkles } from "lucide-react";

type Props = {
  forUserId?: string;
  coachView?: boolean;
  limit?: number;
  emptyHint?: string;
};

export function FuelyTimeline({ forUserId, coachView, limit = 40, emptyHint }: Props) {
  const listFn = useServerFn(listFuelyTimeline);
  const navigate = useNavigate();
  const q = useQuery({
    queryKey: ["fuely-timeline", forUserId ?? "self", !!coachView, limit],
    queryFn: () => listFn({ data: { forUserId, coachView, limit } }),
  });

  const items = q.data?.items ?? [];

  if (q.isLoading) {
    return <div className="p-6 text-center text-sm text-muted-foreground">Timeline lädt …</div>;
  }
  if (!items.length) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border bg-muted/30 p-8 text-center">
        <Fuely emotion="waving" size="lg" animation="float" />
        <div className="font-display text-lg font-semibold">Deine Reise beginnt hier</div>
        <p className="max-w-xs text-sm text-muted-foreground">
          {emptyHint ??
            "Sobald du Wasser, Gewicht, Mahlzeiten oder Trainings einträgst, sammle ich hier deine wichtigsten Momente."}
        </p>
      </div>
    );
  }

  const grouped = groupByDay(items);

  return (
    <ScrollArea className="h-[calc(100dvh-14rem)]">
      <div className="space-y-6 pr-2">
        {grouped.map(({ label, events }) => (
          <section key={label} className="space-y-2">
            <div className="sticky top-0 z-10 -mx-2 bg-background/95 px-2 py-1 backdrop-blur">
              <div className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                {label}
              </div>
            </div>
            <ol className="relative space-y-3 border-l border-border pl-4">
              {events.map((e) => (
                <li key={e.id} className="relative">
                  <span className="absolute -left-[21px] top-2 grid h-8 w-8 place-items-center rounded-full border border-border bg-card text-lg shadow-sm">
                    {e.icon ?? "✨"}
                  </span>
                  <div className="rounded-xl border border-border bg-card p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-muted-foreground">
                          <span>{formatTime(e.occurred_at)}</span>
                          {e.event_type === "milestone" && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 font-bold text-primary">
                              <Sparkles className="h-3 w-3" />
                              Meilenstein
                            </span>
                          )}
                        </div>
                        <div className="mt-0.5 font-semibold leading-tight">{e.title}</div>
                        {e.summary && (
                          <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">
                            {e.summary}
                          </p>
                        )}
                      </div>
                    </div>
                    {!coachView && e.cta_href && e.cta_label && (
                      <div className="mt-2">
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => navigate({ to: e.cta_href! })}
                        >
                          {e.cta_label}
                        </Button>
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          </section>
        ))}
      </div>
    </ScrollArea>
  );
}

function groupByDay(items: FuelyTimelineEvent[]) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  const byDay = new Map<string, { label: string; events: FuelyTimelineEvent[] }>();
  for (const e of items) {
    const d = new Date(e.occurred_at);
    const key = d.toISOString().slice(0, 10);
    let label: string;
    if (sameDay(d, today)) label = "Heute";
    else if (sameDay(d, yesterday)) label = "Gestern";
    else
      label = d.toLocaleDateString("de-DE", {
        weekday: "long",
        day: "2-digit",
        month: "long",
      });
    if (!byDay.has(key)) byDay.set(key, { label, events: [] });
    byDay.get(key)!.events.push(e);
  }
  return Array.from(byDay.values());
}

function sameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
}
