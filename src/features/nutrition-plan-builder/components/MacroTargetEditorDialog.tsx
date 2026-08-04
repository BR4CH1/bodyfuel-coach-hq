import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { AlertTriangle, SlidersHorizontal } from "lucide-react";
import type { MacroValues } from "../lib/plan-builder.logic";

export type TargetScope = "day" | "training" | "rest" | "all";

const SCOPES: { value: TargetScope; label: string }[] = [
  { value: "day", label: "Nur dieser Tag" },
  { value: "training", label: "Alle Trainingstage" },
  { value: "rest", label: "Alle Ruhetage" },
  { value: "all", label: "Alle Tage" },
];

const FIELDS: { key: keyof MacroValues; label: string; unit: string; min: number; max: number }[] =
  [
    { key: "kcal", label: "Kalorien", unit: "kcal", min: 800, max: 6000 },
    { key: "p", label: "Protein", unit: "g", min: 20, max: 400 },
    { key: "c", label: "Kohlenhydrate", unit: "g", min: 0, max: 800 },
    { key: "f", label: "Fett", unit: "g", min: 10, max: 300 },
  ];

export function MacroTargetEditorDialog({
  currentTarget,
  hasCustomTarget,
  onApply,
  onReset,
  busy,
}: {
  currentTarget: MacroValues;
  hasCustomTarget: boolean;
  onApply: (targets: MacroValues, scope: TargetScope, adjustMeals: boolean) => void;
  onReset: (scope: TargetScope) => void;
  busy?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [scope, setScope] = useState<TargetScope>("day");
  const [values, setValues] = useState<Record<keyof MacroValues, string>>({
    kcal: String(Math.round(currentTarget.kcal)),
    p: String(Math.round(currentTarget.p)),
    c: String(Math.round(currentTarget.c)),
    f: String(Math.round(currentTarget.f)),
  });

  useEffect(() => {
    if (!open) return;
    setValues({
      kcal: String(Math.round(currentTarget.kcal)),
      p: String(Math.round(currentTarget.p)),
      c: String(Math.round(currentTarget.c)),
      f: String(Math.round(currentTarget.f)),
    });
  }, [open, currentTarget.kcal, currentTarget.p, currentTarget.c, currentTarget.f]);

  const parsed: MacroValues = {
    kcal: Number(values.kcal) || 0,
    p: Number(values.p) || 0,
    c: Number(values.c) || 0,
    f: Number(values.f) || 0,
  };
  const veryLowCarb = parsed.c < 50;

  const apply = (adjustMeals: boolean) => {
    onApply(parsed, scope, adjustMeals);
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="ghost" className="h-7 gap-1 px-2 text-xs">
          <SlidersHorizontal className="h-3.5 w-3.5" />
          Makroziele bearbeiten
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Makroziele bearbeiten</DialogTitle>
          <DialogDescription>
            Individuelle Tagesziele gelten nur in diesem Plan. Das Profilziel bleibt unverändert.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3">
          {FIELDS.map((field) => (
            <div key={field.key} className="space-y-1">
              <Label className="text-xs">
                {field.label} ({field.unit})
              </Label>
              <Input
                type="number"
                inputMode="numeric"
                step={1}
                min={field.min}
                max={field.max}
                value={values[field.key]}
                onChange={(event) =>
                  setValues((previous) => ({ ...previous, [field.key]: event.target.value }))
                }
              />
            </div>
          ))}
        </div>

        {veryLowCarb && (
          <div className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-2 text-xs">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
            <span>Sehr niedriges Kohlenhydratziel – Gerichte werden entsprechend angepasst.</span>
          </div>
        )}

        <div className="space-y-2">
          <Label className="text-xs">Geltungsbereich</Label>
          <RadioGroup
            value={scope}
            onValueChange={(value) => setScope(value as TargetScope)}
            className="grid grid-cols-2 gap-1.5"
          >
            {SCOPES.map((entry) => (
              <label
                key={entry.value}
                className="flex items-center gap-2 rounded-md border border-border px-2 py-1.5 text-xs"
              >
                <RadioGroupItem value={entry.value} />
                {entry.label}
              </label>
            ))}
          </RadioGroup>
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-col">
          <Button disabled={busy} onClick={() => apply(true)} className="w-full">
            Ziele übernehmen &amp; Gerichte anpassen
          </Button>
          <Button
            variant="outline"
            disabled={busy}
            onClick={() => apply(false)}
            className="w-full"
          >
            Nur Ziele übernehmen
          </Button>
          {hasCustomTarget && (
            <Button
              variant="ghost"
              disabled={busy}
              className="w-full text-xs text-muted-foreground"
              onClick={() => {
                onReset(scope);
                setOpen(false);
              }}
            >
              Auf Profilziel zurücksetzen
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
