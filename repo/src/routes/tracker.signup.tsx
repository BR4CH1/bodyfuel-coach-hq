import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { Flame } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/bodyfuel/session";
import { seedMyNutritionTargets } from "@/lib/free-targets.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/tracker/signup")({
  head: () => ({ meta: [{ title: "Kostenlos starten — BodyFuel Tracker" }] }),
  component: TrackerSignup,
});

const schema = z.object({
  first_name: z.string().trim().min(1, "Vorname erforderlich").max(60),
  last_name: z.string().trim().min(1, "Nachname erforderlich").max(60),
  email: z.string().trim().email("Ungültige E-Mail").max(255),
  password: z.string().min(8, "Mindestens 8 Zeichen").max(100),
  height_cm: z.coerce.number({ invalid_type_error: "Größe erforderlich" }).int().positive("Größe erforderlich").max(260),
  weight_kg: z.coerce.number({ invalid_type_error: "Gewicht erforderlich" }).positive("Gewicht erforderlich").max(400),
  gender: z.enum(["male", "female", "other"], { errorMap: () => ({ message: "Geschlecht wählen" }) }),
  birthdate: z.string().min(8, "Geburtsdatum erforderlich"),
  goal: z.enum(["fat_loss", "maintain", "lean_bulk"], { errorMap: () => ({ message: "Ziel wählen" }) }),
});

function TrackerSignup() {
  const { supabaseUser, isFreeUser } = useSession();
  const navigate = useNavigate();
  const seedTargets = useServerFn(seedMyNutritionTargets);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (supabaseUser && isFreeUser) navigate({ to: "/tracker/app" });
  }, [supabaseUser, isFreeUser, navigate]);

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const raw = Object.fromEntries(fd.entries());
    const parsed = schema.safeParse(raw);
    if (!parsed.success) return toast.error(parsed.error.issues[0].message);
    const v = parsed.data;
    setBusy(true);
    try {
      const display_name = `${v.first_name} ${v.last_name}`.trim();
      const { data, error } = await supabase.auth.signUp({
        email: v.email.toLowerCase(),
        password: v.password,
        options: {
          emailRedirectTo: `${window.location.origin}/tracker/app`,
          data: {
            tier: "free",
            display_name,
            first_name: v.first_name,
            last_name: v.last_name,
            // Eckdaten als Metadaten — werden beim ersten authentifizierten
            // Aufruf in /tracker/app geseedet, falls hier noch keine Session
            // existiert (z.B. wenn Email-Bestätigung aktiv ist).
            seed_height_cm: v.height_cm,
            seed_weight_kg: v.weight_kg,
            seed_gender: v.gender,
            seed_birthdate: v.birthdate,
            seed_goal: v.goal,
          },
        },
      });
      if (error) throw error;
      const userId = data.user?.id;
      const hasSession = !!data.session;
      if (userId && hasSession) {
        try {
          await seedTargets({
            data: {
              height_cm: v.height_cm,
              weight_kg: v.weight_kg,
              gender: v.gender,
              birthdate: v.birthdate,
              goal: v.goal,
            },
          });
        } catch (e) {
          console.error("seedTargets failed", e);
        }
        await supabase.from("free_user_events").insert({
          user_id: userId,
          event: "signup",
          details: {},
        });
      }
      toast.success(hasSession ? "Willkommen bei BodyFuel!" : "Bitte bestätige deine E-Mail, um zu starten.");
      navigate({ to: "/tracker/app" });
    } catch (err: any) {
      toast.error(err?.message ?? "Registrierung fehlgeschlagen");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-32 top-10 h-96 w-96 rounded-full bg-primary/15 blur-3xl" />
      </div>
      <div className="relative w-full max-w-md rounded-3xl border border-border bg-card p-7 shadow-gold sm:p-9">
        <div className="mb-5 flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-gold">
            <Flame className="h-5 w-5 text-primary-foreground" strokeWidth={2.5} />
          </div>
          <div>
            <div className="font-display text-lg font-bold tracking-wider">BODYFUEL TRACKER</div>
            <div className="text-[10px] uppercase tracking-[0.2em] text-primary">Kostenlos starten</div>
          </div>
        </div>
        <h2 className="font-display text-2xl font-bold">Account erstellen</h2>
        <p className="mt-1 text-sm text-muted-foreground">Damit wir deine Makros korrekt berechnen können, brauchen wir ein paar Eckdaten.</p>

        <form onSubmit={submit} className="mt-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="first_name">Vorname</Label>
              <Input id="first_name" name="first_name" required autoComplete="given-name" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="last_name">Nachname</Label>
              <Input id="last_name" name="last_name" required autoComplete="family-name" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="email">E-Mail</Label>
            <Input id="email" name="email" type="email" required autoComplete="email" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">Passwort</Label>
            <Input id="password" name="password" type="password" required minLength={8} autoComplete="new-password" />
            <p className="text-[11px] text-muted-foreground">Mindestens 8 Zeichen.</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="weight_kg">Gewicht (kg)</Label>
              <Input id="weight_kg" name="weight_kg" type="number" step="0.1" required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="height_cm">Größe (cm)</Label>
              <Input id="height_cm" name="height_cm" type="number" required />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="gender">Geschlecht</Label>
              <select
                id="gender"
                name="gender"
                required
                defaultValue=""
                className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
              >
                <option value="" disabled>—</option>
                <option value="male">Männlich</option>
                <option value="female">Weiblich</option>
                <option value="other">Divers</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="birthdate">Geburtsdatum</Label>
              <Input id="birthdate" name="birthdate" type="date" required />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="goal">Dein Ziel</Label>
            <select
              id="goal"
              name="goal"
              required
              defaultValue=""
              className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
            >
              <option value="" disabled>—</option>
              <option value="fat_loss">Abnehmen</option>
              <option value="maintain">Gewicht halten</option>
              <option value="lean_bulk">Muskelaufbau</option>
            </select>
            <p className="text-[11px] text-muted-foreground">Bestimmt deine Train-/Restday-Kalorien.</p>
          </div>

          <Button
            type="submit"
            disabled={busy}
            className="w-full bg-gradient-gold text-primary-foreground hover:opacity-90"
          >
            {busy ? "…" : "Kostenlos starten"}
          </Button>
        </form>

        <p className="mt-5 text-center text-xs text-muted-foreground">
          Schon dabei?{" "}
          <Link to="/tracker/login" className="text-primary hover:underline">
            Einloggen
          </Link>
        </p>
      </div>
    </div>
  );
}
