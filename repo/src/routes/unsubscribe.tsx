import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, Check, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/unsubscribe")({
  head: () => ({ meta: [{ title: "Abmelden — BODYFUEL" }] }),
  component: UnsubscribePage,
});

type State =
  | { status: "loading" }
  | { status: "ready" }
  | { status: "already" }
  | { status: "invalid" }
  | { status: "submitting" }
  | { status: "success" }
  | { status: "error"; message: string };

function UnsubscribePage() {
  const [state, setState] = useState<State>({ status: "loading" });
  const [token, setToken] = useState<string>("");

  useEffect(() => {
    const url = new URL(window.location.href);
    const t = url.searchParams.get("token") ?? "";
    setToken(t);
    if (!t) {
      setState({ status: "invalid" });
      return;
    }
    (async () => {
      try {
        const res = await fetch(`/email/unsubscribe?token=${encodeURIComponent(t)}`);
        const data = await res.json();
        if (!res.ok || data?.error) {
          setState({ status: "invalid" });
          return;
        }
        if (data?.valid) setState({ status: "ready" });
        else setState({ status: "already" });
      } catch {
        setState({ status: "invalid" });
      }
    })();
  }, []);

  const confirm = async () => {
    setState({ status: "submitting" });
    try {
      const res = await fetch("/email/unsubscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const data = await res.json();
      if (res.ok && data?.success) setState({ status: "success" });
      else if (data?.reason === "already_unsubscribed") setState({ status: "already" });
      else setState({ status: "error", message: data?.error ?? "Konnte nicht abmelden." });
    } catch (e: any) {
      setState({ status: "error", message: e?.message ?? "Fehler" });
    }
  };

  return (
    <div className="min-h-screen bg-background px-6 py-16">
      <div className="mx-auto max-w-md rounded-3xl border border-border bg-card p-8">
        <h1 className="font-display text-2xl font-bold">E-Mail-Abmeldung</h1>
        <p className="mt-1 text-sm text-muted-foreground">BODYFUEL</p>

        <div className="mt-6">
          {state.status === "loading" && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Token wird geprüft…
            </div>
          )}

          {state.status === "ready" && (
            <>
              <p className="text-sm">
                Möchtest du dich von künftigen BODYFUEL-E-Mails abmelden?
              </p>
              <Button onClick={confirm} className="mt-4 w-full bg-gradient-gold text-primary-foreground">
                Ja, abmelden
              </Button>
            </>
          )}

          {state.status === "submitting" && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Wird verarbeitet…
            </div>
          )}

          {state.status === "success" && (
            <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-4 text-sm">
              <div className="flex items-center gap-2 font-semibold text-emerald-400">
                <Check className="h-4 w-4" /> Abgemeldet
              </div>
              <p className="mt-1 text-muted-foreground">
                Du erhältst keine weiteren E-Mails von BODYFUEL.
              </p>
            </div>
          )}

          {state.status === "already" && (
            <div className="rounded-xl border border-border bg-background/40 p-4 text-sm text-muted-foreground">
              Diese E-Mail-Adresse ist bereits abgemeldet.
            </div>
          )}

          {state.status === "invalid" && (
            <div className="flex items-start gap-2 rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm">
              <AlertTriangle className="h-4 w-4 shrink-0 text-destructive" />
              <span>Der Link ist ungültig oder abgelaufen.</span>
            </div>
          )}

          {state.status === "error" && (
            <div className="flex items-start gap-2 rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm">
              <AlertTriangle className="h-4 w-4 shrink-0 text-destructive" />
              <span>{state.message}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
