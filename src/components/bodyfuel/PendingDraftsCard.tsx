import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Sparkles, Loader2, ChevronRight, AlertCircle } from "lucide-react";
import {
  generateCheckinDraft,
  listPendingDraftsForCoach,
} from "@/lib/checkin-ai.functions";

type RedClient = { id: string; display_name: string | null };

export function PendingDraftsCard({ redClients }: { redClients: RedClient[] }) {
  const qc = useQueryClient();
  const listFn = useServerFn(listPendingDraftsForCoach);
  const genFn = useServerFn(generateCheckinDraft);

  const { data, isLoading } = useQuery({
    queryKey: ["pending-checkin-drafts"],
    queryFn: () => listFn(),
  });

  const [progress, setProgress] = useState<{ done: number; total: number; error?: string } | null>(null);

  const bulk = useMutation({
    mutationFn: async () => {
      const targets = redClients.slice(0, 10);
      setProgress({ done: 0, total: targets.length });
      for (let i = 0; i < targets.length; i++) {
        try {
          await genFn({ data: { user_id: targets[i].id } });
        } catch (e: any) {
          setProgress({ done: i, total: targets.length, error: e?.message ?? "Fehler" });
          throw e;
        }
        setProgress({ done: i + 1, total: targets.length });
      }
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["pending-checkin-drafts"] }),
  });

  const items = data?.items ?? [];

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-gold" />
          <div>
            <h3 className="font-display text-lg font-bold">Wartende Entwürfe</h3>
            <p className="text-xs text-muted-foreground">
              {isLoading ? "Lade…" : `${items.length} offen`}
              {redClients.length > 0 && ` · ${redClients.length} 🔴-Kunden`}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => bulk.mutate()}
          disabled={bulk.isPending || redClients.length === 0}
          className="inline-flex items-center gap-2 rounded-xl border border-gold/40 bg-gold/10 px-3 py-2 text-xs font-semibold text-gold transition hover:bg-gold/20 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {bulk.isPending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              {progress ? `${progress.done}/${progress.total}` : "Generiere…"}
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4" />
              Entwürfe für 🔴-Kunden erzeugen
            </>
          )}
        </button>
      </div>

      {bulk.isError && progress?.error && (
        <div className="mb-3 flex items-start gap-2 rounded-xl border border-red-500/30 bg-red-500/5 p-3 text-xs text-red-300">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{progress.error}</span>
        </div>
      )}

      {!isLoading && items.length === 0 && (
        <div className="rounded-xl border border-dashed border-border/60 p-4 text-sm text-muted-foreground">
          Keine wartenden Entwürfe. Klicke oben, um Analysen für deine 🔴-Kunden zu starten.
        </div>
      )}

      <ul className="space-y-2">
        {items.map((it) => {
          const dot =
            it.status_level === "red"
              ? "bg-red-500"
              : it.status_level === "yellow"
                ? "bg-amber-500"
                : "bg-emerald-500";
          return (
            <li key={it.id}>
              <Link
                to="/coach/customers/$userId"
                params={{ userId: it.client_id }}
                className="flex items-start gap-3 rounded-xl border border-border bg-background/40 p-3 transition hover:border-gold/40"
              >
                <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${dot}`} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">
                    {it.client_name ?? "Ohne Namen"}
                  </p>
                  <p className="line-clamp-2 text-xs text-muted-foreground">
                    {it.status_summary || "Entwurf wartet auf Freigabe"}
                  </p>
                  <p className="mt-1 text-[10px] uppercase tracking-wider text-muted-foreground/70">
                    {new Date(it.generated_at).toLocaleString("de-DE")}
                  </p>
                </div>
                <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" />
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
