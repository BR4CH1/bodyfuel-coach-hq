import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { Apple, Dumbbell, RefreshCw, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import {
  getSmartRenewalStatus,
  renewSmartNutritionPlan,
  renewSmartTrainingPlan,
} from "@/lib/smart-renewal.functions";
import { Button } from "@/components/ui/button";

/**
 * Wird nur für Smart-Kunden angezeigt, deren Plan in <= 7 Tagen abläuft
 * (oder bereits abgelaufen ist). Trainingsplan-Verlängerung blockiert, wenn
 * letzter Strength-Check älter als 1 Monat.
 */
export function SmartRenewalCard() {
  const fn = useServerFn(getSmartRenewalStatus);
  const renewNutrition = useServerFn(renewSmartNutritionPlan);
  const renewTraining = useServerFn(renewSmartTrainingPlan);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["smart-renewal-status"],
    queryFn: () => fn(),
    staleTime: 60_000,
    retry: false,
  });

  const nutritionMut = useMutation({
    mutationFn: () => renewNutrition(),
    onSuccess: () => {
      toast.success("Neuer Ernährungsplan wird erstellt — kommt in wenigen Sekunden.");
      qc.invalidateQueries({ queryKey: ["smart-renewal-status"] });
      qc.invalidateQueries({ queryKey: ["active-nutrition-plan"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Verlängerung fehlgeschlagen"),
  });
  const trainingMut = useMutation({
    mutationFn: () => renewTraining(),
    onSuccess: () => {
      toast.success("Neuer Trainingsplan wird erstellt — kommt in wenigen Sekunden.");
      qc.invalidateQueries({ queryKey: ["smart-renewal-status"] });
      qc.invalidateQueries({ queryKey: ["active-training-plan"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Verlängerung fehlgeschlagen"),
  });

  if (isLoading || !data?.is_smart) return null;
  const showN =
    data.nutrition.days_until_end == null ||
    data.nutrition.days_until_end <= 7;
  const showT =
    data.training.days_until_end == null || data.training.days_until_end <= 7;
  if (!showN && !showT) return null;

  const subBlocked = data.subscription && !data.subscription.active;

  return (
    <div className="rounded-2xl border border-gold/40 bg-gradient-to-br from-gold/10 to-transparent p-4">
      <div className="mb-3 flex items-center gap-2">
        <RefreshCw className="h-4 w-4 text-gold" />
        <h3 className="font-display text-base font-bold">Plan verlängern</h3>
      </div>
      {subBlocked && (
        <div className="mb-3 rounded-xl border border-destructive/40 bg-destructive/5 p-3 text-xs text-muted-foreground">
          <div className="mb-1 flex items-center gap-2 text-sm font-semibold text-destructive">
            <AlertTriangle className="h-4 w-4" />
            Abo nicht aktiv
          </div>
          Verlängerung erst möglich, wenn die nächste Zahlung durch ist
          {data.subscription?.status ? ` (Status: ${data.subscription.status})` : ""}.
        </div>
      )}
      <div className="space-y-3">
        {showN && (
          <RenewRow
            icon={<Apple className="h-4 w-4" />}
            title="Ernährungsplan (4 Wochen)"
            sub={
              data.nutrition.days_until_end != null && data.nutrition.days_until_end >= 0
                ? `Aktuell läuft noch ${data.nutrition.days_until_end} Tage`
                : "Bereits abgelaufen"
            }
            disabled={nutritionMut.isPending || subBlocked}
            onClick={() => nutritionMut.mutate()}
            label={nutritionMut.isPending ? "Wird erstellt…" : "Verlängern"}
          />

        )}
        {showT && (
          <>
            {data.training.blocked_by_strength_check ? (
              <BlockedRow
                title="Trainingsplan (6 Wochen)"
                sub={
                  data.training.last_check_days_ago == null
                    ? "Noch kein Strength-Check abgeschlossen"
                    : `Letzter Strength-Check vor ${data.training.last_check_days_ago} Tagen`
                }
              />
            ) : (
              <RenewRow
                icon={<Dumbbell className="h-4 w-4" />}
                title="Trainingsplan (6 Wochen)"
                sub={
                  data.training.days_until_end != null && data.training.days_until_end >= 0
                    ? `Aktuell läuft noch ${data.training.days_until_end} Tage`
                    : "Bereits abgelaufen"
                }
                disabled={trainingMut.isPending || subBlocked}
                onClick={() => trainingMut.mutate()}
                label={trainingMut.isPending ? "Wird erstellt…" : "Verlängern"}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}

function RenewRow({
  icon,
  title,
  sub,
  onClick,
  disabled,
  label,
}: {
  icon: React.ReactNode;
  title: string;
  sub: string;
  onClick: () => void;
  disabled: boolean;
  label: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl bg-card/60 p-3">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 text-sm font-semibold">
          {icon}
          {title}
        </div>
        <p className="text-xs text-muted-foreground">{sub}</p>
      </div>
      <Button
        size="sm"
        onClick={onClick}
        disabled={disabled}
        className="bg-gradient-gold text-primary-foreground"
      >
        {label}
      </Button>
    </div>
  );
}

function BlockedRow({ title, sub }: { title: string; sub: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-destructive/40 bg-destructive/5 p-3">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <AlertTriangle className="h-4 w-4 text-destructive" />
          {title}
        </div>
        <p className="text-xs text-muted-foreground">
          {sub} — bitte zuerst neu durchführen.
        </p>
      </div>
      <Link to="/strength-check">
        <Button size="sm" variant="outline">
          Strength-Check
        </Button>
      </Link>
    </div>
  );
}
