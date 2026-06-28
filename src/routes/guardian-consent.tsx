import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Flame, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";

export const Route = createFileRoute("/guardian-consent")({
  head: () => ({
    meta: [
      { title: "Eltern-Zustimmung — BODYFUEL" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: GuardianConsentPage,
});

type ValidateResp =
  | { valid: true; guardian_email: string; guardian_name: string | null; minor_name: string | null; minor_birthdate: string | null }
  | { valid: false; reason?: string; error?: string };

function GuardianConsentPage() {
  const [token, setToken] = useState<string | null>(null);
  const [state, setState] = useState<ValidateResp | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [form, setForm] = useState({
    name: "",
    isGuardian: false,
    agb: false,
    datenschutz: false,
    gesundheit: false,
    widerruf: false,
  });

  useEffect(() => {
    const t = new URL(window.location.href).searchParams.get("token");
    setToken(t);
    if (!t) {
      setLoading(false);
      return;
    }
    fetch(`/api/public/guardian-consent?token=${encodeURIComponent(t)}`)
      .then((r) => r.json())
      .then((json: ValidateResp) => {
        setState(json);
        if (json.valid && json.guardian_name) {
          setForm((f) => ({ ...f, name: json.guardian_name ?? "" }));
        }
      })
      .catch(() => setState({ valid: false, reason: "network" }))
      .finally(() => setLoading(false));
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || form.name.trim().length < 2)
      return toast.error("Bitte Ihren vollständigen Namen angeben.");
    if (!form.isGuardian || !form.agb || !form.datenschutz || !form.gesundheit || !form.widerruf)
      return toast.error("Bitte alle Zustimmungen erteilen.");
    setBusy(true);
    try {
      const res = await fetch("/api/public/guardian-consent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          guardian_name: form.name.trim(),
          is_guardian: true,
          agb: true,
          datenschutz: true,
          gesundheit: true,
          widerruf: true,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        toast.error(json.error ?? "Bestätigung fehlgeschlagen");
        return;
      }
      setDone(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-background px-4 py-10">
      <div className="mx-auto max-w-xl rounded-3xl border border-border bg-card p-7 shadow-gold sm:p-9">
        <div className="mb-5 flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-gold">
            <Flame className="h-5 w-5 text-primary-foreground" strokeWidth={2.5} />
          </div>
          <div>
            <div className="font-display text-lg font-bold tracking-wider">BODYFUEL</div>
            <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
              Eltern-Einwilligung
            </div>
          </div>
        </div>

        {loading && <p className="text-sm text-muted-foreground">Lade…</p>}

        {!loading && !token && (
          <p className="text-sm text-destructive">Kein Token im Link gefunden.</p>
        )}

        {!loading && state && !state.valid && (
          <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-4 text-sm">
            <p className="font-semibold text-destructive">Link ungültig</p>
            <p className="mt-1 text-muted-foreground">
              {state.reason === "expired" && "Der Bestätigungs-Link ist abgelaufen."}
              {state.reason === "already_used" && "Dieser Link wurde bereits verwendet."}
              {state.reason === "not_found" && "Wir konnten den Link nicht zuordnen."}
              {!["expired", "already_used", "not_found"].includes(state.reason ?? "") &&
                "Bitte fordern Sie über den Account eine neue Bestätigung an."}
            </p>
          </div>
        )}

        {!loading && state?.valid && done && (
          <div className="rounded-xl border border-green-500/40 bg-green-500/5 p-4">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-green-600" />
              <p className="font-semibold">Zustimmung bestätigt.</p>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              Vielen Dank. Der Account von{" "}
              <strong>{state.minor_name ?? "Ihrem Kind"}</strong> ist jetzt
              freigeschaltet. Als erziehungsberechtigte Person sind Sie
              Vertragspartner für alle kostenpflichtigen Buchungen.
            </p>
          </div>
        )}

        {!loading && state?.valid && !done && (
          <form onSubmit={submit} className="space-y-5">
            <div className="rounded-xl border border-border bg-secondary/40 p-4 text-sm">
              <p>
                <strong>{state.minor_name ?? "Eine minderjährige Person"}</strong>{" "}
                möchte BODYFUEL nutzen. Da diese Person noch nicht volljährig
                ist, brauchen wir Ihre Zustimmung als erziehungsberechtigte
                Person.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="gn">Ihr vollständiger Name</Label>
              <Input
                id="gn"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
                autoComplete="name"
              />
            </div>

            <div className="space-y-2 rounded-xl border border-border p-4">
              {[
                { key: "isGuardian", label: "Ich bestätige, dass ich erziehungsberechtigt bin." },
                { key: "agb", label: "Ich stimme den AGB zu." },
                { key: "datenschutz", label: "Ich stimme der Datenschutzerklärung zu." },
                {
                  key: "gesundheit",
                  label:
                    "Ich willige in die Verarbeitung von Gesundheitsdaten (Gewicht, Maße, Trainings-/Ernährungsdaten) ein.",
                },
                {
                  key: "widerruf",
                  label:
                    "Ich habe die Widerrufsbelehrung zur Kenntnis genommen und akzeptiere, dass eine kostenpflichtige Buchung nur mit meiner Bestätigung möglich ist.",
                },
              ].map((c) => (
                <label
                  key={c.key}
                  className="flex items-start gap-3 rounded-lg p-2 hover:bg-secondary/40"
                >
                  <Checkbox
                    checked={(form as any)[c.key]}
                    onCheckedChange={(v) =>
                      setForm({ ...form, [c.key]: Boolean(v) } as any)
                    }
                  />
                  <span className="text-sm leading-snug">{c.label}</span>
                </label>
              ))}
            </div>

            <Button
              type="submit"
              disabled={busy}
              className="w-full bg-gradient-gold text-primary-foreground hover:opacity-90"
            >
              {busy ? "…" : "Zustimmung verbindlich bestätigen"}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
