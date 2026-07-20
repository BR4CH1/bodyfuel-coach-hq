import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight } from "lucide-react";
import { listFuelyTimeline } from "@/lib/fuely-timeline.functions";

export function FuelyTimelineCard({ orgSlug }: { orgSlug: string }) {
  const listFn = useServerFn(listFuelyTimeline);
  const q = useQuery({
    queryKey: ["fuely-timeline-card"],
    queryFn: () => listFn({ data: { limit: 4 } }),
    staleTime: 60_000,
  });

  const items = q.data?.items ?? [];
  if (!items.length) return null;

  return (
    <Link
      to="/$orgSlug/fuely"
      params={{ orgSlug }}
      search={{ tab: "timeline" }}
      className="block rounded-2xl border border-border bg-card p-4 transition hover:border-primary/50"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg">🍏</span>
          <div className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
            Letzte Aktivität
          </div>
        </div>
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
      </div>
      <ul className="mt-3 space-y-2">
        {items.map((e) => (
          <li key={e.id} className="flex items-start gap-2 text-sm">
            <span className="mt-0.5 text-base leading-none">{e.icon ?? "✨"}</span>
            <span className="flex-1 truncate">{e.title}</span>
          </li>
        ))}
      </ul>
      <div className="mt-3 text-xs font-semibold text-primary">Gesamte Timeline ansehen →</div>
    </Link>
  );
}
