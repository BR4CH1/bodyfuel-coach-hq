import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Droplet, Beef, Target, Trophy, Scale, Image, FileText, Dumbbell, ChevronRight, HeartPulse } from "lucide-react";
import { AppLayout } from "@/components/bodyfuel/AppLayout";
import { BullsGate } from "@/components/bodyfuel/BullsGate";
import { BullsHero } from "@/components/bodyfuel/BullsHero";
import { CoachingUpsell } from "@/components/bodyfuel/CoachingUpsell";
import { useSession } from "@/lib/bodyfuel/session";
import {
  getBullsProfile,
  upsertBullsProfile,
  getStarterScore,
  type BullsPosition,
  type BullsGoal,
} from "@/lib/bulls.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/bulls/")({
  head: () => ({ meta: [{ title: "Bulls Performance Hub — BODYFUEL" }] }),
  component: () => (
    <AppLayout>
      <BullsGate>
        <BullsHome />
      </BullsGate>
    </AppLayout>
  ),
});

const POSITIONS: { v: BullsPosition; l: string }[] = [
  { v: "QB", l: "QB — Quarterback" },
  { v: "RB", l: "RB — Running Back" },
  { v: "WR", l: "WR — Wide Receiver" },
  { v: "TE", l: "TE — Tight End" },
  { v: "OL", l: "OL — Offensive Line" },
  { v: "DL", l: "DL — Defensive Line" },
  { v: "LB", l: "LB — Linebacker" },
  { v: "DB", l: "DB — Defensive Back" },
  { v: "KP", l: "Kicker / Punter" },
  { v: "COACH", l: "Coach / Sonstiges" },
];

const GOALS: { v: BullsGoal; l: string }[] = [
  { v: "fat_loss", l: "Körperfett reduzieren" },
  { v: "muscle_gain", l: "Muskelmasse aufbauen" },
  { v: "performance", l: "Football Performance verbessern" },
  { v: "general_fitness", l: "Fitter werden / allgemein verbessern" },
];

const GOAL_FOCUS: Record<BullsGoal, string> = {
  fat_loss: "Protein hochhalten, Schritte sammeln und regelmäßig trainieren.",
  muscle_gain: "Stärker werden, ausreichend essen und sauber regenerieren.",
  performance: "Kraft, Explosivität, Beweglichkeit und Regeneration verbessern.",
  general_fitness: "Konstanz, Grundlagentraining und bessere Routinen aufbauen.",
};

function BullsHome() {
  const profileQ = useQuery({ queryKey: ["bulls-profile"], queryFn: useServerFn(getBullsProfile) });
  if (profileQ.isLoading) return <p className="text-sm text-muted-foreground">Lade…</p>;
  if (!profileQ.data) return <Onboarding />;
  return <Dashboard profile={profileQ.data as any} />;
}

