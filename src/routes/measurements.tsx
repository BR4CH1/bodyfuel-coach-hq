import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Scale, Plus, Trash2, User as UserIcon, Save } from "lucide-react";
import { toast } from "sonner";
import { AppLayout } from "@/components/bodyfuel/AppLayout";
import { useSession } from "@/lib/bodyfuel/session";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/measurements")({
  head: () => ({ meta: [{ title: "Körpermaße — BODYFUEL" }] }),
  component: () => (
    <AppLayout>
      <MeasurementsContent />
    </AppLayout>
  ),
});

type Measurement = {
  id: string;
  measured_at: string;
  weight_kg: number | null;
  body_fat_pct: number | null;
  muscle_mass_kg: number | null;
  waist_cm: number | null;
  chest_cm: number | null;
  thigh_left_cm: number | null;
  thigh_right_cm: number | null;
  biceps_left_cm: number | null;
  biceps_right_cm: number | null;
  notes: string | null;
};

type ProfileExt = {
  display_name: string | null;
  height_cm: number | null;
  birthdate: string | null;
  gender: string | null;
  goal_weight_kg: number | null;
  activity_level: string | null;
  training_goal: string | null;
};

const num = (v: string) => (v.trim() === "" ? null : Number(v.replace(",", ".")));

function MeasurementsContent() {
  const { supabaseUser } = useSession();
  const uid = supabaseUser?.id;

  const [profile, setProfile] = useState<ProfileExt | null>(null);
  const [items, setItems] = useState<Measurement[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingMeasurement, setSavingMeasurement] = useState(false);

  // new entry form
  const today = new Date().toISOString().slice(0, 10);
  const [m, setM] = useState({
    measured_at: today,
    weight_kg: "",
    body_fat_pct: "",
    muscle_mass_kg: "",
    waist_cm: "",
    chest_cm: "",
    thigh_left_cm: "",
    thigh_right_cm: "",
    biceps_left_cm: "",
    biceps_right_cm: "",
    notes: "",
  });

  const load = async () => {
    if (!uid) return;
    setLoading(true);
    const [p, ms] = await Promise.all([
      supabase
        .from("profiles")
        .select("display_name, height_cm, birthdate, gender, goal_weight_kg, activity_level")
        .eq("id", uid)
        .maybeSingle(),
      supabase
        .from("body_measurements")
        .select("*")
        .eq("user_id", uid)
        .order("measured_at", { ascending: false }),
    ]);
    if (p.data) setProfile(p.data as ProfileExt);
    if (ms.data) setItems(ms.data as Measurement[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid]);

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uid || !profile) return;
    setSavingProfile(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        height_cm: profile.height_cm,
        birthdate: profile.birthdate,
        gender: profile.gender,
        goal_weight_kg: profile.goal_weight_kg,
        activity_level: profile.activity_level,
      })
      .eq("id", uid);
    setSavingProfile(false);
    if (error) toast.error(error.message);
    else toast.success("Profil gespeichert");
  };

  const addMeasurement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uid) return;
    setSavingMeasurement(true);
    const { error } = await supabase.from("body_measurements").insert({
      user_id: uid,
      measured_at: m.measured_at || today,
      weight_kg: num(m.weight_kg),
      body_fat_pct: num(m.body_fat_pct),
      muscle_mass_kg: num(m.muscle_mass_kg),
      waist_cm: num(m.waist_cm),
      chest_cm: num(m.chest_cm),
      thigh_left_cm: num(m.thigh_left_cm),
      thigh_right_cm: num(m.thigh_right_cm),
      biceps_left_cm: num(m.biceps_left_cm),
      biceps_right_cm: num(m.biceps_right_cm),
      notes: m.notes.trim() || null,
    });
    setSavingMeasurement(false);
    if (error) return toast.error(error.message);
    toast.success("Eintrag gespeichert");
    setM({
      measured_at: today,
      weight_kg: "",
      body_fat_pct: "",
      muscle_mass_kg: "",
      waist_cm: "",
      chest_cm: "",
      thigh_left_cm: "",
      thigh_right_cm: "",
      biceps_left_cm: "",
      biceps_right_cm: "",
      notes: "",
    });
    load();
  };

  const removeMeasurement = async (id: string) => {
    if (!confirm("Eintrag wirklich löschen?")) return;
    const { error } = await supabase.from("body_measurements").delete().eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Gelöscht");
      setItems((prev) => prev.filter((x) => x.id !== id));
    }
  };

  const latest = items[0];
  const bmi = useMemo(() => {
    if (!profile?.height_cm || !latest?.weight_kg) return null;
    const m = profile.height_cm / 100;
    return latest.weight_kg / (m * m);
  }, [profile?.height_cm, latest?.weight_kg]);

  if (!uid) return null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Mein Körper</p>
          <h1 className="font-display text-3xl font-bold sm:text-4xl">Körpermaße & Fortschritt</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Halte deine Werte regelmäßig fest, damit dein Coach deinen Fortschritt sieht.
          </p>
        </div>
        <a
          href="/progress"
          className="inline-flex items-center gap-2 self-start rounded-lg border border-gold/40 px-4 py-2 text-sm font-semibold text-gold hover:bg-gold/10"
        >
          Verlauf & Diagramme →
        </a>
      </div>

      {/* Summary */}
      <div className="grid gap-4 sm:grid-cols-3">
        <SummaryCard label="Aktuelles Gewicht" value={latest?.weight_kg ? `${latest.weight_kg} kg` : "—"} />
        <SummaryCard label="Körperfett" value={latest?.body_fat_pct ? `${latest.body_fat_pct} %` : "—"} />
        <SummaryCard label="BMI" value={bmi ? bmi.toFixed(1) : "—"} />
      </div>

      {/* Profile */}
      <form
        onSubmit={saveProfile}
        className="rounded-2xl border border-border bg-card p-5 sm:p-6"
      >
        <div className="mb-4 flex items-center gap-2 text-gold">
          <UserIcon className="h-5 w-5" />
          <h2 className="font-display text-lg font-bold text-foreground">Stammdaten</h2>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Größe (cm)">
            <Input
              type="number"
              step="0.1"
              value={profile?.height_cm ?? ""}
              onChange={(e) =>
                setProfile((p) => ({ ...(p ?? emptyProfile()), height_cm: num(e.target.value) }))
              }
            />
          </Field>
          <Field label="Geburtsdatum">
            <Input
              type="date"
              value={profile?.birthdate ?? ""}
              onChange={(e) =>
                setProfile((p) => ({ ...(p ?? emptyProfile()), birthdate: e.target.value || null }))
              }
            />
          </Field>
          <Field label="Geschlecht">
            <select
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={profile?.gender ?? ""}
              onChange={(e) =>
                setProfile((p) => ({ ...(p ?? emptyProfile()), gender: e.target.value || null }))
              }
            >
              <option value="">—</option>
              <option value="female">Weiblich</option>
              <option value="male">Männlich</option>
              <option value="other">Divers</option>
            </select>
          </Field>
          <Field label="Wunschgewicht (kg)">
            <Input
              type="number"
              step="0.1"
              value={profile?.goal_weight_kg ?? ""}
              onChange={(e) =>
                setProfile((p) => ({
                  ...(p ?? emptyProfile()),
                  goal_weight_kg: num(e.target.value),
                }))
              }
            />
          </Field>
          <Field label="Aktivitätslevel">
            <select
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={profile?.activity_level ?? ""}
              onChange={(e) =>
                setProfile((p) => ({
                  ...(p ?? emptyProfile()),
                  activity_level: e.target.value || null,
                }))
              }
            >
              <option value="">—</option>
              <option value="sedentary">Sitzend</option>
              <option value="light">Leicht aktiv</option>
              <option value="moderate">Moderat aktiv</option>
              <option value="active">Sehr aktiv</option>
              <option value="athlete">Leistungssport</option>
            </select>
          </Field>
        </div>
        <div className="mt-4">
          <Button
            type="submit"
            disabled={savingProfile || loading}
            className="bg-gradient-gold text-primary-foreground hover:opacity-90"
          >
            <Save className="mr-2 h-4 w-4" />
            {savingProfile ? "…" : "Stammdaten speichern"}
          </Button>
        </div>
      </form>

      {/* New measurement */}
      <form
        onSubmit={addMeasurement}
        className="rounded-2xl border border-border bg-card p-5 sm:p-6"
      >
        <div className="mb-4 flex items-center gap-2 text-gold">
          <Plus className="h-5 w-5" />
          <h2 className="font-display text-lg font-bold text-foreground">Neue Messung</h2>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Datum">
            <Input
              type="date"
              value={m.measured_at}
              onChange={(e) => setM({ ...m, measured_at: e.target.value })}
              required
            />
          </Field>
          <Field label="Gewicht (kg)">
            <Input
              type="number"
              step="0.1"
              value={m.weight_kg}
              onChange={(e) => setM({ ...m, weight_kg: e.target.value })}
            />
          </Field>
          <Field label="Körperfett (%)">
            <Input
              type="number"
              step="0.1"
              value={m.body_fat_pct}
              onChange={(e) => setM({ ...m, body_fat_pct: e.target.value })}
            />
          </Field>
          <Field label="Muskelmasse (kg)">
            <Input
              type="number"
              step="0.1"
              value={m.muscle_mass_kg}
              onChange={(e) => setM({ ...m, muscle_mass_kg: e.target.value })}
            />
          </Field>
          <Field label="Taille (cm)">
            <Input
              type="number"
              step="0.1"
              value={m.waist_cm}
              onChange={(e) => setM({ ...m, waist_cm: e.target.value })}
            />
          </Field>
          <Field label="Brust (cm)">
            <Input
              type="number"
              step="0.1"
              value={m.chest_cm}
              onChange={(e) => setM({ ...m, chest_cm: e.target.value })}
            />
          </Field>
          <Field label="Oberschenkel L (cm)">
            <Input
              type="number"
              step="0.1"
              value={m.thigh_left_cm}
              onChange={(e) => setM({ ...m, thigh_left_cm: e.target.value })}
            />
          </Field>
          <Field label="Oberschenkel R (cm)">
            <Input
              type="number"
              step="0.1"
              value={m.thigh_right_cm}
              onChange={(e) => setM({ ...m, thigh_right_cm: e.target.value })}
            />
          </Field>
          <Field label="Bizeps L (cm)">
            <Input
              type="number"
              step="0.1"
              value={m.biceps_left_cm}
              onChange={(e) => setM({ ...m, biceps_left_cm: e.target.value })}
            />
          </Field>
          <Field label="Bizeps R (cm)">
            <Input
              type="number"
              step="0.1"
              value={m.biceps_right_cm}
              onChange={(e) => setM({ ...m, biceps_right_cm: e.target.value })}
            />
          </Field>
          <Field label="Notizen" className="sm:col-span-2">
            <Input
              value={m.notes}
              onChange={(e) => setM({ ...m, notes: e.target.value })}
              placeholder="Wie hast du dich gefühlt?"
            />
          </Field>
        </div>
        <div className="mt-4">
          <Button
            type="submit"
            disabled={savingMeasurement}
            className="bg-gradient-gold text-primary-foreground hover:opacity-90"
          >
            <Plus className="mr-2 h-4 w-4" />
            {savingMeasurement ? "…" : "Messung hinzufügen"}
          </Button>
        </div>
      </form>

      {/* History */}
      <div className="rounded-2xl border border-border bg-card p-5 sm:p-6">
        <div className="mb-4 flex items-center gap-2 text-gold">
          <Scale className="h-5 w-5" />
          <h2 className="font-display text-lg font-bold text-foreground">Verlauf</h2>
        </div>
        {loading ? (
          <p className="text-sm text-muted-foreground">Lade…</p>
        ) : items.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Noch keine Einträge — trage oben deine erste Messung ein.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground">
                  <th className="py-2 pr-3">Datum</th>
                  <th className="py-2 pr-3">Gewicht</th>
                  <th className="py-2 pr-3">KF %</th>
                  <th className="py-2 pr-3">Muskel</th>
                  <th className="py-2 pr-3">Taille</th>
                  <th className="py-2 pr-3">Brust</th>
                  <th className="py-2 pr-3">OS L</th>
                  <th className="py-2 pr-3">OS R</th>
                  <th className="py-2 pr-3">Bi L</th>
                  <th className="py-2 pr-3">Bi R</th>
                  <th className="py-2 pr-3" />
                </tr>
              </thead>
              <tbody>
                {items.map((i) => (
                  <tr key={i.id} className="border-t border-border">
                    <td className="py-2 pr-3 font-medium">
                      {new Date(i.measured_at).toLocaleDateString("de-DE")}
                    </td>
                    <td className="py-2 pr-3">{i.weight_kg ?? "—"}</td>
                    <td className="py-2 pr-3">{i.body_fat_pct ?? "—"}</td>
                    <td className="py-2 pr-3">{i.muscle_mass_kg ?? "—"}</td>
                    <td className="py-2 pr-3">{i.waist_cm ?? "—"}</td>
                    <td className="py-2 pr-3">{i.chest_cm ?? "—"}</td>
                    <td className="py-2 pr-3">{i.thigh_left_cm ?? "—"}</td>
                    <td className="py-2 pr-3">{i.thigh_right_cm ?? "—"}</td>
                    <td className="py-2 pr-3">{i.biceps_left_cm ?? "—"}</td>
                    <td className="py-2 pr-3">{i.biceps_right_cm ?? "—"}</td>
                    <td className="py-2 pr-3 text-right">
                      <button
                        onClick={() => removeMeasurement(i.id)}
                        className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                        aria-label="Löschen"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function emptyProfile(): ProfileExt {
  return {
    display_name: null,
    height_cm: null,
    birthdate: null,
    gender: null,
    goal_weight_kg: null,
    activity_level: null,
  };
}

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`space-y-1.5 ${className ?? ""}`}>
      <Label className="text-xs uppercase tracking-wider text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="text-xs uppercase tracking-wider text-gold">{label}</div>
      <div className="mt-2 font-display text-3xl font-bold">{value}</div>
    </div>
  );
}
