import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Save, IdCard } from "lucide-react";
import { updateCustomerCoachingInfo, setCustomerWeight } from "@/lib/coaching.functions";
import { TRAINING_GOAL_LABELS } from "@/lib/training-goals";

type Gender = "male" | "female" | "other";
type Activity = "sedentary" | "light" | "moderate" | "active" | "athlete";

const ACTIVITY: { v: Activity; l: string }[] = [
  { v: "sedentary", l: "Sitzend" },
  { v: "light", l: "Leicht aktiv" },
  { v: "moderate", l: "Moderat aktiv" },
  { v: "active", l: "Sehr aktiv" },
  { v: "athlete", l: "Leistungssport" },
];

const GENDERS: { v: Gender; l: string }[] = [
  { v: "male", l: "Männlich" },
  { v: "female", l: "Weiblich" },
  { v: "other", l: "Divers" },
];

export type BaseDataInitial = {
  height_cm?: number | null;
  birthdate?: string | null;
  gender?: string | null;
  goal_weight_kg?: number | null;
  goal_target_date?: string | null;
  activity_level?: string | null;
  training_goal?: string | null;
};

export function CoachBaseDataEditor({
  userId,
  initial,
  currentWeightKg,
}: {
  userId: string;
  initial: BaseDataInitial;
  currentWeightKg?: number | null;
}) {
  const [height, setHeight] = useState<string>(initial.height_cm == null ? "" : String(initial.height_cm));
  const [birthdate, setBirthdate] = useState<string>(initial.birthdate ?? "");
  const [gender, setGender] = useState<Gender | "">((initial.gender as Gender) ?? "");
  const [goalWeight, setGoalWeight] = useState<string>(
    initial.goal_weight_kg == null ? "" : String(initial.goal_weight_kg),
  );
  const [goalDate, setGoalDate] = useState<string>(initial.goal_target_date ?? "");
  const [activity, setActivity] = useState<Activity | "">((initial.activity_level as Activity) ?? "");
  const [trainingGoal, setTrainingGoal] = useState<string>(initial.training_goal ?? "");
  const [newWeight, setNewWeight] = useState<string>("");

  useEffect(() => {
    setHeight(initial.height_cm == null ? "" : String(initial.height_cm));
    setBirthdate(initial.birthdate ?? "");
    setGender((initial.gender as Gender) ?? "");
    setGoalWeight(initial.goal_weight_kg == null ? "" : String(initial.goal_weight_kg));
    setGoalDate(initial.goal_target_date ?? "");
    setActivity((initial.activity_level as Activity) ?? "");
    setTrainingGoal(initial.training_goal ?? "");
  }, [initial]);

  const fn = useServerFn(updateCustomerCoachingInfo);
  const weightFn = useServerFn(setCustomerWeight);
  const qc = useQueryClient();

  const mut = useMutation({
    mutationFn: () =>
      fn({
        data: {
          user_id: userId,
          height_cm: height === "" ? null : Number(height),
          birthdate: birthdate || null,
          gender: (gender || null) as Gender | null,
          goal_weight_kg: goalWeight === "" ? null : Number(goalWeight),
          goal_target_date: goalDate || null,
          activity_level: (activity || null) as Activity | null,
          training_goal: trainingGoal || null,
        },
      }),
    onSuccess: () => {
      toast.success("Stammdaten gespeichert");
      qc.invalidateQueries({ queryKey: ["customer", userId] });
      qc.invalidateQueries({ queryKey: ["customer-detail", userId] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Fehler"),
  });

  const weightMut = useMutation({
    mutationFn: () => weightFn({ data: { user_id: userId, weight_kg: Number(newWeight) } }),
    onSuccess: () => {
      toast.success("Gewicht eingetragen");
      setNewWeight("");
      qc.invalidateQueries({ queryKey: ["customer", userId] });
      qc.invalidateQueries({ queryKey: ["customer-detail", userId] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Fehler"),
  });

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="mb-3 flex items-center gap-2">
        <IdCard className="h-4 w-4 text-gold" />
        <h3 className="font-display text-base font-bold">Stammdaten bearbeiten</h3>
      </div>
      <p className="text-xs text-muted-foreground mb-4">
        Diese Werte fließen in Zielprognose, Kalorienpfad und KI-Pläne ein. Bitte für jeden neuen
        Kunden direkt vollständig hinterlegen.
      </p>

      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Größe (cm)">
            <input
              type="number"
              inputMode="numeric"
              min={80}
              max={260}
              value={height}
              onChange={(e) => setHeight(e.target.value.replace(/[^0-9.]/g, ""))}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            />
          </Field>
          <Field label="Geburtsdatum">
            <input
              type="date"
              value={birthdate}
              onChange={(e) => setBirthdate(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            />
          </Field>
          <Field label="Geschlecht">
            <select
              value={gender}
              onChange={(e) => setGender(e.target.value as Gender | "")}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            >
              <option value="">—</option>
              {GENDERS.map((g) => (
                <option key={g.v} value={g.v}>{g.l}</option>
              ))}
            </select>
          </Field>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Wunschgewicht (kg)">
            <input
              type="number"
              inputMode="decimal"
              step="0.1"
              min={30}
              max={300}
              value={goalWeight}
              onChange={(e) => setGoalWeight(e.target.value.replace(/[^0-9.]/g, ""))}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            />
            {currentWeightKg != null && (
              <p className="mt-1 text-[11px] text-muted-foreground">Aktuell: {currentWeightKg} kg</p>
            )}
          </Field>
          <Field label="Wunschgewicht bis">
            <input
              type="date"
              value={goalDate}
              onChange={(e) => setGoalDate(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            />
          </Field>
          <Field label="Aktivitätslevel">
            <select
              value={activity}
              onChange={(e) => setActivity(e.target.value as Activity | "")}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            >
              <option value="">—</option>
              {ACTIVITY.map((a) => (
                <option key={a.v} value={a.v}>{a.l}</option>
              ))}
            </select>
          </Field>
        </div>

        <Field label="Trainingsziel">
          <select
            value={trainingGoal}
            onChange={(e) => setTrainingGoal(e.target.value)}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
          >
            <option value="">—</option>
            {Object.entries(TRAINING_GOAL_LABELS)
              .filter(([k]) =>
                ["performance", "lean_bulk", "fat_loss", "aggressive_cut", "recovery"].includes(k),
              )
              .map(([k, l]) => (
                <option key={k} value={k}>{l}</option>
              ))}
          </select>
        </Field>

        <button
          onClick={() => mut.mutate()}
          disabled={mut.isPending}
          className="inline-flex items-center gap-2 rounded-lg bg-gold px-4 py-2 text-sm font-semibold text-black hover:bg-gold/90 disabled:opacity-50"
        >
          <Save className="h-4 w-4" /> Stammdaten speichern
        </button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-muted-foreground mb-1">{label}</label>
      {children}
    </div>
  );
}
