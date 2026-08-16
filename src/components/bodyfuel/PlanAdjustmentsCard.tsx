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
  type PlanAdjustmentResponse,
  type PlanAdjustmentVariant,
  type TrainingApplyAction,
} from "@/lib/plan-adjustments.functions";

export function PlanAdjustmentsCard({ userId }: { userId: string }) {
  const genFn = useServerFn(generatePlanAdjustments);
  const applyFn = useServerFn(applyNutritionAdjustment);
  const applyTrainFn = useServerFn(applyTrainingAdjustment);
  const historyFn = useServerFn(listPlanAdjustmentHistory);
  const qc = useQueryClient();
  const [data, setData] = useState<PlanAdjustmentResponse | null>(null);
  const [activeIdx, setActiveIdx] = useState<0 | 1>(0);
  const [appliedNutritionFor, setAppliedNutritionFor] = useState<number | null>(null);
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
      setData(res as PlanAdjustmentResponse);
      setActiveIdx(0);
      setAppliedNutritionFor(null);
    },
    onError: (e: any) => toast.error(e?.message ?? "Vorschlag fehlgeschlagen"),
  });

  const applyMut = useMutation({
    mutationFn: (n: { kcal: number; protein_g: number; carbs_g: number; fat_g: number; rationale?: string; idx: number }) => {
      const { idx, ...rest } = n;
      return applyFn({ data: { user_id: userId, ...rest } }).then((r) => ({ r, idx }));
    },
    onSuccess: ({ r, idx }) => {
      if ((r as any)?.applies_immediately) {
        toast.success("Ernährungsziele übernommen");
      } else {
        toast.success("Neue Zielbasis gespeichert", {
          description: "Der aktuell aktive Ernährungsplan bleibt unverändert. Die Werte gelten nach dem Planwechsel bzw. für den nächsten Plan.",
        });
      }
      setAppliedNutritionFor(idx);
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

  const active: PlanAdjustmentVariant | null = data?.variants?.[activeIdx] ?? null;
  const current = data?.current ?? null;

  const confidenceBadge =
    active?.confidence === "high"
      ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
      : active?.confidence === "medium"
        ? "border-amber-500/40 bg-amber-500/10 text-amber-300"
        : "border-muted-foreground/30 bg-muted/30 text-muted-foreground";

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-gold" />
          <div>
            <h3 className="font-display text-lg font-bold">Plan-Anpassungen</h3>
            <p className="text-xs text-muted-foreground">
              A/B-Vergleich: Konservativ vs. Aggressiv
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
              {data ? "Neu analysieren" : "Varianten generieren"}
            </>
          )}
        </button>
      </div>

      {!data && !genMut.isPending && (
        <div className="rounded-xl border border-dashed border-border/60 p-4 text-sm text-muted-foreground">
          Klicke „Varianten generieren", um zwei Vorschläge (vorsichtig &amp; aggressiv) zum Vergleich zu erhalten.
        </div>
      )}

      {data && active && (
        <div className="space-y-4">
          {/* Variant tabs */}
          <div className="grid grid-cols-2 gap-2 rounded-xl border border-border bg-background/40 p-1">
            {data.variants.map((v, i) => {
              const isActive = i === activeIdx;
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => setActiveIdx(i as 0 | 1)}
                  className={`rounded-lg px-3 py-2 text-xs font-semibold transition ${
                    isActive
                      ? "bg-gold/20 text-gold ring-1 ring-gold/50"
                      : "text-muted-foreground hover:bg-muted/30"
                  }`}
                >
                  {v.label}
                  {v.nutrition && current?.kcal != null && (
                    <span className="ml-2 text-[10px] font-normal opacity-80">
                      {v.nutrition.kcal - Number(current.kcal) > 0 ? "+" : ""}
                      {v.nutrition.kcal - Number(current.kcal)} kcal
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider ${confidenceBadge}`}>
              Konfidenz: {active.confidence}
            </span>
          </div>

          {active.summary && <p className="text-sm text-foreground">{active.summary}</p>}

          {active.warnings.length > 0 && (
            <div className="space-y-1 rounded-xl border border-amber-500/30 bg-amber-500/5 p-3">
              {active.warnings.map((w, i) => (
                <div key={i} className="flex items-start gap-2 text-xs text-amber-200">
                  <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>{w}</span>
                </div>
              ))}
            </div>
          )}

          {active.nutrition && (
            <div className="rounded-xl border border-border bg-background/40 p-4">
              <div className="mb-3 flex items-center gap-2">
                <Utensils className="h-4 w-4 text-gold" />
                <h4 className="font-semibold">Ernährungsziele</h4>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <MacroDelta label="kcal" current={current?.kcal ?? null} next={active.nutrition.kcal} unit="" />
                <MacroDelta label="Protein" current={current?.protein_g ?? null} next={active.nutrition.protein_g} unit="g" />
                <MacroDelta label="Kohlenhydrate" current={current?.carbs_g ?? null} next={active.nutrition.carbs_g} unit="g" />
                <MacroDelta label="Fett" current={current?.fat_g ?? null} next={active.nutrition.fat_g} unit="g" />
              </div>
              {active.nutrition.rationale && (
                <p className="mt-3 text-xs text-muted-foreground">{active.nutrition.rationale}</p>
              )}
              <div className="mt-4 flex justify-end">
                <button
                  type="button"
                  onClick={() =>
                    applyMut.mutate({
                      ...active.nutrition!,
                      rationale: `[${active.label}] ${active.nutrition!.rationale}`,
                      idx: activeIdx,
                    })
                  }
                  disabled={applyMut.isPending || appliedNutritionFor === activeIdx}
                  className="inline-flex items-center gap-2 rounded-xl bg-gold px-4 py-2 text-xs font-semibold text-primary-foreground transition hover:bg-gold/90 disabled:opacity-60"
                >
                  {appliedNutritionFor === activeIdx ? (
                    <>
                      <Check className="h-4 w-4" /> Übernommen
                    </>
                  ) : applyMut.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" /> Übernehme…
                    </>
                  ) : (
                    <>{active.label} übernehmen</>
                  )}
                </button>
              </div>
            </div>
          )}

          {active.training.length > 0 && (
            <div className="rounded-xl border border-border bg-background/40 p-4">
              <div className="mb-3 flex items-center gap-2">
                <Dumbbell className="h-4 w-4 text-gold" />
                <h4 className="font-semibold">Training</h4>
              </div>
              <ul className="space-y-3">
                {active.training.map((t, i) => {
                  const action = trainingActionFor(t);
                  const applicable = action !== null;
                  return (
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
                      <div className="mt-2 flex justify-end">
                        {applicable ? (
                          <button
                            type="button"
                            onClick={() =>
                              applyTrainMut.mutate({
                                ...action!,
                                rationale: `[${active.label}] ${t.rationale}`,
                              } as TrainingApplyAction)
                            }
                            disabled={applyTrainMut.isPending}
                            className="inline-flex items-center gap-2 rounded-lg border border-gold/40 bg-gold/10 px-3 py-1.5 text-[11px] font-semibold text-gold transition hover:bg-gold/20 disabled:opacity-50"
                          >
                            {applyTrainMut.isPending ? (
                              <><Loader2 className="h-3 w-3 animate-spin" /> Übernehme…</>
                            ) : (
                              <>Auf Plan anwenden</>
                            )}
                          </button>
                        ) : (
                          <span className="text-[10px] text-muted-foreground">Coach-Eingriff nötig</span>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>
      )}

      <div className="mt-5 border-t border-border/60 pt-4">
        <button
          type="button"
          onClick={() => setShowHistory((s) => !s)}
          className="inline-flex items-center gap-2 text-xs font-semibold text-muted-foreground hover:text-foreground"
        >
          <History className="h-3.5 w-3.5" />
          {showHistory ? "Verlauf ausblenden" : "Anpassungs-Verlauf"}
        </button>
        {showHistory && (
          <div className="mt-3 space-y-2">
            {historyQ.isLoading && (
              <p className="text-xs text-muted-foreground">Lade Verlauf…</p>
            )}
            {historyQ.data?.items?.length === 0 && (
              <p className="text-xs text-muted-foreground">Noch keine Anpassungen aufgezeichnet.</p>
            )}
            {historyQ.data?.items?.map((it: any) => (
              <div key={it.id} className="rounded-lg border border-border/60 bg-background/40 p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    {it.kind === "nutrition" ? (
                      <Utensils className="h-3.5 w-3.5 text-gold" />
                    ) : (
                      <Dumbbell className="h-3.5 w-3.5 text-gold" />
                    )}
                    <span className="text-xs font-semibold">{it.summary}</span>
                  </div>
                  <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    {new Date(it.created_at).toLocaleString("de-DE", {
                      day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit",
                    })}
                  </span>
                </div>
                {it.rationale && (
                  <p className="mt-1 text-[11px] text-muted-foreground">{it.rationale}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function trainingActionFor(t: PlanAdjustmentVariant["training"][number]): TrainingApplyAction | null {
  const detail = (t.detail ?? "").toLowerCase();
  if (t.area === "deload") {
    return { type: "deload", scale: 0.6, detail: t.detail, rationale: t.rationale };
  }
  if (t.area === "volume") {
    const m = detail.match(/([+-]?\d+)\s*(satz|sätze|set|sets)/);
    const delta = m ? Math.max(-2, Math.min(2, parseInt(m[1], 10))) : (detail.includes("reduzier") || detail.includes("weniger") ? -1 : 1);
    if (!delta) return null;
    return { type: "volume_delta", sets_delta: delta, detail: t.detail, rationale: t.rationale };
  }
  return null;
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
