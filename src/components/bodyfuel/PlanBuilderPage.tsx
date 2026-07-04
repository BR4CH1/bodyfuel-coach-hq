import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
import {
  ArrowLeft,
  Lock,
  Trash2,
  Copy,
  Minus,
  Plus,
  Shuffle,
  Sparkles,
  Link2,
  Link2Off,
  Undo2,
  Wand2,
} from "lucide-react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

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
function makeGroupId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `grp_${Math.random().toString(36).slice(2)}`;
}

function mealFromLibrary(lib: LibraryMeal, slot: Slot, factor = 1, group: string | null = null): BuilderMeal {
  return {
    slot,
    name: lib.name,
    description: lib.description,
    library_meal_id: lib.id,
    portion_factor: factor,
    linked_prep_group: group,
    ingredients: (lib.ingredients ?? []).map((i) => ({
      name: i.name,
      grams: Math.round(i.amount_g ?? 0),
    })),
  };
}

function mealMacros(m: BuilderMeal, library: LibraryMeal[]) {
  const lib = library.find((x) => x.id === m.library_meal_id);
  const f = m.portion_factor && m.portion_factor > 0 ? m.portion_factor : 1;
  if (!lib) return { kcal: 0, p: 0, c: 0, f: 0 };
  return {
    kcal: Number(lib.kcal) * f,
    p: Number(lib.protein_g) * f,
    c: Number(lib.carbs_g) * f,
    f: Number(lib.fat_g) * f,
  };
}

export type AutoFillMode = "empty_only" | "all_unlocked";

export function targetsFor(day: BuilderDay, ctx: CustomerPlanContext) {
  return day.type === "training"
    ? { kcal: ctx.targets.kcal_train, p: ctx.targets.protein_train, c: ctx.targets.carbs_train, f: ctx.targets.fat_train }
    : { kcal: ctx.targets.kcal_rest, p: ctx.targets.protein_rest, c: ctx.targets.carbs_rest, f: ctx.targets.fat_rest };
}