function Onboarding() {
  const { supabaseUser, profile } = useSession();
  const qc = useQueryClient();
  const fn = useServerFn(upsertBullsProfile);
  const [form, setForm] = useState({
    first_name: profile?.display_name?.split(" ")[0] ?? "",
    last_name: profile?.display_name?.split(" ").slice(1).join(" ") ?? "",
    email: supabaseUser?.email ?? "",
    weight_kg: "",
    height_cm: "",
    position: "" as BullsPosition | "",
    main_goal: "" as BullsGoal | "",
  });
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.first_name || !form.last_name || !form.email || !form.weight_kg || !form.height_cm || !form.position || !form.main_goal) {
      return toast.error("Bitte alle Felder ausfüllen.");
    }
    setBusy(true);
    try {
      await fn({
        data: {
          first_name: form.first_name,
          last_name: form.last_name,
          email: form.email,
          weight_kg: Number(form.weight_kg),
          height_cm: Number(form.height_cm),
          position: form.position as BullsPosition,
          main_goal: form.main_goal as BullsGoal,
        },
      });
      toast.success("Willkommen im Bulls Performance Hub! 🏈");
      qc.invalidateQueries({ queryKey: ["bulls-profile"] });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <BullsHero
        title="Willkommen im Bulls Performance Hub"
        subtitle="Kurze Einrichtung — danach steht dir der gesamte Bereich zur Verfügung."
      />
      <form
        onSubmit={submit}
        className="space-y-5 rounded-2xl border border-border bg-card p-6"
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Vorname *</Label>
            <Input value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Nachname *</Label>
            <Input value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} />
          </div>
        </div>
        <div className="space-y-2">
          <Label>E-Mail *</Label>
          <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Gewicht (kg) *</Label>
            <Input type="number" step="0.1" value={form.weight_kg} onChange={(e) => setForm({ ...form, weight_kg: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Größe (cm) *</Label>
            <Input type="number" value={form.height_cm} onChange={(e) => setForm({ ...form, height_cm: e.target.value })} />
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Position *</Label>
            <Select value={form.position} onValueChange={(v) => setForm({ ...form, position: v as BullsPosition })}>
              <SelectTrigger><SelectValue placeholder="Auswählen" /></SelectTrigger>
              <SelectContent>
                {POSITIONS.map((p) => <SelectItem key={p.v} value={p.v}>{p.l}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Hauptziel *</Label>
            <Select value={form.main_goal} onValueChange={(v) => setForm({ ...form, main_goal: v as BullsGoal })}>
              <SelectTrigger><SelectValue placeholder="Auswählen" /></SelectTrigger>
              <SelectContent>
                {GOALS.map((g) => <SelectItem key={g.v} value={g.v}>{g.l}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <Button type="submit" disabled={busy} className="w-full bg-gradient-bulls text-white">
          {busy ? "Speichere …" : "Bulls Hub starten"}
        </Button>
      </form>
    </div>
  );
}

function Dashboard({ profile }: { profile: { weight_kg: number; main_goal: BullsGoal; first_name: string; position: BullsPosition } }) {
  const scoreQ = useQuery({ queryKey: ["bulls-score"], queryFn: useServerFn(getStarterScore) });
  const protein = Math.round(profile.weight_kg * 2);
  const water = (profile.weight_kg * 35) / 1000;
  const score = scoreQ.data?.score ?? 0;
  const scoreText =
    score <= 30 ? "Starker Start. Jetzt die Grundlagen umsetzen."
    : score <= 60 ? "Gute Basis. Mit mehr Konstanz kommt mehr Fortschritt."
    : score <= 85 ? "Sehr solide. Du bist auf einem guten Weg."
    : "Stark. Du nutzt den Performance Hub optimal.";

  return (
    <div className="space-y-6">
      <BullsHero
        title={`Willkommen zurück, ${profile.first_name}`}
        subtitle="Dein kostenloser Starter-Bereich für Ernährung, Training und Football Performance."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card icon={Beef} title="Dein Proteinziel" value={`${protein} g`} hint={`${profile.weight_kg} kg × 2`}>
          Protein hilft dir beim Muskelerhalt, Muskelaufbau und bei der Regeneration.
        </Card>
        <Card icon={Droplet} title="Dein Wasserziel" value={`${water.toFixed(2)} L`} hint={`${profile.weight_kg} kg × 35 ml`}>
          Genug Flüssigkeit unterstützt Leistung, Konzentration und Regeneration.
        </Card>
        <Card icon={Target} title="Dein Fokus" value={GOALS.find((g) => g.v === profile.main_goal)?.l ?? "—"} hint="dein Hauptziel">
          {GOAL_FOCUS[profile.main_goal]}
        </Card>
      </div>

      <div className="rounded-2xl border border-border bg-card p-6">
        <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-bulls-red">
          <Trophy className="h-4 w-4" /> BodyFuel Starter Score
        </div>
        <p className="mt-2 font-display text-4xl font-bold text-white">{score} / 100</p>
        <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-secondary">
          <div className="h-full bg-gradient-bulls" style={{ width: `${score}%` }} />
        </div>
        <p className="mt-3 text-sm text-muted-foreground">{scoreText}</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Tile to="/bulls/nutrition" icon={FileText} title="Mini-Ernährungsplan" />
        <Tile to="/bulls/training" icon={Dumbbell} title="Mini-Trainingsplan" />
        <Tile to="/bulls/benchmarks" icon={Target} title="Positions-Benchmarks" />
        <Tile to="/bulls/weight" icon={Scale} title="Gewichtstracking" />
        <Tile to="/bulls/photos" icon={Image} title="Fortschrittsfotos" />
        <Tile to="/bulls/recovery" icon={HeartPulse} title="Recovery & Prävention" />
      </div>

      <div className="rounded-2xl border border-border bg-secondary/40 p-5 text-sm text-muted-foreground">
        Die offizielle <span className="font-semibold text-bulls-red">Bulls Challenge</span> mit
        Tagespunkten, Sonderpunkten und Wochenwertung läuft weiterhin über WhatsApp. Der Performance
        Hub ist dein zusätzlicher kostenloser Bereich für Ernährung, Training und Fortschritt.
      </div>

      <CoachingUpsell />
    </div>
  );
}

function Card({ icon: Icon, title, value, hint, children }: any) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-bulls-red">
        <Icon className="h-4 w-4" /> {title}
      </div>
      <p className="mt-2 font-display text-3xl font-bold text-white">{value}</p>
      {hint && <p className="mt-0.5 text-[11px] text-muted-foreground">{hint}</p>}
      <p className="mt-3 text-sm text-muted-foreground">{children}</p>
    </div>
  );
}

function Tile({ to, icon: Icon, title }: any) {
  return (
    <Link
      to={to}
      className="group flex items-center justify-between rounded-2xl border border-border bg-card p-5 transition hover:border-bulls-red/60 hover:bg-card/80"
    >
      <div className="flex items-center gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-bulls text-white">
          <Icon className="h-5 w-5" />
        </div>
        <span className="font-semibold">{title}</span>
      </div>
      <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-bulls-red" />
    </Link>
  );
}
