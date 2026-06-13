import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { CalendarCheck, Save, Smile } from "lucide-react";
import { toast } from "sonner";
import { AppLayout } from "@/components/bodyfuel/AppLayout";
import { useSession } from "@/lib/bodyfuel/session";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/check-in")({
  head: () => ({ meta: [{ title: "Wochen-Check-in — BODYFUEL" }] }),
  component: () => (
    <AppLayout>
      <WeeklyCheckIn />
    </AppLayout>
  ),
});

function mondayOf(d: Date): string {
  const x = new Date(d);
  const day = (x.getDay() + 6) % 7;
  x.setDate(x.getDate() - day);
  return x.toISOString().slice(0, 10);
}

const num = (v: string) => (v.trim() === "" ? null : Number(v.replace(",", ".")));

type Form = {
  weight_kg: string;
  body_fat_pct: string;
  waist_cm: string;
  chest_cm: string;
  thigh_left_cm: string;
  thigh_right_cm: string;
  biceps_left_cm: string;
  biceps_right_cm: string;
  mood: number | null;
  energy: number | null;
  sleep_quality: number | null;
  training_adherence: number | null;
  nutrition_adherence: number | null;
  wins: string;
  struggles: string;
};

const empty: Form = {
  weight_kg: "",
  body_fat_pct: "",
  waist_cm: "",
  chest_cm: "",
  thigh_left_cm: "",
  thigh_right_cm: "",
  biceps_left_cm: "",
  biceps_right_cm: "",
  mood: null,
  energy: null,
  sleep_quality: null,
  training_adherence: null,
  nutrition_adherence: null,
  wins: "",
  struggles: "",
};

