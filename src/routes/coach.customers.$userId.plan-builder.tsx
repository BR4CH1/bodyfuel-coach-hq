import { createFileRoute, useParams, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  listMealLibrary,
  getCustomerPlanContext,
  saveBuilderPlan,
  type LibraryMeal,
  type CustomerPlanContext,
  type BuilderDay,
  type BuilderMeal,
} from "@/lib/plan-builder.functions";
import { ArrowLeft, Lock, Trash2, Copy } from "lucide-react";

export const Route = createFileRoute("/coach/customers/$userId/plan-builder")({
  head: () => ({ meta: [{ title: "Plan Builder" }] }),
  component: PlanBuilderPage,
});

type Slot = "breakfast" | "lunch" | "dinner" | "snack";
const SLOTS: { key: Slot; label: string }[] = [
  { key: "breakfast", label: "Frühstück" },
  { key: "lunch", label: "Mittagessen" },
  { key: "dinner", label: "Abendessen" },
  { key: "snack", label: "Snack" },
];

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}
function addDays(iso: string, n: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return isoDate(d);
}

function PlanBuilderPage() {
  const { userId } = useParams({ from: "/coach/customers/$userId/plan-builder" });
  const navigate = useNavigate();
  const listLib = useServerFn(listMealLibrary);
  const getCtx = useServerFn(getCustomerPlanContext);
  const save = useServerFn(saveBuilderPlan);

  const libQ = useQuery({ queryKey: ["meal-library"], queryFn: () => listLib() });
  const ctxQ = useQuery({
    queryKey: ["plan-ctx", userId],
    queryFn: () => getCtx({ data: { customerId: userId } }),
  });

  const [startDate, setStartDate] = useState(isoDate(new Date()));
  const [numDays, setNumDays] = useState(7);
  const [title, setTitle] = useState("Wochenplan");
  const [saving, setSaving] = useState(false);

  const trainingWeekdays = ctxQ.data?.trainingWeekdays ?? [];
  const [days, setDays] = useState<BuilderDay[]>(() => []);

  // Rebuild empty day scaffold whenever start/num changes AND days is empty
  useMemo(() => {
    setDays((prev) => {
      const next: BuilderDay[] = [];
      for (let i = 0; i < numDays; i++) {
        const iso = addDays(startDate, i);
        const weekday = new Date(iso + "T00:00:00Z").getUTCDay();
        const isTrain = trainingWeekdays.includes(weekday);
        const existing = prev[i];
        next.push({
          name: `Tag ${i + 1}`,
          type: existing?.type ?? (isTrain ? "training" : "rest"),
          meals: existing?.meals ?? [],
        });
      }
      return next;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startDate, numDays, trainingWeekdays.join(",")]);

  const setDay = (idx: number, upd: (d: BuilderDay) => BuilderDay) => {
    setDays((prev) => prev.map((d, i) => (i === idx ? upd(d) : d)));
  };

  const handleSave = async (publish: boolean) => {
    try {
      setSaving(true);
      await save({ data: { customerId: userId, title, startDate, days, publish } } as any);
      toast.success(publish ? "Plan veröffentlicht" : "Plan als Entwurf gespeichert");
      navigate({ to: "/coach/customers/$userId", params: { userId } });
    } catch (e: any) {
      toast.error(e?.message ?? "Speichern fehlgeschlagen");
    } finally {
      setSaving(false);
    }
  };

  const copyDay = (idx: number) => {
    setDays((prev) => {
      const src = prev[idx];
      if (!src) return prev;
      const next = [...prev];
      for (let i = idx + 1; i < next.length; i++) {
        if (next[i].type === src.type) {
          next[i] = { ...next[i], meals: src.meals.map((m) => ({ ...m, ingredients: m.ingredients.map((x) => ({ ...x })) })) };
          break;
        }
      }
      return next;
    });
  };

  if (libQ.isLoading || ctxQ.isLoading) {
    return <div className="p-6 text-sm text-muted-foreground">Lade …</div>;
  }
  if (libQ.error) return <div className="p-6 text-sm text-destructive">Bibliothek konnte nicht geladen werden.</div>;

  return (
    <div className="mx-auto max-w-4xl space-y-4 p-4 pb-32">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={() => navigate({ to: "/coach/customers/$userId", params: { userId } })}>
          <ArrowLeft className="mr-1 h-4 w-4" /> Zurück
        </Button>
        <h1 className="font-display text-lg font-bold">Plan manuell erstellen</h1>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Zeitraum</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div>
            <Label>Titel</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div>
            <Label>Startdatum</Label>
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>
          <div>
            <Label>Anzahl Tage</Label>
            <Input type="number" min={1} max={28} value={numDays} onChange={(e) => setNumDays(Math.max(1, Math.min(28, Number(e.target.value) || 1)))} />
          </div>
        </CardContent>
      </Card>

      {ctxQ.data && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Kundenprofil</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-xs">
            <div className="flex flex-wrap gap-1">
              <Badge variant="outline">Trainingstag: {ctxQ.data.targets.kcal_train} kcal · {ctxQ.data.targets.protein_train}P/{ctxQ.data.targets.carbs_train}C/{ctxQ.data.targets.fat_train}F</Badge>
              <Badge variant="outline">Restday: {ctxQ.data.targets.kcal_rest} kcal · {ctxQ.data.targets.protein_rest}P/{ctxQ.data.targets.carbs_rest}C/{ctxQ.data.targets.fat_rest}F</Badge>
            </div>
            {ctxQ.data.dietStyle && <div>Ernährungsform: <b>{ctxQ.data.dietStyle}</b></div>}
            {ctxQ.data.allergies.length > 0 && <div>Allergien: {ctxQ.data.allergies.join(", ")}</div>}
            {ctxQ.data.noGoFoods.length > 0 && <div>No-Gos: {ctxQ.data.noGoFoods.join(", ")}</div>}
            {ctxQ.data.favoriteFoods.length > 0 && <div className="text-emerald-500">Lieblingsfoods: {ctxQ.data.favoriteFoods.join(", ")}</div>}
          </CardContent>
        </Card>
      )}

      {days.map((day, di) => (
        <DayCard
          key={di}
          day={day}
          library={libQ.data ?? []}
          ctx={ctxQ.data!}
          onChange={(u) => setDay(di, u)}
          onCopy={() => copyDay(di)}
        />
      ))}

      <div className="sticky bottom-0 flex gap-2 border-t border-border bg-background/95 p-3 backdrop-blur">
        <Button variant="outline" className="flex-1" disabled={saving} onClick={() => handleSave(false)}>
          Als Entwurf speichern
        </Button>
        <Button className="flex-1" disabled={saving} onClick={() => handleSave(true)}>
          Veröffentlichen
        </Button>
      </div>
    </div>
  );
}

// ---------- Day card + balance ----------
function DayCard({
  day, library, ctx, onChange, onCopy,
}: {
  day: BuilderDay;
  library: LibraryMeal[];
  ctx: CustomerPlanContext;
  onChange: (u: (d: BuilderDay) => BuilderDay) => void;
  onCopy: () => void;
}) {
  const target = day.type === "training"
    ? { kcal: ctx.targets.kcal_train, p: ctx.targets.protein_train, c: ctx.targets.carbs_train, f: ctx.targets.fat_train }
    : { kcal: ctx.targets.kcal_rest, p: ctx.targets.protein_rest, c: ctx.targets.carbs_rest, f: ctx.targets.fat_rest };
  const totals = day.meals.reduce(
    (acc, m) => {
      const lib = library.find((x) => x.id === m.library_meal_id);
      if (lib) {
        acc.kcal += Number(lib.kcal); acc.p += Number(lib.protein_g); acc.c += Number(lib.carbs_g); acc.f += Number(lib.fat_g);
      }
      return acc;
    },
    { kcal: 0, p: 0, c: 0, f: 0 },
  );
  const color = (diff: number, target: number) => {
    const pct = target ? Math.abs(diff) / target : 0;
    if (pct <= 0.05) return "text-emerald-500";
    if (pct <= 0.1) return "text-amber-500";
    return "text-destructive";
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div className="flex items-center gap-2">
          <CardTitle className="text-sm">{day.name}</CardTitle>
          <Badge variant={day.type === "training" ? "default" : "secondary"} className="cursor-pointer" onClick={() => onChange((d) => ({ ...d, type: d.type === "training" ? "rest" : "training" }))}>
            {day.type === "training" ? "Trainingstag" : "Restday"}
          </Badge>
        </div>
        <Button size="sm" variant="ghost" onClick={onCopy}><Copy className="mr-1 h-3 w-3" />auf nächsten Tag</Button>
      </CardHeader>
      <CardContent className="space-y-2">
        {/* Balance */}
        <div className="grid grid-cols-4 gap-2 rounded-lg bg-muted p-2 text-[11px]">
          {([
            ["kcal", totals.kcal, target.kcal, "kcal"],
            ["P", totals.p, target.p, "g"],
            ["C", totals.c, target.c, "g"],
            ["F", totals.f, target.f, "g"],
          ] as const).map(([k, v, t, u]) => {
            const diff = Math.round(v - t);
            return (
              <div key={k} className="text-center">
                <div className="text-muted-foreground">{k}</div>
                <div className="font-mono">{Math.round(v)}/{t}{u}</div>
                <div className={`font-mono ${color(diff, t)}`}>{diff > 0 ? "+" : ""}{diff}</div>
              </div>
            );
          })}
        </div>

        {/* Meals per slot */}
        {SLOTS.map((slot) => {
          const meal = day.meals.find((m) => m.slot === slot.key);
          return (
            <div key={slot.key} className="rounded-lg border border-border p-2">
              <div className="mb-1 flex items-center justify-between">
                <div className="text-xs font-medium">{slot.label}</div>
                {meal && (
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => onChange((d) => ({ ...d, meals: d.meals.map((x) => x.slot === slot.key ? { ...x, is_locked: !x.is_locked } : x) }))}>
                      <Lock className={`h-3 w-3 ${meal.is_locked ? "text-amber-500" : ""}`} />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => onChange((d) => ({ ...d, meals: d.meals.filter((x) => x.slot !== slot.key) }))}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                )}
              </div>
              {meal ? (
                <div className="text-xs">
                  <div className="font-medium">{meal.name}</div>
                  {(() => {
                    const lib = library.find((x) => x.id === meal.library_meal_id);
                    return lib && (
                      <div className="text-muted-foreground">{Math.round(lib.kcal)} kcal · {lib.protein_g}P / {lib.carbs_g}C / {lib.fat_g}F</div>
                    );
                  })()}
                </div>
              ) : (
                <MealPickerDialog
                  slot={slot.key}
                  library={library}
                  ctx={ctx}
                  dayType={day.type}
                  remaining={{ kcal: target.kcal - totals.kcal, p: target.p - totals.p, c: target.c - totals.c, f: target.f - totals.f }}
                  onPick={(lib) => onChange((d) => ({
                    ...d,
                    meals: [
                      ...d.meals.filter((x) => x.slot !== slot.key),
                      {
                        slot: slot.key,
                        name: lib.name,
                        description: lib.description,
                        library_meal_id: lib.id,
                        ingredients: (lib.ingredients ?? []).map((i) => ({ name: i.name, grams: Math.round(i.amount_g ?? 0) })),
                      } as BuilderMeal,
                    ],
                  }))}
                />
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

// ---------- Meal picker ----------
function scoreMeal(
  m: LibraryMeal,
  ctx: CustomerPlanContext,
  dayType: "training" | "rest",
  remaining: { kcal: number; p: number; c: number; f: number },
): { score: number; label: string; reasons: string[] } {
  const reasons: string[] = [];
  let score = 50;

  // Day-type fit
  if (dayType === "training" && !m.suitable_training) score -= 25;
  if (dayType === "rest" && !m.suitable_rest) score -= 25;

  // Macro closeness (kcal proximity per slot ~ typical 20-35% of remaining budget)
  if (remaining.kcal > 0) {
    const kcalRatio = m.kcal / Math.max(200, remaining.kcal);
    // Ideal 0.25-0.45 of remaining
    if (kcalRatio >= 0.2 && kcalRatio <= 0.5) { score += 15; reasons.push("Kalorien passen"); }
    else if (kcalRatio > 0.7) { score -= 15; reasons.push("Sehr kalorienreich"); }
  }
  if (remaining.p > 0 && m.protein_g / Math.max(15, remaining.p) >= 0.25) { score += 10; reasons.push("Gute Proteinmenge"); }

  // Preferences
  const hay = [m.name, m.description ?? "", ...(m.tags ?? []), m.main_protein ?? "", m.main_carb ?? "",
    ...(m.ingredients ?? []).map((i) => i.name)].join(" ").toLowerCase();

  // Hard filters mapped soft (surface via reasons)
  for (const allergen of [...ctx.allergies, ...ctx.intolerances]) {
    if (allergen && (m.no_go_ingredients.includes(allergen) || hay.includes(allergen))) {
      score -= 200; reasons.push(`Allergie/Intoleranz: ${allergen}`);
    }
  }
  for (const no of ctx.noGoFoods) {
    if (no && hay.includes(no)) { score -= 100; reasons.push(`No-Go: ${no}`); }
  }
  for (const fav of ctx.favoriteFoods) {
    if (fav && hay.includes(fav)) { score += 20; reasons.push(`Lieblingsfood: ${fav}`); }
  }

  // Diet style
  if (ctx.dietStyle) {
    const ds = ctx.dietStyle.toLowerCase();
    if (ds.includes("vegan") && !m.tags.includes("vegan")) { score -= 100; reasons.push("Nicht vegan"); }
    if (ds.includes("veget") && !m.tags.includes("vegetarian") && !m.tags.includes("vegan")) {
      // check meaty tokens
      if (/hähnchen|pute|rind|lachs|fisch|thunfisch/.test(hay)) { score -= 100; reasons.push("Nicht vegetarisch"); }
    }
  }

  // Mealprep
  if (ctx.mealPrepStyle && ctx.mealPrepStyle.toLowerCase().includes("prep") && !m.mealprep_ok) {
    score -= 10; reasons.push("Nicht mealprep-tauglich");
  }
  // Budget
  if (ctx.budgetBand === "low" && m.budget === "high") { score -= 15; reasons.push("Über Budget"); }

  let label = "möglich";
  if (score >= 80) label = "sehr passend";
  else if (score >= 60) label = "passend";
  else if (score >= 30) label = "möglich";
  else label = "eher unpassend";

  return { score, label, reasons };
}

function MealPickerDialog({
  slot, library, ctx, dayType, remaining, onPick,
}: {
  slot: Slot;
  library: LibraryMeal[];
  ctx: CustomerPlanContext;
  dayType: "training" | "rest";
  remaining: { kcal: number; p: number; c: number; f: number };
  onPick: (m: LibraryMeal) => void;
}) {
  const [open, setOpen] = useState(false);
  const scored = useMemo(() => {
    return library
      .filter((m) => m.category === slot)
      .map((m) => ({ meal: m, ...scoreMeal(m, ctx, dayType, remaining) }))
      .sort((a, b) => b.score - a.score);
  }, [library, ctx, slot, dayType, remaining]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="w-full">Mahlzeit auswählen</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Mahlzeit für {SLOTS.find((s) => s.key === slot)?.label}</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          {scored.length === 0 && <p className="text-sm text-muted-foreground">Keine Vorschläge.</p>}
          {scored.map(({ meal, label, score, reasons }) => (
            <button
              key={meal.id}
              type="button"
              className="w-full rounded-lg border border-border p-3 text-left hover:bg-muted"
              onClick={() => { onPick(meal); setOpen(false); }}
            >
              <div className="flex items-center justify-between">
                <div className="font-medium">{meal.name}</div>
                <Badge variant={score >= 80 ? "default" : score >= 60 ? "secondary" : "outline"} className="text-[10px]">{label}</Badge>
              </div>
              <div className="text-xs text-muted-foreground">{Math.round(meal.kcal)} kcal · {meal.protein_g}P / {meal.carbs_g}C / {meal.fat_g}F</div>
              {reasons.length > 0 && (
                <div className="mt-1 text-[10px] text-muted-foreground">{reasons.slice(0, 3).join(" · ")}</div>
              )}
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
