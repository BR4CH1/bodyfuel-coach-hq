import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Printer, Calendar, ListChecks } from "lucide-react";
import { AppLayout } from "@/components/bodyfuel/AppLayout";
import { getPlanPreview } from "@/lib/plan-management.functions";

export const Route = createFileRoute("/coach/plan-preview/$planId")({
  head: () => ({ meta: [{ title: "Plan-Vorschau — Coach" }] }),
  component: () => (
    <AppLayout>
      <PreviewContent />
    </AppLayout>
  ),
  errorComponent: ({ error, reset }) => {
    const router = useRouter();
    return (
      <AppLayout>
        <div className="py-20 text-center">
          <p className="text-destructive">{error.message}</p>
          <button
            onClick={() => { reset(); router.invalidate(); }}
            className="mt-4 text-gold hover:underline"
          >
            Erneut versuchen
          </button>
        </div>
      </AppLayout>
    );
  },
  notFoundComponent: () => (
    <AppLayout>
      <div className="py-20 text-center text-muted-foreground">Plan nicht gefunden.</div>
    </AppLayout>
  ),
});

function fmtDate(s: string | null) {
  if (!s) return "—";
  return new Date(s).toLocaleDateString("de-DE", {
    day: "2-digit", month: "2-digit", year: "numeric",
  });
}

