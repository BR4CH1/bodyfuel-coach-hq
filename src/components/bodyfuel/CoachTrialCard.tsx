import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Plus, X, ShieldCheck, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  coachExtendTrial,
  coachEndTrial,
  coachActivateMember,
} from "@/lib/trial.functions";
import { Button } from "@/components/ui/button";

type TrialProfile = {
  trial_status: "none" | "trial" | "trial_expired" | "active";
  trial_start: string | null;
  trial_end: string | null;
};

function fmt(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("de-DE");
}

function daysLeft(end: string | null): number | null {
  if (!end) return null;
  const ms = new Date(`${end}T23:59:59Z`).getTime() - Date.now();
  return Math.ceil(ms / 86_400_000);
}

export function CoachTrialCard({ userId }: { userId: string }) {
  const qc = useQueryClient();
  const extendFn = useServerFn(coachExtendTrial);
  const endFn = useServerFn(coachEndTrial);
  const activateFn = useServerFn(coachActivateMember);

  const { data, isLoading } = useQuery<TrialProfile | null>({
    queryKey: ["customer-trial", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("trial_status, trial_start, trial_end")
        .eq("id", userId)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return (data ?? null) as TrialProfile | null;
    },
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["customer-trial", userId] });
    qc.invalidateQueries({ queryKey: ["customer", userId] });
    qc.invalidateQueries({ queryKey: ["customers"] });
    qc.invalidateQueries({ queryKey: ["trial-users"] });
  };

  const extend = useMutation({
    mutationFn: (days: number) => extendFn({ data: { user_id: userId, days } }),
    onSuccess: (_d, days) => {
      toast.success(`Trial um ${days} Tage verlängert.`);
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const end = useMutation({
    mutationFn: () => endFn({ data: { user_id: userId } }),
    onSuccess: () => {
      toast.success("Trial beendet.");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const activate = useMutation({
    mutationFn: () => activateFn({ data: { user_id: userId } }),
    onSuccess: () => {
      toast.success("Mitgliedschaft aktiviert.");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) {
    return (
      <div className="rounded-2xl border border-border bg-card p-6">
        <p className="text-sm text-muted-foreground">Trial-Status wird geladen …</p>
      </div>
    );
  }

  const status = data?.trial_status ?? "none";
  const dLeft = daysLeft(data?.trial_end ?? null);

  const badge = (() => {
    switch (status) {
      case "trial":
        return {
          label: "Trial aktiv",
          cls: "bg-gold/15 text-gold",
        };
      case "trial_expired":
        return {
          label: "Trial abgelaufen",
          cls: "bg-destructive/15 text-destructive",
        };
      case "active":
        return {
          label: "Aktives Mitglied",
          cls: "bg-emerald-500/15 text-emerald-500",
        };
      default:
        return {
          label: "Kein Trial",
          cls: "bg-muted text-muted-foreground",
        };
    }
  })();

  return (
    <div className="rounded-2xl border border-border bg-card p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-bold">Trial & Mitgliedschaft</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Verlängere den Test oder schalte den Vollzugang frei.
          </p>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-wider ${badge.cls}`}
        >
          {badge.label}
        </span>
      </div>

      <div className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-background/40 p-3">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
            Trial-Start
          </div>
          <div className="mt-0.5 font-display font-bold">{fmt(data?.trial_start ?? null)}</div>
        </div>
        <div className="rounded-xl border border-border bg-background/40 p-3">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
            Trial-Ende
          </div>
          <div className="mt-0.5 font-display font-bold">{fmt(data?.trial_end ?? null)}</div>
        </div>
        <div className="rounded-xl border border-border bg-background/40 p-3">
          <div className="flex items-center gap-1 text-[11px] uppercase tracking-wider text-muted-foreground">
            <Clock className="h-3 w-3" /> Resttage
          </div>
          <div className="mt-0.5 font-display font-bold">
            {status === "trial" && dLeft !== null
              ? `${Math.max(0, dLeft)} Tage`
              : status === "trial_expired"
                ? "0 Tage"
                : "—"}
          </div>
        </div>
      </div>

      <div className="mt-5 space-y-3">
        <div>
          <div className="mb-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            Trial verlängern
          </div>
          <div className="flex flex-wrap gap-2">
            {[7, 14, 30].map((d) => (
              <Button
                key={d}
                size="sm"
                variant="outline"
                disabled={extend.isPending || status === "active"}
                onClick={() => extend.mutate(d)}
              >
                <Plus className="mr-1 h-3.5 w-3.5" />
                {d} Tage
              </Button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            className="bg-gradient-gold text-primary-foreground"
            disabled={activate.isPending || status === "active"}
            onClick={() => activate.mutate()}
          >
            <ShieldCheck className="mr-1 h-4 w-4" />
            Mitglied aktivieren
          </Button>
          {(status === "trial") && (
            <Button
              size="sm"
              variant="outline"
              className="text-destructive hover:text-destructive"
              disabled={end.isPending}
              onClick={() => {
                if (window.confirm("Trial sofort beenden? Funktionen werden gesperrt.")) {
                  end.mutate();
                }
              }}
            >
              <X className="mr-1 h-4 w-4" />
              Trial beenden
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
