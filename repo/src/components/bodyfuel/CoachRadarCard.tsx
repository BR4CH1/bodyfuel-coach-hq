import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ChevronDown, ChevronRight, Radar, Check } from "lucide-react";
import { toast } from "sonner";
import {
  dismissRadarClient,
  type CoachRadarData,
  type RadarClient,
  type RadarLevel,
} from "@/lib/coach-radar.functions";

type Bucket = {
  key: "red" | "orange" | "green";
  label: string;
  emoji: string;
  match: (l: RadarLevel) => boolean;
  border: string;
  pill: string;
  dot: string;
};

const BUCKETS: Bucket[] = [
  {
    key: "red",
    label: "Sofort handeln",
    emoji: "🔴",
    match: (l) => l === "red",
    border: "border-destructive/40 bg-destructive/5 hover:bg-destructive/10",
    pill: "bg-destructive/15 text-destructive",
    dot: "bg-destructive",
  },
  {
    key: "orange",
    label: "Beobachten",
    emoji: "🟠",
    match: (l) => l === "orange" || l === "yellow",
    border: "border-warning/40 bg-warning/5 hover:bg-warning/10",
    pill: "bg-warning/15 text-warning",
    dot: "bg-warning",
  },
  {
    key: "green",
    label: "Auf Kurs",
    emoji: "🟢",
    match: (l) => l === "green",
    border: "border-emerald-500/40 bg-emerald-500/5 hover:bg-emerald-500/10",
    pill: "bg-emerald-500/15 text-emerald-500",
    dot: "bg-emerald-500",
  },
];

export function CoachRadarCard({ data }: { data: CoachRadarData | undefined }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState<Bucket["key"] | null>("red");
  const clients = data?.clients ?? [];

  const dismissFn = useServerFn(dismissRadarClient);
  const dismissMut = useMutation({
    mutationFn: (c: RadarClient) =>
      dismissFn({
        data: { user_id: c.user_id, name: c.name, primary_reason: c.primary_reason },
      }),
    onSuccess: () => {
      toast.success("Aus Radar entfernt");
      qc.invalidateQueries({ queryKey: ["coach-radar"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Konnte nicht abgehakt werden"),
  });

  return (
    <div className="rounded-2xl border border-border bg-card p-5 sm:p-6 space-y-4">
      <div className="flex items-center gap-2">
        <Radar className="h-5 w-5 text-gold" />
        <h2 className="font-display text-lg font-bold sm:text-xl">Coach Radar</h2>
        <span className="text-xs text-muted-foreground">
          · {clients.length} Kunden
        </span>
      </div>

      <div className="grid gap-2 sm:grid-cols-3">
        {BUCKETS.map((b) => {
          const list = clients.filter((c) => b.match(c.level));
          const isOpen = open === b.key;
          return (
            <button
              key={b.key}
              type="button"
              onClick={() => setOpen(isOpen ? null : b.key)}
              className={`flex items-center justify-between rounded-xl border p-3 text-left transition ${b.border} ${
                isOpen ? "ring-1 ring-gold/30" : ""
              }`}
            >
              <div className="flex items-center gap-2">
                <span className={`h-2.5 w-2.5 rounded-full ${b.dot}`} />
                <span className="font-semibold">{b.label}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${b.pill}`}>
                  {list.length}
                </span>
                <ChevronDown className={`h-4 w-4 transition ${isOpen ? "rotate-180" : ""}`} />
              </div>
            </button>
          );
        })}
      </div>

      {open && (
        <div className="space-y-1.5">
          {clients
            .filter((c) => BUCKETS.find((b) => b.key === open)!.match(c.level))
            .slice(0, 30)
            .map((c) => (
              <div
                key={c.user_id}
                className="group flex items-center gap-2 rounded-xl border border-border/60 bg-background/40 p-2.5 transition hover:border-gold/40"
              >
                <Link
                  to="/coach/customers/$userId"
                  params={{ userId: c.user_id }}
                  className="flex min-w-0 flex-1 items-center gap-3"
                >
                  <span
                    className={`h-2 w-2 shrink-0 rounded-full ${
                      BUCKETS.find((b) => b.key === open)!.dot
                    }`}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold">{c.name}</div>
                    <div className="truncate text-xs text-muted-foreground">
                      {c.primary_reason}
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground group-hover:text-gold" />
                </Link>
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    dismissMut.mutate(c);
                  }}
                  disabled={dismissMut.isPending}
                  title="Aus Radar abhaken"
                  className="inline-flex shrink-0 items-center gap-1 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-1 text-[11px] font-semibold text-emerald-400 transition hover:bg-emerald-500/20 disabled:opacity-50"
                >
                  <Check className="h-3 w-3" />
                  Abhaken
                </button>
              </div>
            ))}
          {clients.filter((c) => BUCKETS.find((b) => b.key === open)!.match(c.level))
            .length === 0 && (
            <div className="rounded-xl border border-border/60 bg-background/40 p-4 text-sm text-muted-foreground">
              Niemand in dieser Kategorie.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