function PreviewContent() {
  const { planId } = Route.useParams();
  const previewFn = useServerFn(getPlanPreview);
  const { data, isLoading, error } = useQuery({
    queryKey: ["plan-preview", planId],
    queryFn: () => previewFn({ data: { plan_id: planId } }),
  });

  if (isLoading) {
    return <div className="py-20 text-center text-muted-foreground">Lade…</div>;
  }
  if (error) {
    return <div className="py-20 text-center text-destructive">{(error as Error).message}</div>;
  }
  if (!data) return null;

  const { plan, days, meals, exercises = [], planType = "nutrition" } = data as any;
  const isTraining = planType === "training";
  const mealsByDay = (dayId: string) =>
    meals.filter((m: any) => m.day_id === dayId).sort((a: any, b: any) => a.sort_order - b.sort_order);
  const exByDay = (dayId: string) =>
    exercises.filter((e: any) => e.day_id === dayId).sort((a: any, b: any) => a.sort_order - b.sort_order);

  return (
    <div className="mx-auto max-w-3xl space-y-6 py-6 print:py-0">
      <div className="flex items-center justify-between gap-3 print:hidden">
        <Link
          to="/coach/customers/$userId"
          params={{ userId: plan.client_id }}
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Zurück
        </Link>
        <button
          onClick={() => window.print()}
          className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium hover:bg-accent"
        >
          <Printer className="h-4 w-4" /> Als PDF drucken
        </button>
      </div>

      <header className="rounded-2xl border border-border bg-card p-6">
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Plan-Vorschau</p>
        <h1 className="mt-1 font-display text-2xl font-bold">{plan.title}</h1>
        <div className="mt-3 flex flex-wrap gap-4 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5" />
            {fmtDate(plan.scheduled_start_date)} – {fmtDate(plan.scheduled_end_date)}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <ListChecks className="h-3.5 w-3.5" />
            {days.length} Tage · {isTraining ? `${exercises.length} Übungen` : `${meals.length} Mahlzeiten`}
          </span>
        </div>
        {!isTraining && (plan.kcal || plan.protein_g) && (
          <div className="mt-4 grid grid-cols-4 gap-2 text-center text-xs">
            <Macro label="kcal" value={plan.kcal} />
            <Macro label="P" value={plan.protein_g} suffix="g" />
            <Macro label="KH" value={plan.carbs_g} suffix="g" />
            <Macro label="F" value={plan.fat_g} suffix="g" />
          </div>
        )}
      </header>

      <div className="space-y-6">
        {isTraining
          ? (() => {
              const weeks = Array.from(
                new Set(days.map((d: any) => d.week_number ?? 1)),
              ).sort((a, b) => (a as number) - (b as number));
              return weeks.map((wk) => (
                <div key={String(wk)} className="space-y-3">
                  <h2 className="px-1 text-xs font-bold uppercase tracking-[0.2em] text-gold">
                    Woche {wk as number}
                    {wk === 4 ? " · Deload" : ""}
                  </h2>
                  {days
                    .filter((d: any) => (d.week_number ?? 1) === wk)
                    .map((d: any) => (
                      <section
                        key={d.id}
                        className="rounded-2xl border border-border bg-card p-5 print:break-inside-avoid"
                      >
                        <h3 className="font-display text-lg font-bold">{d.name}</h3>
                        <ul className="mt-3 space-y-3">
                          {exByDay(d.id).map((e: any) => (
                            <li key={e.id} className="rounded-xl border border-border bg-background/40 p-4">
                              <div className="flex items-start justify-between gap-3">
                                <h4 className="font-semibold">{e.name}</h4>
                                {e.category && (
                                  <span className="rounded-md bg-muted px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                                    {e.category}
                                  </span>
                                )}
                              </div>
                              <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-muted-foreground">
                                {e.target_sets != null && (
                                  <span><strong className="text-foreground">{e.target_sets}</strong> Sätze</span>
                                )}
                                {e.target_reps && (
                                  <span>Wdh: <strong className="text-foreground">{e.target_reps}</strong></span>
                                )}
                                {e.target_weights && (
                                  <span>Gewicht: <strong className="text-foreground">{e.target_weights} kg</strong></span>
                                )}
                                {e.rest_seconds != null && (
                                  <span>Pause: <strong className="text-foreground">{e.rest_seconds}s</strong></span>
                                )}
                              </div>
                              {e.notes && (
                                <p className="mt-2 text-xs text-muted-foreground whitespace-pre-line">{e.notes}</p>
                              )}
                            </li>
                          ))}
                          {exByDay(d.id).length === 0 && (
                            <li className="text-sm text-muted-foreground">Keine Übungen.</li>
                          )}
                        </ul>
                      </section>
                    ))}
                </div>
              ));
            })()
          : days.map((d: any) => (
              <section key={d.id} className="rounded-2xl border border-border bg-card p-5 print:break-inside-avoid">
                <h2 className="font-display text-lg font-bold">{d.name}</h2>
                <ul className="mt-3 space-y-3">
                  {mealsByDay(d.id).map((m: any) => (
                    <li key={m.id} className="rounded-xl border border-border bg-background/40 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <h3 className="font-semibold">{m.name}</h3>
                      </div>
                      {m.description && (
                        <p className="mt-1 text-sm text-muted-foreground whitespace-pre-line">
                          {m.description}
                        </p>
                      )}
                      <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-muted-foreground">
                        {m.kcal != null && <span><strong className="text-foreground">{m.kcal}</strong> kcal</span>}
                        {m.protein_g != null && <span>P <strong className="text-foreground">{m.protein_g}g</strong></span>}
                        {m.carbs_g != null && <span>KH <strong className="text-foreground">{m.carbs_g}g</strong></span>}
                        {m.fat_g != null && <span>F <strong className="text-foreground">{m.fat_g}g</strong></span>}
                      </div>
                    </li>
                  ))}
                  {mealsByDay(d.id).length === 0 && (
                    <li className="text-sm text-muted-foreground">Keine Mahlzeiten.</li>
                  )}
                </ul>
              </section>
            ))}
        {days.length === 0 && (
          <div className="rounded-2xl border border-border bg-card p-6 text-center text-muted-foreground">
            Dieser Plan enthält noch keine Tage.
          </div>
        )}
      </div>
    </div>
  );
}

function Macro({ label, value, suffix }: { label: string; value: number | null; suffix?: string }) {
  return (
    <div className="rounded-md bg-background/60 px-2 py-2">
      <div className="text-[10px] uppercase text-muted-foreground">{label}</div>
      <div className="font-semibold">{value ?? "—"}{suffix ?? ""}</div>
    </div>
  );
}
