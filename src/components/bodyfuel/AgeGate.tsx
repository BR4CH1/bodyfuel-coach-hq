import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ShieldAlert, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { startGuardianConsent } from "@/lib/guardian.functions";

/**
 * Reusable Age Gate.
 * - Fragt Geburtsdatum
 * - Bei <18: fragt Eltern-Name + Eltern-E-Mail + verschickt Bestätigungs-Mail
 * - Bei Volljährigkeit: Callback onAdult()
 *
 * Wird nach erfolgreichem Sign-up im selben Flow gerendert (User muss eingeloggt sein,
 * weil die Server-Function `requireSupabaseAuth` nutzt).
 */
export function AgeGate({
  onAdult,
  onMinorRequested,
}: {
  onAdult?: () => void;
  onMinorRequested?: (info: { guardianEmail: string }) => void;
}) {
  const fn = useServerFn(startGuardianConsent);
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState<"age" | "guardian" | "sent">("age");
  const [birthdate, setBirthdate] = useState("");
  const [guardianName, setGuardianName] = useState("");
  const [guardianEmail, setGuardianEmail] = useState("");

  const ageFromDob = (dob: string): number | null => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dob)) return null;
    const d = new Date(dob);
    if (isNaN(d.getTime())) return null;
    return Math.floor((Date.now() - d.getTime()) / (365.25 * 24 * 3600 * 1000));
  };

  const submitAge = async (e: React.FormEvent) => {
    e.preventDefault();
    const age = ageFromDob(birthdate);
    if (age === null || age < 5 || age > 110) return toast.error("Bitte gültiges Geburtsdatum eingeben.");
    if (age >= 18) {
      setBusy(true);
      try {
        await fn({ data: { birthdate, guardianName: "—", guardianEmail: "noop@noop.invalid" } as any });
      } catch {
        // fallthrough — wir speichern unten direkt
      } finally {
        setBusy(false);
      }
      onAdult?.();
      return;
    }
    setStep("guardian");
  };

  const submitGuardian = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!guardianName.trim() || guardianName.trim().length < 2)
      return toast.error("Bitte Name eines Erziehungsberechtigten eintragen.");
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(guardianEmail))
      return toast.error("Bitte gültige E-Mail des Erziehungsberechtigten eintragen.");
    setBusy(true);
    try {
      const res = await fn({
        data: {
          birthdate,
          guardianName: guardianName.trim(),
          guardianEmail: guardianEmail.trim().toLowerCase(),
        },
      });
      if (!(res as any)?.ok) {
        toast.error((res as any)?.error ?? "Konnte Eltern-E-Mail nicht senden.");
        return;
      }
      setStep("sent");
      onMinorRequested?.({ guardianEmail: guardianEmail.trim().toLowerCase() });
    } finally {
      setBusy(false);
    }
  };

  const age = ageFromDob(birthdate);
  const isUnder16 = age !== null && age < 16;

  if (step === "sent") {
    return (
      <div className="rounded-2xl border border-gold/30 bg-secondary/40 p-5">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-gold" />
          <p className="font-semibold">Eltern-E-Mail verschickt</p>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          Wir haben eine Bestätigungs-Mail an{" "}
          <strong>{guardianEmail}</strong> gesendet. Der Account ist
          freigeschaltet, sobald deine Eltern den Link bestätigen.
          Kostenpflichtige Buchungen sind erst danach möglich.
        </p>
      </div>
    );
  }

  if (step === "guardian") {
    return (
      <form onSubmit={submitGuardian} className="space-y-4 rounded-2xl border border-gold/30 bg-secondary/40 p-5">
        <div className="flex items-start gap-2">
          <ShieldAlert className="mt-0.5 h-5 w-5 text-gold" />
          <div className="text-sm">
            <p className="font-semibold">Eltern-Zustimmung erforderlich</p>
            <p className="mt-1 text-muted-foreground">
              BodyFuel kann von Minderjährigen nur mit Zustimmung eines
              Erziehungsberechtigten genutzt werden.
              {isUnder16 && (
                <span className="mt-1 block font-medium text-foreground">
                  Unter 16 Jahren ist die Zustimmung gesetzlich zwingend
                  erforderlich.
                </span>
              )}
            </p>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="gn">Name Erziehungsberechtigte/r</Label>
          <Input id="gn" value={guardianName} onChange={(e) => setGuardianName(e.target.value)} required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ge">E-Mail Erziehungsberechtigte/r</Label>
          <Input id="ge" type="email" value={guardianEmail} onChange={(e) => setGuardianEmail(e.target.value)} required />
        </div>
        <Button type="submit" disabled={busy} className="w-full bg-gradient-gold text-primary-foreground hover:opacity-90">
          {busy ? "…" : "Eltern-Bestätigungslink senden"}
        </Button>
      </form>
    );
  }

  return (
    <form onSubmit={submitAge} className="space-y-4 rounded-2xl border border-border bg-card p-5">
      <div>
        <Label className="text-sm font-semibold">Altersbestätigung</Label>
        <p className="mt-1 text-xs text-muted-foreground">
          Bist du mindestens 18 Jahre alt? Bitte gib dein Geburtsdatum an.
        </p>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="bd">Geburtsdatum</Label>
        <Input id="bd" type="date" value={birthdate} onChange={(e) => setBirthdate(e.target.value)} required />
      </div>
      <Button type="submit" disabled={busy} className="w-full bg-gradient-gold text-primary-foreground hover:opacity-90">
        {busy ? "…" : "Weiter"}
      </Button>
    </form>
  );
}
