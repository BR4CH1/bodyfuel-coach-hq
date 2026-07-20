import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, Trophy } from "lucide-react";

import { getRanking, type RankingPeriod } from "@/lib/coaching.functions";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const PERIOD_LABELS: Record<RankingPeriod, string> = {
  today: "Heute",
  week: "Diese Woche",
  month: "Diesen Monat",
  all: "Allzeit",
};

function medal(index: number): string {
  return index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : `${index + 1}.`;
}

export function CoachRankingPanel() {
  const [period, setPeriod] = useState<RankingPeriod>("week");
  const getRankingFn = useServerFn(getRanking);
  const { data, isLoading } = useQuery({
    queryKey: ["coach-ranking", period],
    queryFn: () => getRankingFn({ data: { period } }),
  });
  const rows = (data ?? []).filter((row) => row.points > 0);

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Trophy className="h-5 w-5 text-gold" />
          <h2 className="font-display text-lg font-bold">Ranking</h2>
        </div>
        <Select value={period} onValueChange={(value) => setPeriod(value as RankingPeriod)}>
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="today">Heute</SelectItem>
            <SelectItem value="week">Diese Woche</SelectItem>
            <SelectItem value="month">Diesen Monat</SelectItem>
            <SelectItem value="all">Allzeit</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="rounded-xl bg-background/40 p-4 text-sm text-muted-foreground">Lade…</div>
      ) : rows.length === 0 ? (
        <div className="flex items-center gap-2 rounded-xl bg-background/40 p-4 text-sm text-muted-foreground">
          <CheckCircle2 className="h-4 w-4 text-gold" />
          Noch keine Punkte im Zeitraum „{PERIOD_LABELS[period]}".
        </div>
      ) : (
        <ol className="space-y-2">
          {rows.map((row, index) => (
            <Link
              key={row.user_id}
              to="/coach/customers/$userId"
              params={{ userId: row.user_id }}
              className={`flex items-center gap-3 rounded-xl border bg-background/40 p-3 transition hover:border-gold/40 ${
                index === 0 ? "border-gold/40" : "border-border"
              }`}
            >
              <div className="w-8 shrink-0 text-center text-lg font-bold">{medal(index)}</div>
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gradient-gold text-xs font-bold text-primary-foreground">
                {(row.display_name ?? "??").slice(0, 2).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1 truncate text-sm font-semibold">
                {row.display_name ?? "Ohne Namen"}
              </div>
              <div className="shrink-0 text-right">
                <div className="font-display text-base font-bold text-gold">{row.points}</div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  Punkte
                </div>
              </div>
            </Link>
          ))}
        </ol>
      )}
    </div>
  );
}
