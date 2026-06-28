import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Plus, X, ShieldCheck, Clock, Flame, Euro } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  coachExtendTrial,
  coachEndTrial,
  coachActivateMember,
  coachStartTrial,
} from "@/lib/trial.functions";
import { coachCreatePackage } from "@/lib/coaching.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

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
  const startFn = useServerFn(coachStartTrial);
  const createPkgFn = useServerFn(coachCreatePackage);

  const [customDays, setCustomDays] = useState<number>(7);
  const [startDays, setStartDays] = useState<number>(7);

  // Mitgliedschaft mit Preis einrichten
  const [pkgKey, setPkgKey] = useState<"smart" | "coaching" | "starter" | "premium">("smart");
  const [pkgPrice, setPkgPrice] = useState<string>("14.99");
  const [pkgStart, setPkgStart] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [pkgDuration, setPkgDuration] = useState<number>(30);
  const [pkgNotes, setPkgNotes] = useState<string>("");

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
    qc.invalidateQueries({ queryKey: ["coach-trials"] });
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

  const start = useMutation({
    mutationFn: (days: number) => startFn({ data: { user_id: userId, days } }),
    onSuccess: (_d, days) => {
      toast.success(`Trial über ${days} Tage gestartet.`);
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const createPkg = useMutation({
    mutationFn: () => {
      const price = Number.parseFloat(pkgPrice.replace(",", "."));
      if (!Number.isFinite(price) || price < 0) throw new Error("Ungültiger Preis");
      return createPkgFn({
        data: {
          user_id: userId,
          package: pkgKey,
          price_eur: price,
          start_date: pkgStart,
          duration_days: pkgDuration,
          notes: pkgNotes.trim() || undefined,
        },
      });
    },
    onSuccess: () => {
      toast.success("Mitgliedschaft eingerichtet.");
      setPkgNotes("");
      refresh();
      qc.invalidateQueries({ queryKey: ["my-package"] });
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
  const canStartNewTrial = status === "active" || status === "none" || status === "trial_expired";

  const badge = (() => {
    switch (status) {
      case "trial":
        return { label: "Trial aktiv", cls: "bg-gold/15 text-gold" };
      case "trial_expired":
        return { label: "Trial abgelaufen", cls: "bg-destructive/15 text-destructive" };
      case "active":
        return { label: "Aktives Mitglied", cls: "bg-emerald-500/15 text-emerald-500" };
      default:
        return { label: "Kein Trial", cls: "bg-muted text-muted-foreground" };
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
        <span className={`rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-wider ${badge.cls}`}>
          {badge.label}
        </span>
      </div>

      <div className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-background/40 p-3">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Trial-Start</div>
          <div className="mt-0.5 font-display font-bold">{fmt(data?.trial_start ?? null)}</div>
        </div>
        <div className="rounded-xl border border-border bg-background/40 p-3">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Trial-Ende</div>
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

      <div className="mt-5 space-y-4">
        {canStartNewTrial && (
          <div className="rounded-xl border border-gold/30 bg-gold/5 p-3">
            <div className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-gold">
              <Flame className="h-3.5 w-3.5" /> Neues Trial starten
            </div>
            <div className="flex flex-wrap items-end gap-2">
              <div className="flex-1 min-w-[120px]">
                <Label htmlFor="trial-start-days" className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  Dauer (Tage)
                </Label>
                <Input
                  id="trial-start-days"
                  type="number"
                  min={1}
                  max={365}
                  value={startDays}
                  onChange={(e) => setStartDays(Math.max(1, Math.min(365, Number(e.target.value) || 1)))}
                  className="mt-1 h-9"
                />
              </div>
              <div className="flex flex-wrap gap-1">
                {[7, 14, 30].map((d) => (
                  <Button
                    key={d}
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => setStartDays(d)}
                    className="h-9 px-2 text-xs"
                  >
                    {d}T
                  </Button>
                ))}
              </div>
              <Button
                size="sm"
                className="h-9 bg-gradient-gold text-primary-foreground"
                disabled={start.isPending}
                onClick={() => {
                  if (status === "active" && !window.confirm("Mitgliedschaft beenden und Trial starten?")) return;
                  start.mutate(startDays);
                }}
              >
                <Flame className="mr-1 h-4 w-4" />
                Trial starten
              </Button>
            </div>
          </div>
        )}

        {(status === "trial" || status === "trial_expired") && (
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
                  disabled={extend.isPending}
                  onClick={() => extend.mutate(d)}
                >
                  <Plus className="mr-1 h-3.5 w-3.5" />
                  {d} Tage
                </Button>
              ))}
            </div>
            <div className="mt-2 flex items-end gap-2">
              <div className="flex-1 max-w-[160px]">
                <Label htmlFor="trial-extend-days" className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  Eigene Dauer
                </Label>
                <Input
                  id="trial-extend-days"
                  type="number"
                  min={1}
                  max={365}
                  value={customDays}
                  onChange={(e) => setCustomDays(Math.max(1, Math.min(365, Number(e.target.value) || 1)))}
                  className="mt-1 h-9"
                />
              </div>
              <Button
                size="sm"
                variant="outline"
                disabled={extend.isPending}
                onClick={() => extend.mutate(customDays)}
              >
                <Plus className="mr-1 h-3.5 w-3.5" />
                {customDays} Tage
              </Button>
            </div>
          </div>
        )}

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
          {status === "trial" && (
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
