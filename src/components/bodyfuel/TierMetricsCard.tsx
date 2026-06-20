import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Users, MousePointerClick, TrendingUp } from "lucide-react";
import { getTierMetrics } from "@/lib/upgrade-events.functions";

export function TierMetricsCard() {
  const fn = useServerFn(getTierMetrics);
  const { data, isLoading } = useQuery({
    queryKey: ["tier-metrics"],
    queryFn: () => fn(),
    refetchInterval: 60_000,
  });

  return (
    <div className="rounded-2xl border border-border bg-card p-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs uppercase tracking-[0.2em] text-gold">Tarif-Kennzahlen</div>
          <h3 className="mt-1 font-display text-xl font-bold">Nutzer & Conversions</h3>
        </div>
        <Users className="h-5 w-5 text-muted-foreground" />
      </div>

      {isLoading || !data ? (
        <div className="mt-4 text-sm text-muted-foreground">Lade …</div>
      ) : (
        <>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Free" value={data.active.free} />
            <Stat label="Trial" value={data.active.trial} />
            <Stat label="Smart" value={data.active.smart} />
            <Stat label="Coaching" value={data.active.coaching} />
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-border bg-background/40 p-4">
              <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
                <MousePointerClick className="h-3.5 w-3.5" /> Upgrade-Klicks
              </div>
              <div className="mt-2 flex items-baseline gap-4">
                <div>
                  <div className="font-display text-2xl font-bold">{data.clicks.last7}</div>
                  <div className="text-[11px] text-muted-foreground">letzte 7 Tage</div>
                </div>
                <div>
                  <div className="font-display text-2xl font-bold">{data.clicks.last30}</div>
                  <div className="text-[11px] text-muted-foreground">letzte 30 Tage</div>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-border bg-background/40 p-4">
              <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
                <TrendingUp className="h-3.5 w-3.5" /> Conversions (30T)
              </div>
              <div className="mt-2 space-y-1 text-sm">
                <Row label="Trial → Smart" value={data.conversions.trial_to_smart} />
                <Row label="Trial → Coaching" value={data.conversions.trial_to_coaching} />
                <Row label="Free → Smart" value={data.conversions.free_to_smart} />
                <Row label="Free → Coaching" value={data.conversions.free_to_coaching} />
                <Row label="Smart → Coaching" value={data.conversions.smart_to_coaching} />
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-border bg-background/40 p-4">
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-1 font-display text-2xl font-bold text-gold">{value}</div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-semibold">{value}</span>
    </div>
  );
}
