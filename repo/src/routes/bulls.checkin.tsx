import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Heart } from "lucide-react";
import { toast } from "sonner";
import { AppLayout } from "@/components/bodyfuel/AppLayout";
import { BullsGate } from "@/components/bodyfuel/BullsGate";
import {
  submitCheckin,
  listMyCheckins,
  type AthleteCheckin,
} from "@/lib/athlete-checkins.functions";

export const Route = createFileRoute("/bulls/checkin")({
  head: () => ({
    meta: [
      { title: "Check-in — Bulls Hub" },
      { name: "description", content: "Täglicher Check-in: Schlaf, Energie, Stress, Trainingsgefühl, Beschwerden." },
    ],
  }),
  component: () => (
    <AppLayout>
      <BullsGate>
        <CheckinPage />
      </BullsGate>
    </AppLayout>
  ),
});

const TODAY = () => new Date().toISOString().slice(0, 10);

function CheckinPage() {
  const qc = useQueryClient();
  const submit = useServerFn(submitCheckin);
  const listFn = useServerFn(listMyCheckins);

  const { data: history = [] } = useQuery({
    queryKey: ["my-checkins"],
    queryFn: () => listFn() as Promise<AthleteCheckin[]>,
  });

  const today = history.find((c) => c.checkin_date === TODAY());

  const [sleep, setSleep] = useState<number | null>(today?.sleep ?? null);
  const [energy, setEnergy] = useState<number | null>(today?.energy ?? null);
  const [stress, setStress] = useState<number | null>(today?.stress ?? null);
  const [trainingFeel, setTrainingFeel] = useState<number | null>(today?.training_feel ?? null);
  const [painLevel, setPainLevel] = useState<number | null>(today?.pain_level ?? null);
  const [painNote, setPainNote] = useState<string>(today?.pain_note ?? "");
  const [notes, setNotes] = useState<string>(today?.notes ?? "");

  useMemo(() => {
    if (today) {
      setSleep(today.sleep);
      setEnergy(today.energy);
      setStress(today.stress);
      setTrainingFeel(today.training_feel);
      setPainLevel(today.pain_level);
      setPainNote(today.pain_note ?? "");
      setNotes(today.notes ?? "");
    }
    // Intentionally only on first arrival
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [today?.id]);

  const mut = useMutation({
    mutationFn: () =>
      submit({
        data: {
          checkinDate: TODAY(),
          sleep,
          energy,
          stress,
          trainingFeel,
          painLevel,
          painNote: painNote.trim() || null,
          notes: notes.trim() || null,
        },
      }),
    onSuccess: () => {
      toast.success("Check-in gespeichert.");
      qc.invalidateQueries({ queryKey: ["my-checkins"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="mx-auto max-w-2xl space-y-5 px-4 pb-24 pt-3">
      <Link
        to="/bulls"
        className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Zurück zum Bulls Hub
      </Link>

      <header className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/15 text-primary">
          <Heart className="h-5 w-5" />
        </div>
        <div>
          <h1 className="font-display text-2xl font-bold uppercase leading-tight tracking-tight">
            Check-in
          </h1>
          <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
            Heute · {new Date().toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" })}
          </p>
        </div>
      </header>

      <ScaleField label="Schlaf" value={sleep} onChange={setSleep} lowLabel="schlecht" highLabel="top" />
      <ScaleField label="Energie" value={energy} onChange={setEnergy} lowLabel="niedrig" highLabel="hoch" />
      <ScaleField label="Stress" value={stress} onChange={setStress} lowLabel="entspannt" highLabel="hoch" />
      <ScaleField
        label="Trainingsgefühl"
        value={trainingFeel}
        onChange={setTrainingFeel}
        lowLabel="platt"
        highLabel="frisch"
      />
      <ScaleField
        label="Schmerzen / Beschwerden"
        value={painLevel}
        onChange={setPainLevel}
        min={0}
        lowLabel="keine"
        highLabel="stark"
      />

      {painLevel != null && painLevel > 0 && (
        <label className="block">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            Wo / Was?
          </span>
          <input
            value={painNote}
            onChange={(e) => setPainNote(e.target.value)}
            maxLength={500}
            placeholder="z. B. linke Wade, Zug beim Sprinten"
            className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          />
        </label>
      )}

      <label className="block">
        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
          Freitext an Coach (optional)
        </span>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          maxLength={2000}
          rows={3}
          className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          placeholder="Alles, was der Coach wissen sollte."
        />
      </label>

      <button
        type="button"
        disabled={mut.isPending}
        onClick={() => mut.mutate()}
        className="w-full rounded-lg bg-primary py-3 text-sm font-bold uppercase tracking-wider text-primary-foreground disabled:opacity-50"
      >
        {mut.isPending ? "Speichert…" : today ? "Check-in aktualisieren" : "Check-in speichern"}
      </button>

      {history.length > 0 && (
        <section className="pt-4">
          <h2 className="mb-2 text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
            Letzte Check-ins
          </h2>
          <ul className="divide-y divide-border rounded-lg border border-border bg-card">
            {history.slice(0, 10).map((c) => (
              <li key={c.id} className="px-3 py-2.5 text-[12px]">
                <div className="flex justify-between font-semibold">
                  <span>
                    {new Date(c.checkin_date).toLocaleDateString("de-DE", {
                      day: "2-digit",
                      month: "2-digit",
                      year: "2-digit",
                    })}
                  </span>
                  <span className="text-muted-foreground">
                    S{c.sleep ?? "–"} · E{c.energy ?? "–"} · St{c.stress ?? "–"} · T{c.training_feel ?? "–"}
                  </span>
                </div>
                {c.notes && <div className="mt-0.5 truncate text-muted-foreground">{c.notes}</div>}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function ScaleField({
  label,
  value,
  onChange,
  min = 1,
  lowLabel,
  highLabel,
}: {
  label: string;
  value: number | null;
  onChange: (v: number) => void;
  min?: number;
  lowLabel: string;
  highLabel: string;
}) {
  const options = [];
  for (let i = min; i <= 5; i++) options.push(i);
  return (
    <div>
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
        <span className="text-[10px] text-muted-foreground">
          {lowLabel} → {highLabel}
        </span>
      </div>
      <div className="mt-1 grid grid-cols-5 gap-1.5" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
        {options.map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            className={`rounded-md border py-2 text-sm font-bold ${
              value === n
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card text-foreground"
            }`}
          >
            {n}
          </button>
        ))}
      </div>
    </div>
  );
}
