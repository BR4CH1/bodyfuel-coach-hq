import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Plus, X } from "lucide-react";
import {
  logTrainingSession,
  type SessionType,
} from "@/lib/training-sessions.functions";

const TYPE_OPTS: { v: SessionType; l: string; hint: string }[] = [
  { v: "strength", l: "Übung – Kraft", hint: "Sätze, Wiederholungen, Gewicht" },
  { v: "cardio", l: "Übung – Cardio", hint: "Dauer + Intensität" },
  { v: "class", l: "Kurs", hint: "Name, Dauer, Intensität" },
  { v: "mobility", l: "Mobility / Stretching", hint: "Fokus + Dauer" },
  { v: "sport", l: "Sport / Training", hint: "z. B. Mannschaftstraining, Lauf" },
  { v: "other", l: "Andere Trainingseinheit", hint: "Frei wählbar" },
];

export function AddTrainingSessionButton({ onLogged }: { onLogged?: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1 rounded-md border border-gold/40 bg-gold/10 px-3 py-1.5 text-xs font-semibold text-gold hover:bg-gold/20"
      >
        <Plus className="h-3.5 w-3.5" /> Einheit hinzufügen
      </button>
      {open && (
        <AddTrainingSessionDialog
          onClose={() => setOpen(false)}
          onLogged={() => {
            setOpen(false);
            onLogged?.();
          }}
        />
      )}
    </>
  );
}

function AddTrainingSessionDialog({
  onClose,
  onLogged,
}: {
  onClose: () => void;
  onLogged: () => void;
}) {
  const [type, setType] = useState<SessionType>("strength");
  const [name, setName] = useState("");
  const [duration, setDuration] = useState("");
  const [intensity, setIntensity] = useState("");
  const [sets, setSets] = useState("");
  const [reps, setReps] = useState("");
  const [weight, setWeight] = useState("");
  const [notes, setNotes] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));

  const logFn = useServerFn(logTrainingSession);
  const qc = useQueryClient();

  const mut = useMutation({
    mutationFn: () =>
      logFn({
        data: {
          session_type: type,
          name: name.trim(),
          session_date: date,
          duration_minutes: duration ? Number(duration) : null,
          intensity: intensity ? Number(intensity) : null,
          sets: sets ? Number(sets) : null,
          reps: reps || null,
          weight_kg: weight ? Number(weight.replace(",", ".")) : null,
          notes: notes || null,
        },
      }),
    onSuccess: () => {
      toast.success("Einheit gespeichert");
      qc.invalidateQueries({ queryKey: ["training-sessions"] });
      onLogged();
    },
    onError: (e: any) => toast.error(e?.message ?? "Fehler"),
  });

  const isStrength = type === "strength";
  const needsDurationIntensity = !isStrength;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-3 sm:items-center"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-border bg-card p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-display text-lg font-bold">Trainingseinheit hinzufügen</h3>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-muted-foreground hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground">Typ</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as SessionType)}
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            >
              {TYPE_OPTS.map((t) => (
                <option key={t.v} value={t.v}>
                  {t.l}
                </option>
              ))}
            </select>
            <div className="mt-1 text-[10px] text-muted-foreground">
              {TYPE_OPTS.find((t) => t.v === type)?.hint}
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground">Name *</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={
                type === "class"
                  ? "z. B. Yoga Flow, Spinning"
                  : type === "mobility"
                    ? "z. B. Hüft-Mobility 15 min"
                    : type === "sport"
                      ? "z. B. Football Training"
                      : type === "cardio"
                        ? "z. B. Laufen draußen"
                        : "z. B. Bankdrücken Maschine"
              }
              maxLength={120}
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Datum</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              />
            </div>
            {needsDurationIntensity && (
              <div>
                <label className="text-xs font-medium text-muted-foreground">Dauer (Min)</label>
                <input
                  type="number"
                  min={1}
                  max={600}
                  value={duration}
                  onChange={(e) => setDuration(e.target.value.replace(/[^0-9]/g, ""))}
                  className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                />
              </div>
            )}
          </div>

          {needsDurationIntensity && (
            <div>
              <label className="text-xs font-medium text-muted-foreground">
                Intensität: {intensity || "—"} / 10
              </label>
              <input
                type="range"
                min={1}
                max={10}
                value={intensity || 5}
                onChange={(e) => setIntensity(e.target.value)}
                className="mt-1 w-full"
              />
              <div className="flex justify-between text-[10px] text-muted-foreground">
                <span>locker</span>
                <span>moderat</span>
                <span>maximal</span>
              </div>
            </div>
          )}

          {isStrength && (
            <>
              <div className="text-[11px] text-muted-foreground">
                Auch Cardio-Übungen? Wechsle oben den Typ auf "Übung – Cardio".
              </div>
              <div className="grid grid-cols-3 gap-2">
                <Num label="Sätze" value={sets} onChange={setSets} />
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Wdh.</label>
                  <input
                    value={reps}
                    onChange={(e) => setReps(e.target.value.replace(/[^0-9,| ]/g, ""))}
                    placeholder="8 oder 8,8,10"
                    className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Gewicht (kg)</label>
                  <input
                    inputMode="decimal"
                    value={weight}
                    onChange={(e) => setWeight(e.target.value.replace(/[^0-9.,]/g, ""))}
                    className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                  />
                </div>
              </div>
            </>
          )}

          <div>
            <label className="text-xs font-medium text-muted-foreground">Notiz (optional)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              maxLength={500}
              rows={2}
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            />
          </div>

          <button
            onClick={() => {
              if (!name.trim()) return toast.error("Bitte Namen angeben");
              mut.mutate();
            }}
            disabled={mut.isPending}
            className="w-full rounded-lg bg-gradient-gold py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
          >
            Speichern
          </button>
        </div>
      </div>
    </div>
  );
}

function Num({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      <input
        inputMode="numeric"
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/[^0-9]/g, ""))}
        className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
      />
    </div>
  );
}
