import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Sparkles, Loader2, AlertCircle, Check, Dumbbell, Utensils, History, Clock } from "lucide-react";
import { toast } from "sonner";
import {
  generatePlanAdjustments,
  applyNutritionAdjustment,
  applyTrainingAdjustment,
  listPlanAdjustmentHistory,
  type PlanAdjustmentSuggestion,
  type TrainingApplyAction,
} from "@/lib/plan-adjustments.functions";

type WithCurrent = PlanAdjustmentSuggestion & {
  current: {
    kcal: number;
    protein_g: number;
    carbs_g: number;
    fat_g: number;
  } | null;
};

export function PlanAdjustmentsCard({ userId }: { userId: string }) {
  const genFn = useServerFn(generatePlanAdjustments);
  const applyFn = useServerFn(applyNutritionAdjustment);
  const applyTrainFn = useServerFn(applyTrainingAdjustment);
  const historyFn = useServerFn(listPlanAdjustmentHistory);
  const qc = useQueryClient();
  const [data, setData] = useState<WithCurrent | null>(null);
  const [applied, setApplied] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  const historyKey = ["plan-adj-history", userId];
  const historyQ = useQuery({
    queryKey: historyKey,
    queryFn: () => historyFn({ data: { user_id: userId, limit: 20 } }),
    enabled: showHistory,
  });

  const genMut = useMutation({
    mutationFn: () => genFn({ data: { user_id: userId } }),
    onSuccess: (res) => {
      setData(res as WithCurrent);
      setApplied(false);
    },
    onError: (e: any) => toast.error(e?.message ?? "KI-Vorschlag fehlgeschlagen"),
  });

  const applyMut = useMutation({
    mutationFn: (n: { kcal: number; protein_g: number; carbs_g: number; fat_g: number; rationale?: string }) =>
      applyFn({ data: { user_id: userId, ...n } }),
    onSuccess: () => {
      toast.success("Ernährungsziele übernommen");
      setApplied(true);
      qc.invalidateQueries({ queryKey: historyKey });
    },
    onError: (e: any) => toast.error(e?.message ?? "Übernahme fehlgeschlagen"),
  });

  const applyTrainMut = useMutation({
    mutationFn: (action: TrainingApplyAction) =>
      applyTrainFn({ data: { user_id: userId, action } }),
    onSuccess: (r: any) => {
      toast.success(r?.summary ?? "Trainings-Anpassung übernommen");
      qc.invalidateQueries({ queryKey: historyKey });
    },
    onError: (e: any) => toast.error(e?.message ?? "Übernahme fehlgeschlagen"),
  });

  const confidenceBadge =
    data?.confidence === "high"
      ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
      : data?.confidence === "medium"
        ? "border-amber-500/40 bg-amber-500/10 text-amber-300"
        : "border-muted-foreground/30 bg-muted/30 text-muted-foreground";

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-gold" />
          <div>
            <h3 className="font-display text-lg font-bold">KI Plan-Anpassungen</h3>
            <p className="text-xs text-muted-foreground">
              Datenbasierte Vorschläge für kcal/Makros und Training
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => genMut.mutate()}
          disabled={genMut.isPending}
          className="inline-flex items-center gap-2 rounded-xl border border-gold/40 bg-gold/10 px-3 py-2 text-xs font-semibold text-gold transition hover:bg-gold/20 disabled:opacity-50"
        >
          {genMut.isPending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Analysiere…
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4" />
              {data ? "Neu analysieren" : "Vorschlag generieren"}
            </>
          )}
        </button>
      </div>

      {!data && !genMut.isPending && (
        <div className="rounded-xl border border-dashed border-border/60 p-4 text-sm text-muted-foreground">
          Klicke „Vorschlag generieren", um eine KI-gestützte Plan-Anpassung zu erhalten.
        </div>
      )}

      {data && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider ${confidenceBadge}`}>
              Konfidenz: {data.confidence}
            </span>
          </div>

          {data.summary && (
            <p className="text-sm text-foreground">{data.summary}</p>
          )}

          {data.warnings.length > 0 && (
            <div className="space-y-1 rounded-xl border border-amber-500/30 bg-amber-500/5 p-3">
              {data.warnings.map((w, i) => (
                <div key={i} className="flex items-start gap-2 text-xs text-amber-200">
                  <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>{w}</span>
                </div>
              ))}
            </div>
          )}

          {data.nutrition && (
            <div className="rounded-xl border border-border bg-background/40 p-4">
              <div className="mb-3 flex items-center gap-2">
                <Utensils className="h-4 w-4 text-gold" />
                <h4 className="font-semibold">Ernährungsziele</h4>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <MacroDelta label="kcal" current={data.current?.kcal ?? null} next={data.nutrition.kcal} unit="" />
                <MacroDelta label="Protein" current={data.current?.protein_g ?? null} next={data.nutrition.protein_g} unit="g" />
                <MacroDelta label="Kohlenhydrate" current={data.current?.carbs_g ?? null} next={data.nutrition.carbs_g} unit="g" />
                <MacroDelta label="Fett" current={data.current?.fat_g ?? null} next={data.nutrition.fat_g} unit="g" />
              </div>
              {data.nutrition.rationale && (
                <p className="mt-3 text-xs text-muted-foreground">{data.nutrition.rationale}</p>
              )}
              <div className="mt-4 flex justify-end">
                <button
                  type="button"
                  onClick={() => applyMut.mutate(data.nutrition!)}
                  disabled={applyMut.isPending || applied}
                  className="inline-flex items-center gap-2 rounded-xl bg-gold px-4 py-2 text-xs font-semibold text-primary-foreground transition hover:bg-gold/90 disabled:opacity-60"
                >
                  {applied ? (
                    <>
                      <Check className="h-4 w-4" /> Übernommen
                    </>
                  ) : applyMut.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" /> Übernehme…
                    </>
                  ) : (
                    <>Ziele übernehmen</>
                  )}
                </button>
              </div>
            </div>
          )}

          {data.training.length > 0 && (
            <div className="rounded-xl border border-border bg-background/40 p-4">
              <div className="mb-3 flex items-center gap-2">
                <Dumbbell className="h-4 w-4 text-gold" />
                <h4 className="font-semibold">Training</h4>
              </div>
              <ul className="space-y-3">
                {data.training.map((t, i) => (
                  <li key={i} className="rounded-lg border border-border/60 bg-background/40 p-3">
                    <div className="mb-1 flex items-center gap-2">
                      <span className="rounded-md border border-border bg-muted/40 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                        {t.area}
                      </span>
                    </div>
                    <p className="text-sm font-medium">{t.detail}</p>
                    {t.rationale && (
                      <p className="mt-1 text-xs text-muted-foreground">{t.rationale}</p>
                    )}
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-[11px] text-muted-foreground">
                Trainings-Vorschläge werden nicht automatisch übernommen — Coach passt den Plan manuell an.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function MacroDelta({
  label,
  current,
  next,
  unit,
}: {
  label: string;
  current: number | null;
  next: number;
  unit: string;
}) {
  const delta = current != null ? next - current : null;
  const deltaStr =
    delta == null ? "neu" : delta > 0 ? `+${delta}` : delta < 0 ? `${delta}` : "±0";
  const deltaCls =
    delta == null
      ? "text-muted-foreground"
      : delta > 0
        ? "text-emerald-300"
        : delta < 0
          ? "text-red-300"
          : "text-muted-foreground";
  return (
    <div className="rounded-lg border border-border/60 bg-background/40 p-3">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-bold">
        {next}
        {unit && <span className="ml-0.5 text-xs font-normal text-muted-foreground">{unit}</span>}
      </p>
      <p className="text-[11px] text-muted-foreground">
        zuvor: {current != null ? `${current}${unit}` : "—"} ·{" "}
        <span className={`font-semibold ${deltaCls}`}>{deltaStr}</span>
      </p>
    </div>
  );
}
