import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ShieldAlert, ShieldCheck, MailCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AgeGate } from "@/components/bodyfuel/AgeGate";
import { getMyGuardianStatus, resendGuardianConsent } from "@/lib/guardian.functions";

type Status = {
  birthdate: string | null;
  is_minor: boolean | null;
  requires_guardian_consent: boolean | null;
  guardian_name: string | null;
  guardian_email: string | null;
  guardian_consent_at: string | null;
  guardian_consent_docs: any | null;
  account_status: string | null;
} | null;

export function MinorProtectionSection() {
  const fetchStatus = useServerFn(getMyGuardianStatus);
  const resend = useServerFn(resendGuardianConsent);
  const [status, setStatus] = useState<Status>(null);
  const [loading, setLoading] = useState(true);
  const [busyResend, setBusyResend] = useState(false);

  const reload = async () => {
    try {
      const s = (await fetchStatus()) as Status;
      setStatus(s);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    reload();
  }, []);

  if (loading) return null;

  return (
    <section className="rounded-2xl border border-border bg-card p-6">
      <div className="flex items-center gap-2">
        <ShieldCheck className="h-5 w-5 text-gold" />
        <h2 className="font-display text-lg font-bold">Minderjährigenschutz</h2>
      </div>

      {/* Noch keine Altersangabe → AgeGate anzeigen */}
      {!status?.birthdate && (
        <div className="mt-4">
          <p className="text-sm text-muted-foreground">
            Bitte bestätige dein Alter. Für Minderjährige holen wir
            anschließend die Zustimmung eines Erziehungsberechtigten ein.
          </p>
          <div className="mt-3">
            <AgeGate
              onAdult={reload}
              onMinorRequested={reload}
            />
          </div>
        </div>
      )}

      {/* Volljährig */}
      {status?.birthdate && !status.is_minor && (
        <p className="mt-3 text-sm text-muted-foreground">
          Du bist als volljährig erfasst — keine zusätzliche Eltern-Zustimmung
          erforderlich.
        </p>
      )}

      {/* Minderjährig — Zustimmung offen */}
      {status?.is_minor && !status.guardian_consent_at && (
        <div className="mt-3 space-y-3">
          <div className="rounded-xl border border-gold/40 bg-gold/5 p-4 text-sm">
            <div className="flex items-center gap-2 font-semibold">
              <ShieldAlert className="h-4 w-4 text-gold" /> Eltern-Zustimmung
              ausstehend
            </div>
            <p className="mt-1 text-muted-foreground">
              BodyFuel kann von Minderjährigen nur mit Zustimmung eines
              Erziehungsberechtigten genutzt werden. Bestätigungs-Mail an{" "}
              <strong>{status.guardian_email}</strong>.
            </p>
          </div>
          <Button
            variant="outline"
            disabled={busyResend}
            onClick={async () => {
              setBusyResend(true);
              try {
                const r: any = await resend();
                if (r?.ok) toast.success("Bestätigungs-Mail erneut versendet.");
                else toast.error(r?.error ?? "Konnte Mail nicht senden.");
              } finally {
                setBusyResend(false);
              }
            }}
          >
            <MailCheck className="mr-2 h-4 w-4" /> Bestätigungs-Mail erneut
            senden
          </Button>
        </div>
      )}

      {/* Minderjährig — Zustimmung erteilt */}
      {status?.is_minor && status.guardian_consent_at && (
        <div className="mt-3 space-y-2 text-sm">
          <div className="rounded-xl border border-green-500/40 bg-green-500/5 p-4">
            <div className="flex items-center gap-2 font-semibold text-green-700">
              <ShieldCheck className="h-4 w-4" /> Zustimmung bestätigt
            </div>
            <p className="mt-1 text-muted-foreground">
              Vertragspartner ist <strong>{status.guardian_name}</strong> (
              {status.guardian_email}). Bestätigt am{" "}
              {new Date(status.guardian_consent_at).toLocaleDateString("de-DE")}
              .
            </p>
          </div>
          <div className="text-xs text-muted-foreground">
            Bestätigte Dokumente: AGB · Datenschutz · Gesundheitsdaten ·
            Widerrufsbelehrung
          </div>
        </div>
      )}
    </section>
  );
}