// Returns { day, missing: Slot[] } — never touches locked meals.
export function autoFillDayImpl(
  day: BuilderDay,
  ctx: CustomerPlanContext,
  library: LibraryMeal[],
  mode: AutoFillMode,
): { day: BuilderDay; missing: Slot[] } {
  let meals: BuilderMeal[] = day.meals.map((m) => ({ ...m }));
  // In "all_unlocked" mode: remove unlocked meals before filling
  if (mode === "all_unlocked") {
    meals = meals.filter((m) => m.is_locked);
  }
  const target = targetsFor(day, ctx);
  const slotOrder: Slot[] = ["breakfast", "lunch", "dinner", "snack"];
  const missing: Slot[] = [];

  const remaining = () => {
    const cur = meals.reduce(
      (acc, m) => {
        const mm = mealMacros(m, library);
        return { kcal: acc.kcal + mm.kcal, p: acc.p + mm.p, c: acc.c + mm.c, f: acc.f + mm.f };
      },
      { kcal: 0, p: 0, c: 0, f: 0 },
    );
    return { kcal: target.kcal - cur.kcal, p: target.p - cur.p, c: target.c - cur.c, f: target.f - cur.f };
  };

  for (const slot of slotOrder) {
    const existing = meals.find((m) => m.slot === slot);
    if (existing) continue; // locked or (empty_only) user meal → keep

    const candidates = library
      .filter((m) => m.category === slot)
      .map((m) => ({ meal: m, ...scoreMeal(m, ctx, day.type, remaining()) }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score);
    const best = candidates[0];
    if (!best) {
      missing.push(slot);
      continue;
    }

    if (day.prepCoupleLunchDinner && (slot === "lunch" || slot === "dinner")) {
      const partner = meals.find((m) => m.slot === (slot === "lunch" ? "dinner" : "lunch"));
      if (partner && partner.library_meal_id) {
        // Partner already set (probably locked) → mirror it into this slot
        const src = library.find((x) => x.id === partner.library_meal_id);
        if (src) {
          const groupId = partner.linked_prep_group ?? makeGroupId();
          meals = meals.map((m) => (m.slot === partner.slot ? { ...m, linked_prep_group: groupId } : m));
          const clone = mealFromLibrary(src, slot, 1, groupId);
          if (slot === "dinner") clone.description = (src.description ?? "") + " (Portion 2 aus Mealprep)";
          meals.push(clone);
        }
        continue;
      }
      const groupId = makeGroupId();
      const lunch = mealFromLibrary(best.meal, "lunch", 1, groupId);
      const dinner = mealFromLibrary(best.meal, "dinner", 1, groupId);
      dinner.description = (best.meal.description ?? "") + " (Portion 2 aus Mealprep)";
      meals = meals.filter((m) => m.slot !== "lunch" && m.slot !== "dinner" || m.is_locked);
      meals.push(lunch, dinner);
      continue;
    }
    meals.push(mealFromLibrary(best.meal, slot));
  }
  return { day: { ...day, meals }, missing };
}

export function PlanBuilderPage({ userId }: { userId: string }) {
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
  const [endDate, setEndDate] = useState(addDays(isoDate(new Date()), 6));
  const numDays = useMemo(() => {
    const s = new Date(startDate + "T00:00:00Z").getTime();
    const e = new Date(endDate + "T00:00:00Z").getTime();
    if (!isFinite(s) || !isFinite(e) || e < s) return 1;
    return Math.min(28, Math.max(1, Math.round((e - s) / 86400000) + 1));
  }, [startDate, endDate]);
  const [title, setTitle] = useState("Wochenplan");
  const [saving, setSaving] = useState(false);
  const [weekConfirmOpen, setWeekConfirmOpen] = useState(false);
  const [weekMode, setWeekMode] = useState<AutoFillMode>("empty_only");
  const [undoSnapshot, setUndoSnapshot] = useState<BuilderDay[] | null>(null);

  const trainingWeekdays = ctxQ.data?.trainingWeekdays ?? [];
  const [days, setDays] = useState<BuilderDay[]>(() => []);

  useMemo(() => {
    setDays((prev) => {
      const next: BuilderDay[] = [];
      const weekdayLabels = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];
      for (let i = 0; i < numDays; i++) {
        const iso = addDays(startDate, i);
        const d = new Date(iso + "T00:00:00Z");
        const weekday = d.getUTCDay();
        const isTrain = trainingWeekdays.includes(weekday);
        const existing = prev[i];
        const dateLabel = `${weekdayLabels[weekday]} ${String(d.getUTCDate()).padStart(2, "0")}.${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
        // Auto-derive from trainingWeekdays unless the coach toggled manually
        const autoType: "training" | "rest" = isTrain ? "training" : "rest";
        const type = existing?.typeOverride ? existing.type : autoType;
        next.push({
          name: `Tag ${i + 1} · ${dateLabel}`,
          type,
          typeOverride: existing?.typeOverride ?? false,
          meals: existing?.meals ?? [],
          prepCoupleLunchDinner: existing?.prepCoupleLunchDinner ?? false,
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
          next[i] = {
            ...next[i],
            prepCoupleLunchDinner: src.prepCoupleLunchDinner,
            meals: src.meals.map((m) => ({
              ...m,
              ingredients: m.ingredients.map((x) => ({ ...x })),
              // Neue Gruppen-IDs pro Tag
              linked_prep_group: m.linked_prep_group ? makeGroupId() + "-" + m.slot : null,
            })),
          };
          // gleiche Gruppe für lunch+dinner im Zieltag
          const g = makeGroupId();
          next[i].meals = next[i].meals.map((m) => {
            if (src.prepCoupleLunchDinner && (m.slot === "lunch" || m.slot === "dinner")) {
              return { ...m, linked_prep_group: g };
            }
            return m;
          });
          break;
        }
      }
      return next;
    });
  };

  const runAutoFillWeek = (mode: AutoFillMode) => {
    const ctx = ctxQ.data;
    const lib = libQ.data ?? [];
    if (!ctx) return;
    // Snapshot for undo (deep clone)
    setUndoSnapshot(days.map((d) => ({ ...d, meals: d.meals.map((m) => ({ ...m, ingredients: m.ingredients.map((i) => ({ ...i })) })) })));
    let missingCount = 0;
    setDays((prev) =>
      prev.map((d) => {
        const res = autoFillDayImpl(d, ctx, lib, mode);
        missingCount += res.missing.length;
        return res.day;
      }),
    );
    if (missingCount > 0) {
      toast.warning(
        `${missingCount} Slots ohne passenden Vorschlag. Für diese Slots wurde keine passende Mahlzeit gefunden. Bitte Mahlzeitendatenbank erweitern oder Filter prüfen.`,
      );
    } else {
      toast.success("Woche automatisch gefüllt");
    }
  };

  const undoWeekFill = () => {
    if (!undoSnapshot) return;
    setDays(undoSnapshot);
    setUndoSnapshot(null);
    toast.success("Rückgängig gemacht");
  };

  if (libQ.isLoading || ctxQ.isLoading) {
    return <div className="p-6 text-sm text-muted-foreground">Lade …</div>;
  }
  if (libQ.error) return <div className="p-6 text-sm text-destructive">Bibliothek konnte nicht geladen werden.</div>;

  return (
    <div className="mx-auto max-w-4xl space-y-4 p-4 pb-32">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="ghost" size="sm" onClick={() => navigate({ to: "/coach/customers/$userId", params: { userId } })}>
          <ArrowLeft className="mr-1 h-4 w-4" /> Zurück
        </Button>
        <h1 className="font-display text-lg font-bold">Plan manuell erstellen</h1>
        <div className="ml-auto flex flex-wrap gap-1">
          <Button size="sm" variant="secondary" onClick={() => { setWeekMode("empty_only"); setWeekConfirmOpen(true); }}>
            <Wand2 className="mr-1 h-3 w-3" />
            Woche automatisch füllen
          </Button>
          {undoSnapshot && (
            <Button size="sm" variant="outline" onClick={undoWeekFill}>
              <Undo2 className="mr-1 h-3 w-3" />
              Rückgängig
            </Button>
          )}
        </div>
      </div>

      <AlertDialog open={weekConfirmOpen} onOpenChange={setWeekConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Woche automatisch füllen?</AlertDialogTitle>
            <AlertDialogDescription>
              Fixierte Mahlzeiten bleiben immer erhalten. Vor der Aktion wird ein Snapshot gespeichert
              — du kannst über „Rückgängig“ zurückkehren.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <RadioGroup value={weekMode} onValueChange={(v) => setWeekMode(v as AutoFillMode)} className="space-y-2 py-2">
            <label className="flex items-start gap-2 text-sm">
              <RadioGroupItem value="empty_only" className="mt-0.5" />
              <div>
                <div className="font-medium">Nur leere Slots füllen</div>
                <div className="text-xs text-muted-foreground">Bestehende Mahlzeiten bleiben unverändert.</div>
              </div>
            </label>
            <label className="flex items-start gap-2 text-sm">
              <RadioGroupItem value="all_unlocked" className="mt-0.5" />
              <div>
                <div className="font-medium">Alle nicht fixierten Slots neu füllen</div>
                <div className="text-xs text-muted-foreground">Ersetzt nicht-fixierte Mahlzeiten durch neue Vorschläge.</div>
              </div>
            </label>
          </RadioGroup>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={() => runAutoFillWeek(weekMode)}>Ausführen</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
          <div>
            <Label>Enddatum</Label>
            <Input
              type="date"
              value={endDate}
              min={startDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
      </Card>

      {ctxQ.data && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Kundenprofil</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-xs">
            <div className="flex flex-wrap gap-1">
              <Badge variant="outline">
                Trainingstag: {ctxQ.data.targets.kcal_train} kcal · {ctxQ.data.targets.protein_train}P/
                {ctxQ.data.targets.carbs_train}C/{ctxQ.data.targets.fat_train}F
              </Badge>
              <Badge variant="outline">
                Restday: {ctxQ.data.targets.kcal_rest} kcal · {ctxQ.data.targets.protein_rest}P/
                {ctxQ.data.targets.carbs_rest}C/{ctxQ.data.targets.fat_rest}F
              </Badge>
            </div>
            <div>
              Trainingstage laut Profil:{" "}
              <b>
                {ctxQ.data.trainingWeekdays.length === 0
                  ? "keine hinterlegt"
                  : ctxQ.data.trainingWeekdays
                      .slice()
                      .sort()
                      .map((w) => ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"][w])
                      .join(", ")}
              </b>
            </div>
            {ctxQ.data.dietStyle && (
              <div>
                Ernährungsform: <b>{ctxQ.data.dietStyle}</b>
              </div>
            )}
            {ctxQ.data.allergies.length > 0 && <div>Allergien: {ctxQ.data.allergies.join(", ")}</div>}
            {ctxQ.data.noGoFoods.length > 0 && <div>No-Gos: {ctxQ.data.noGoFoods.join(", ")}</div>}
            {ctxQ.data.favoriteFoods.length > 0 && (
              <div className="text-emerald-500">Lieblingsfoods: {ctxQ.data.favoriteFoods.join(", ")}</div>
            )}
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

// ---------- Day card ----------
function DayCard({
  day,
  library,
  ctx,
  onChange,
  onCopy,
}: {
  day: BuilderDay;
  library: LibraryMeal[];
  ctx: CustomerPlanContext;
  onChange: (u: (d: BuilderDay) => BuilderDay) => void;
  onCopy: () => void;
}) {
  const target =
    day.type === "training"
      ? { kcal: ctx.targets.kcal_train, p: ctx.targets.protein_train, c: ctx.targets.carbs_train, f: ctx.targets.fat_train }
      : { kcal: ctx.targets.kcal_rest, p: ctx.targets.protein_rest, c: ctx.targets.carbs_rest, f: ctx.targets.fat_rest };

  const totals = day.meals.reduce(
    (acc, m) => {
      const mm = mealMacros(m, library);
      acc.kcal += mm.kcal;
      acc.p += mm.p;
      acc.c += mm.c;
      acc.f += mm.f;
      return acc;
    },
    { kcal: 0, p: 0, c: 0, f: 0 },
  );

  const color = (diff: number, tgt: number) => {
    const pct = tgt ? Math.abs(diff) / tgt : 0;
    if (pct <= 0.05) return "text-emerald-500";
    if (pct <= 0.1) return "text-amber-500";
    return "text-destructive";
  };

  // ---- Meal helpers ----
  const setMealAtSlot = (slot: Slot, next: BuilderMeal | null) => {
    onChange((d) => {
      let meals = d.meals.filter((x) => x.slot !== slot);
      if (next) meals.push(next);
      return { ...d, meals };
    });
  };

  const updateMealAtSlot = (slot: Slot, upd: (m: BuilderMeal) => BuilderMeal) => {
    onChange((d) => {
      const target = d.meals.find((x) => x.slot === slot);
      if (!target) return d;
      const updated = upd(target);
      // Kopplung: wenn lunch/dinner in gleicher Gruppe → auch Partner spiegeln (Meal + Faktor)
      if (target.linked_prep_group) {
        const partnerSlot: Slot | null =
          target.slot === "lunch" ? "dinner" : target.slot === "dinner" ? "lunch" : null;
        if (partnerSlot) {
          return {
            ...d,
            meals: d.meals.map((m) => {
              if (m.slot === slot) return updated;
              if (m.slot === partnerSlot && m.linked_prep_group === target.linked_prep_group) {
                return {
                  ...m,
                  name: updated.name,
                  description: updated.description,
                  library_meal_id: updated.library_meal_id,
                  ingredients: updated.ingredients.map((i) => ({ ...i })),
                  // Portionsfaktor pro Slot getrennt (Portion 1 vs Portion 2)
                };
              }
              return m;
            }),
          };
        }
      }
      return { ...d, meals: d.meals.map((m) => (m.slot === slot ? updated : m)) };
    });
  };

  const removeMealAtSlot = (slot: Slot) => {
    onChange((d) => {
      const target = d.meals.find((x) => x.slot === slot);
      if (!target) return d;
      // Kopplung auflösen bei Entfernen
      const group = target.linked_prep_group;
      let meals = d.meals.filter((x) => x.slot !== slot);
      if (group) {
        meals = meals.map((m) =>
          m.linked_prep_group === group ? { ...m, linked_prep_group: null } : m,
        );
      }
      return { ...d, meals };
    });
  };

  const pickMeal = (slot: Slot, lib: LibraryMeal) => {
    onChange((d) => {
      // Kopplung aktiv & Slot ist lunch oder dinner → beide setzen
      if (d.prepCoupleLunchDinner && (slot === "lunch" || slot === "dinner")) {
        const groupId = makeGroupId();
        const lunch = mealFromLibrary(lib, "lunch", 1, groupId);
        const dinner = mealFromLibrary(lib, "dinner", 1, groupId);
        // Portion 2 markieren (nur visuell im Namen-Suffix)
        dinner.description = (lib.description ?? "") + " (Portion 2 aus Mealprep)";
        const meals = d.meals.filter((x) => x.slot !== "lunch" && x.slot !== "dinner");
        meals.push(lunch, dinner);
        return { ...d, meals };
      }
      const meals = d.meals.filter((x) => x.slot !== slot);
      meals.push(mealFromLibrary(lib, slot));
      return { ...d, meals };
    });
  };

  const toggleCouple = (on: boolean) => {
    onChange((d) => {
      if (on) {
        // Wenn lunch existiert, dinner spiegeln; sonst gemeinsame Gruppe vergeben
        const lunch = d.meals.find((m) => m.slot === "lunch");
        const dinner = d.meals.find((m) => m.slot === "dinner");
        const groupId = makeGroupId();
        let meals = [...d.meals];
        if (lunch && !dinner) {
          const src = library.find((x) => x.id === lunch.library_meal_id);
          if (src) {
            const clone = mealFromLibrary(src, "dinner", 1, groupId);
            clone.description = (src.description ?? "") + " (Portion 2 aus Mealprep)";
            meals = meals.map((m) => (m.slot === "lunch" ? { ...m, linked_prep_group: groupId } : m));
            meals.push(clone);
          }
        } else if (dinner && !lunch) {
          const src = library.find((x) => x.id === dinner.library_meal_id);
          if (src) {
            const clone = mealFromLibrary(src, "lunch", 1, groupId);
            meals = meals.map((m) =>
              m.slot === "dinner" ? { ...m, linked_prep_group: groupId } : m,
            );
            meals.push(clone);
          }
        } else if (lunch && dinner) {
          // Beide vorhanden → dinner an lunch angleichen, in gleiche Gruppe
          const src = library.find((x) => x.id === lunch.library_meal_id);
          meals = meals.map((m) => {
            if (m.slot === "lunch") return { ...m, linked_prep_group: groupId };
            if (m.slot === "dinner" && src)
              return {
                ...m,
                name: src.name,
                description: (src.description ?? "") + " (Portion 2 aus Mealprep)",
                library_meal_id: src.id,
                ingredients: (src.ingredients ?? []).map((i) => ({
                  name: i.name,
                  grams: Math.round(i.amount_g ?? 0),
                })),
                linked_prep_group: groupId,
              };
            return m;
          });
        }
        return { ...d, prepCoupleLunchDinner: true, meals };
      } else {
        // Kopplung lösen: Gruppen entfernen, Mahlzeiten bleiben
        return {
          ...d,
          prepCoupleLunchDinner: false,
          meals: d.meals.map((m) =>
            m.slot === "lunch" || m.slot === "dinner" ? { ...m, linked_prep_group: null } : m,
          ),
        };
      }
    });
  };

  const autoFillDay = () => {
    onChange((d) => {
      const res = autoFillDayImpl(d, ctx, library, "empty_only");
      if (res.missing.length > 0) {
        toast.warning(
          `Für ${res.missing.length} Slot(s) wurde keine passende Mahlzeit gefunden. Bitte Mahlzeitendatenbank erweitern oder Filter prüfen.`,
        );
      }
      return res.day;
    });
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div className="flex items-center gap-2">
          <CardTitle className="text-sm">{day.name}</CardTitle>
          <Badge
            variant={day.type === "training" ? "default" : "secondary"}
            className="cursor-pointer"
            onClick={() =>
              onChange((d) => ({
                ...d,
                type: d.type === "training" ? "rest" : "training",
                typeOverride: true,
              }))
            }
          >
            {day.type === "training" ? "Trainingstag" : "Restday"}
          </Badge>
        </div>
        <div className="flex flex-wrap gap-1">
          <Button size="sm" variant="secondary" onClick={autoFillDay}>
            <Sparkles className="mr-1 h-3 w-3" />
            Tag automatisch füllen
          </Button>
          <Button size="sm" variant="ghost" onClick={onCopy}>
            <Copy className="mr-1 h-3 w-3" />
            auf nächsten Tag
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {/* Balance */}
        <div className="grid grid-cols-4 gap-2 rounded-lg bg-muted p-2 text-[11px]">
          {(
            [
              ["kcal", totals.kcal, target.kcal, "kcal"],
              ["P", totals.p, target.p, "g"],
              ["C", totals.c, target.c, "g"],
              ["F", totals.f, target.f, "g"],
            ] as const
          ).map(([k, v, t, u]) => {
            const diff = Math.round(v - t);
            return (
              <div key={k} className="text-center">
                <div className="text-muted-foreground">{k}</div>
                <div className="font-mono">
                  {Math.round(v)}/{t}
                  {u}
                </div>
                <div className={`font-mono ${color(diff, t)}`}>
                  {diff > 0 ? "+" : ""}
                  {diff}
                </div>
              </div>
            );
          })}
        </div>

        {/* Mealprep coupling */}
        <div className="flex items-center justify-between rounded-lg border border-dashed border-border p-2 text-xs">
          <div className="flex items-center gap-2">
            {day.prepCoupleLunchDinner ? (
              <Link2 className="h-3 w-3 text-emerald-500" />
            ) : (
              <Link2Off className="h-3 w-3 text-muted-foreground" />
            )}
            <span>Mittagessen &amp; Abendessen koppeln (Mealprep)</span>
          </div>
          <Switch
            checked={!!day.prepCoupleLunchDinner}
            onCheckedChange={(v) => toggleCouple(v)}
          />
        </div>

        {/* Meals per slot */}
        {SLOTS.map((slot) => {
          const meal = day.meals.find((m) => m.slot === slot.key);
          const remaining = {
            kcal: target.kcal - totals.kcal,
            p: target.p - totals.p,
            c: target.c - totals.c,
            f: target.f - totals.f,
          };
          return (
            <MealSlotRow
              key={slot.key}
              slot={slot.key}
              label={slot.label}
              meal={meal}
              library={library}
              ctx={ctx}
              dayType={day.type}
              remaining={remaining}
              onPick={(lib) => pickMeal(slot.key, lib)}
              onSwap={(lib) => {
                if (!meal) return;
                updateMealAtSlot(slot.key, (m) => ({
                  ...m,
                  name: lib.name,
                  description: lib.description,
                  library_meal_id: lib.id,
                  ingredients: (lib.ingredients ?? []).map((i) => ({
                    name: i.name,
                    grams: Math.round(i.amount_g ?? 0),
                  })),
                }));
              }}
              onFactor={(f) => updateMealAtSlot(slot.key, (m) => ({ ...m, portion_factor: f }))}
              onLockToggle={() =>
                updateMealAtSlot(slot.key, (m) => ({ ...m, is_locked: !m.is_locked }))
              }
              onRemove={() => removeMealAtSlot(slot.key)}
            />
          );
        })}
      </CardContent>
    </Card>
  );
}

// ---------- Meal slot row ----------
function MealSlotRow({
  slot,
  label,
  meal,
  library,
  ctx,
  dayType,
  remaining,
  onPick,
  onSwap,
  onFactor,
  onLockToggle,
  onRemove,
}: {
  slot: Slot;
  label: string;
  meal: BuilderMeal | undefined;
  library: LibraryMeal[];
  ctx: CustomerPlanContext;
  dayType: "training" | "rest";
  remaining: { kcal: number; p: number; c: number; f: number };
  onPick: (lib: LibraryMeal) => void;
  onSwap: (lib: LibraryMeal) => void;
  onFactor: (f: number) => void;
  onLockToggle: () => void;
  onRemove: () => void;
}) {
  const mm = meal ? mealMacros(meal, library) : { kcal: 0, p: 0, c: 0, f: 0 };
  const factor = meal?.portion_factor ?? 1;

  const setFactor = (next: number) => {
    const clamped = Math.max(0.25, Math.min(4, Math.round(next * 4) / 4));
    onFactor(clamped);
  };

  return (
    <div className="rounded-lg border border-border p-2">
      <div className="mb-1 flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs font-medium">
          {label}
          {meal?.linked_prep_group && (
            <Badge variant="outline" className="gap-1 px-1 py-0 text-[9px]">
              <Link2 className="h-2.5 w-2.5" />
              Prep
            </Badge>
          )}
        </div>
        {meal && (
          <div className="flex gap-1">
            <Button size="icon" variant="ghost" className="h-6 w-6" onClick={onLockToggle}>
              <Lock className={`h-3 w-3 ${meal.is_locked ? "text-amber-500" : ""}`} />
            </Button>
            <Button size="icon" variant="ghost" className="h-6 w-6" onClick={onRemove}>
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        )}
      </div>

      {meal ? (
        <div className="space-y-2 text-xs">
          <div>
            <div className="font-medium">{meal.name}</div>
            <div className="text-muted-foreground">
              {Math.round(mm.kcal)} kcal · {Math.round(mm.p)}P / {Math.round(mm.c)}C / {Math.round(mm.f)}F
            </div>
          </div>

          {/* Portionierung */}
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">Menge</span>
            <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => setFactor(factor - 0.25)}>
              <Minus className="h-3 w-3" />
            </Button>
            <Input
              type="number"
              step="0.25"
              min={0.25}
              max={4}
              value={factor}
              onChange={(e) => setFactor(Number(e.target.value) || 1)}
              className="h-7 w-16 text-center text-xs"
            />
            <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => setFactor(factor + 0.25)}>
              <Plus className="h-3 w-3" />
            </Button>
            <span className="text-muted-foreground">× Portion</span>
          </div>

          {/* Aktionen */}
          <div className="flex flex-wrap gap-1">
            <MealPickerDialog
              trigger={
                <Button size="sm" variant="outline" className="h-7 text-xs">
                  <Shuffle className="mr-1 h-3 w-3" />
                  Tauschen
                </Button>
              }
              title={`${label} tauschen`}
              slot={slot}
              library={library}
              ctx={ctx}
              dayType={dayType}
              remaining={remaining}
              onPick={onSwap}
            />
            <MealPickerDialog
              trigger={
                <Button size="sm" variant="ghost" className="h-7 text-xs">
                  Alternative anzeigen
                </Button>
              }
              title={`Alternativen für ${label}`}
              slot={slot}
              library={library}
              ctx={ctx}
              dayType={dayType}
              remaining={remaining}
              onPick={onSwap}
              excludeId={meal.library_meal_id ?? null}
            />
          </div>
        </div>
      ) : (
        <MealPickerDialog
          trigger={
            <Button size="sm" variant="outline" className="w-full">
              Mahlzeit auswählen
            </Button>
          }
          title={`Mahlzeit für ${label}`}
          slot={slot}
          library={library}
          ctx={ctx}
          dayType={dayType}
          remaining={remaining}
          onPick={onPick}
        />
      )}
    </div>
  );
}

// ---------- Score + picker ----------
function scoreMeal(
  m: LibraryMeal,
  ctx: CustomerPlanContext,
  dayType: "training" | "rest",
  remaining: { kcal: number; p: number; c: number; f: number },
): { score: number; label: string; reasons: string[] } {
  const reasons: string[] = [];
  let score = 50;

  if (dayType === "training" && !m.suitable_training) score -= 25;
  if (dayType === "rest" && !m.suitable_rest) score -= 25;

  if (remaining.kcal > 0) {
    const kcalRatio = m.kcal / Math.max(200, remaining.kcal);
    if (kcalRatio >= 0.2 && kcalRatio <= 0.5) {
      score += 15;
      reasons.push("Kalorien passen");
    } else if (kcalRatio > 0.7) {
      score -= 15;
      reasons.push("Sehr kalorienreich");
    }
  }
  if (remaining.p > 0 && m.protein_g / Math.max(15, remaining.p) >= 0.25) {
    score += 10;
    reasons.push("Gute Proteinmenge");
  }

  const hay = [
    m.name,
    m.description ?? "",
    ...(m.tags ?? []),
    m.main_protein ?? "",
    m.main_carb ?? "",
    ...(m.ingredients ?? []).map((i) => i.name),
  ]
    .join(" ")
    .toLowerCase();

  for (const allergen of [...ctx.allergies, ...ctx.intolerances]) {
    if (allergen && (m.no_go_ingredients.includes(allergen) || hay.includes(allergen))) {
      score -= 200;
      reasons.push(`Allergie/Intoleranz: ${allergen}`);
    }
  }
  for (const no of ctx.noGoFoods) {
    if (no && hay.includes(no)) {
      score -= 100;
      reasons.push(`No-Go: ${no}`);
    }
  }
  for (const fav of ctx.favoriteFoods) {
    if (fav && hay.includes(fav)) {
      score += 20;
      reasons.push(`Lieblingsfood: ${fav}`);
    }
  }

  if (ctx.dietStyle) {
    const ds = ctx.dietStyle.toLowerCase();
    if (ds.includes("vegan") && !m.tags.includes("vegan")) {
      score -= 100;
      reasons.push("Nicht vegan");
    }
    if (ds.includes("veget") && !m.tags.includes("vegetarian") && !m.tags.includes("vegan")) {
      if (/hähnchen|pute|rind|lachs|fisch|thunfisch/.test(hay)) {
        score -= 100;
        reasons.push("Nicht vegetarisch");
      }
    }
  }

  if (ctx.mealPrepStyle && ctx.mealPrepStyle.toLowerCase().includes("prep") && !m.mealprep_ok) {
    score -= 10;
    reasons.push("Nicht mealprep-tauglich");
  }
  if (ctx.budgetBand === "low" && m.budget === "high") {
    score -= 15;
    reasons.push("Über Budget");
  }

  let label = "möglich";
  if (score >= 80) label = "sehr passend";
  else if (score >= 60) label = "passend";
  else if (score >= 30) label = "möglich";
  else label = "eher unpassend";

  return { score, label, reasons };
}

function MealPickerDialog({
  trigger,
  title,
  slot,
  library,
  ctx,
  dayType,
  remaining,
  onPick,
  excludeId,
}: {
  trigger: React.ReactNode;
  title: string;
  slot: Slot;
  library: LibraryMeal[];
  ctx: CustomerPlanContext;
  dayType: "training" | "rest";
  remaining: { kcal: number; p: number; c: number; f: number };
  onPick: (m: LibraryMeal) => void;
  excludeId?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const scored = useMemo(() => {
    return library
      .filter((m) => m.category === slot && (!excludeId || m.id !== excludeId))
      .map((m) => ({ meal: m, ...scoreMeal(m, ctx, dayType, remaining) }))
      .sort((a, b) => b.score - a.score);
  }, [library, ctx, slot, dayType, remaining, excludeId]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          {scored.length === 0 && <p className="text-sm text-muted-foreground">Keine Vorschläge.</p>}
          {scored.map(({ meal, label, score, reasons }) => (
            <button
              key={meal.id}
              type="button"
              className="w-full rounded-lg border border-border p-3 text-left hover:bg-muted"
              onClick={() => {
                onPick(meal);
                setOpen(false);
              }}
            >
              <div className="flex items-center justify-between">
                <div className="font-medium">{meal.name}</div>
                <Badge
                  variant={score >= 80 ? "default" : score >= 60 ? "secondary" : "outline"}
                  className="text-[10px]"
                >
                  {label}
                </Badge>
              </div>
              <div className="text-xs text-muted-foreground">
                {Math.round(meal.kcal)} kcal · {meal.protein_g}P / {meal.carbs_g}C / {meal.fat_g}F
              </div>
              {reasons.length > 0 && (
                <div className="mt-1 text-[10px] text-muted-foreground">
                  {reasons.slice(0, 3).join(" · ")}
                </div>
              )}
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