function WeeklyCheckIn() {
  const { supabaseUser } = useSession();
  const uid = supabaseUser?.id;
  const week = mondayOf(new Date());
  const [form, setForm] = useState<Form>(empty);
  const [existingId, setExistingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!uid) return;
    (async () => {
      const { data } = await supabase
        .from("weekly_checkins")
        .select("*")
        .eq("user_id", uid)
        .eq("week_start", week)
        .maybeSingle();
      if (data) {
        setExistingId(data.id);
        setForm({
          weight_kg: data.weight_kg?.toString() ?? "",
          body_fat_pct: data.body_fat_pct?.toString() ?? "",
          waist_cm: data.waist_cm?.toString() ?? "",
          chest_cm: data.chest_cm?.toString() ?? "",
          thigh_left_cm: data.thigh_left_cm?.toString() ?? "",
          thigh_right_cm: data.thigh_right_cm?.toString() ?? "",
          biceps_left_cm: data.biceps_left_cm?.toString() ?? "",
          biceps_right_cm: data.biceps_right_cm?.toString() ?? "",
          mood: data.mood,
          energy: data.energy,
          sleep_quality: data.sleep_quality,
          training_adherence: data.training_adherence,
          nutrition_adherence: data.nutrition_adherence,
          wins: data.wins ?? "",
          struggles: data.struggles ?? "",
        });
      }
      setLoading(false);
    })();
  }, [uid, week]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uid) return;
    setBusy(true);
    const payload = {
      user_id: uid,
      week_start: week,
      weight_kg: num(form.weight_kg),
      body_fat_pct: num(form.body_fat_pct),
      waist_cm: num(form.waist_cm),
      chest_cm: num(form.chest_cm),
      thigh_left_cm: num(form.thigh_left_cm),
      thigh_right_cm: num(form.thigh_right_cm),
      biceps_left_cm: num(form.biceps_left_cm),
      biceps_right_cm: num(form.biceps_right_cm),
      mood: form.mood,
      energy: form.energy,
      sleep_quality: form.sleep_quality,
      training_adherence: form.training_adherence,
      nutrition_adherence: form.nutrition_adherence,
      wins: form.wins.trim() || null,
      struggles: form.struggles.trim() || null,
      submitted_at: new Date().toISOString(),
    };
    const { error } = await supabase
      .from("weekly_checkins")
      .upsert(payload, { onConflict: "user_id,week_start" });

    // Also write a body measurement if values are given
    if (!error && (payload.weight_kg || payload.body_fat_pct || payload.waist_cm)) {
      await supabase.from("body_measurements").insert({
        user_id: uid,
        measured_at: week,
        weight_kg: payload.weight_kg,
        body_fat_pct: payload.body_fat_pct,
        waist_cm: payload.waist_cm,
        chest_cm: payload.chest_cm,
        thigh_left_cm: payload.thigh_left_cm,
        thigh_right_cm: payload.thigh_right_cm,
        biceps_left_cm: payload.biceps_left_cm,
        biceps_right_cm: payload.biceps_right_cm,
      });
    }

    setBusy(false);
    if (error) toast.error(error.message);
    else toast.success(existingId ? "Check-in aktualisiert" : "Check-in gespeichert");
  };

  if (!uid) return null;

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
          Wochen-Check-in
        </p>
        <h1 className="font-display text-3xl font-bold sm:text-4xl">
          Woche ab {new Date(week).toLocaleDateString("de-DE")}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Trage deine Werte einmal pro Woche ein. Dein Coach sieht alles sofort.
        </p>
      </div>

      {loading ? (
        <div className="rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground">
          Lade…
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-6">
          {/* Maße */}
          <Section icon={<CalendarCheck className="h-5 w-5" />} title="Maße">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Field label="Gewicht (kg)">
                <Input
                  type="number"
                  step="0.1"
                  value={form.weight_kg}
                  onChange={(e) => setForm({ ...form, weight_kg: e.target.value })}
                />
              </Field>
              <Field label="Körperfett (%)">
                <Input
                  type="number"
                  step="0.1"
                  value={form.body_fat_pct}
                  onChange={(e) => setForm({ ...form, body_fat_pct: e.target.value })}
                />
              </Field>
              <Field label="Taille (cm)">
                <Input
                  type="number"
                  step="0.1"
                  value={form.waist_cm}
                  onChange={(e) => setForm({ ...form, waist_cm: e.target.value })}
                />
              </Field>
              <Field label="Brust (cm)">
                <Input
                  type="number"
                  step="0.1"
                  value={form.chest_cm}
                  onChange={(e) => setForm({ ...form, chest_cm: e.target.value })}
                />
              </Field>
              <Field label="Oberschenkel L (cm)">
                <Input
                  type="number"
                  step="0.1"
                  value={form.thigh_left_cm}
                  onChange={(e) => setForm({ ...form, thigh_left_cm: e.target.value })}
                />
              </Field>
              <Field label="Oberschenkel R (cm)">
                <Input
                  type="number"
                  step="0.1"
                  value={form.thigh_right_cm}
                  onChange={(e) => setForm({ ...form, thigh_right_cm: e.target.value })}
                />
              </Field>
              <Field label="Bizeps L (cm)">
                <Input
                  type="number"
                  step="0.1"
                  value={form.biceps_left_cm}
                  onChange={(e) => setForm({ ...form, biceps_left_cm: e.target.value })}
                />
              </Field>
              <Field label="Bizeps R (cm)">
                <Input
                  type="number"
                  step="0.1"
                  value={form.biceps_right_cm}
                  onChange={(e) => setForm({ ...form, biceps_right_cm: e.target.value })}
                />
              </Field>
            </div>
          </Section>

          {/* Bewertung */}
          <Section icon={<Smile className="h-5 w-5" />} title="Wie war deine Woche?">
            <div className="space-y-4">
              <Rating
                label="Stimmung"
                value={form.mood}
                onChange={(v) => setForm({ ...form, mood: v })}
              />
              <Rating
                label="Energie"
                value={form.energy}
                onChange={(v) => setForm({ ...form, energy: v })}
              />
              <Rating
                label="Schlafqualität"
                value={form.sleep_quality}
                onChange={(v) => setForm({ ...form, sleep_quality: v })}
              />
              <Rating
                label="Training eingehalten"
                value={form.training_adherence}
                onChange={(v) => setForm({ ...form, training_adherence: v })}
              />
              <Rating
                label="Ernährung eingehalten"
                value={form.nutrition_adherence}
                onChange={(v) => setForm({ ...form, nutrition_adherence: v })}
              />
            </div>
          </Section>

          {/* Notizen */}
          <Section title="Notizen">
            <div className="space-y-4">
              <Field label="Erfolge dieser Woche">
                <Textarea
                  rows={3}
                  value={form.wins}
                  onChange={(e) => setForm({ ...form, wins: e.target.value })}
                  placeholder="Worauf bist du stolz?"
                />
              </Field>
              <Field label="Hürden / Hindernisse">
                <Textarea
                  rows={3}
                  value={form.struggles}
                  onChange={(e) => setForm({ ...form, struggles: e.target.value })}
                  placeholder="Was war schwer? Wo brauchst du Unterstützung?"
                />
              </Field>
            </div>
          </Section>

          <div className="flex justify-end">
            <Button
              type="submit"
              disabled={busy}
              className="bg-gradient-gold text-primary-foreground hover:opacity-90"
            >
              <Save className="mr-2 h-4 w-4" />
              {busy ? "…" : existingId ? "Aktualisieren" : "Check-in absenden"}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}

function Section({
  icon,
  title,
  children,
}: {
  icon?: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 sm:p-6">
      <div className="mb-4 flex items-center gap-2 text-gold">
        {icon}
        <h2 className="font-display text-lg font-bold text-foreground">{title}</h2>
      </div>
      {children}
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs uppercase tracking-wider text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function Rating({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number | null;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <Label className="text-xs uppercase tracking-wider text-muted-foreground">
          {label}
        </Label>
        <span className="text-xs text-muted-foreground">{value ? `${value} / 5` : "—"}</span>
      </div>
      <div className="grid grid-cols-5 gap-2">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            className={`rounded-lg border py-2 text-sm font-semibold transition ${
              value === n
                ? "border-gold bg-gradient-gold text-primary-foreground"
                : "border-border bg-background/40 text-muted-foreground hover:border-gold/40"
            }`}
          >
            {n}
          </button>
        ))}
      </div>
    </div>
  );
}
