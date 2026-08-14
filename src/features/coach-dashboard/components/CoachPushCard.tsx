import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Bell, BellOff, ChevronDown, Loader2, Send } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  getCoachPushConfig,
  removeMyCoachPushSubscription,
  saveMyCoachPushSubscription,
  sendMyCoachPushTest,
} from "@/lib/coach-push.functions";

type PushState = "loading" | "unsupported" | "blocked" | "inactive" | "active" | "unconfigured";

function urlBase64ToUint8Array(value: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

function browserSupportsPush() {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

export function CoachPushCard() {
  const getConfig = useServerFn(getCoachPushConfig);
  const saveSubscription = useServerFn(saveMyCoachPushSubscription);
  const removeSubscription = useServerFn(removeMyCoachPushSubscription);
  const sendTest = useServerFn(sendMyCoachPushTest);

  const [state, setState] = useState<PushState>("loading");
  const [busy, setBusy] = useState(false);
  const [publicKey, setPublicKey] = useState("");

  const statusText = useMemo(() => {
    if (state === "active") return "Aktiv auf diesem Gerät";
    if (state === "blocked") return "Im Browser blockiert";
    if (state === "unsupported") return "Auf diesem Gerät nicht verfügbar";
    if (state === "unconfigured") return "Server-Konfiguration fehlt";
    if (state === "inactive") return "Noch nicht aktiviert";
    return "Status wird geprüft…";
  }, [state]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const config = await getConfig();
        if (cancelled) return;
        setPublicKey(config.publicKey);
        if (!config.configured) {
          setState("unconfigured");
          return;
        }
        if (!browserSupportsPush()) {
          setState("unsupported");
          return;
        }
        if (Notification.permission === "denied") {
          setState("blocked");
          return;
        }
        const registration = await navigator.serviceWorker.ready;
        const existing = await registration.pushManager.getSubscription();
        setState(existing ? "active" : "inactive");
      } catch {
        if (!cancelled) setState("unsupported");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [getConfig]);

  const activate = async () => {
    if (!browserSupportsPush() || !publicKey) return;
    setBusy(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState(permission === "denied" ? "blocked" : "inactive");
        return;
      }

      const registration = await navigator.serviceWorker.ready;
      const subscription =
        (await registration.pushManager.getSubscription()) ??
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey),
        }));

      const json = subscription.toJSON();
      if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
        throw new Error("Browser hat keine vollständige Push-Subscription geliefert");
      }

      await saveSubscription({
        data: {
          endpoint: json.endpoint,
          keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
          userAgent: navigator.userAgent,
        },
      });
      setState("active");
      toast.success("Coach-Push aktiviert");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Push konnte nicht aktiviert werden");
    } finally {
      setBusy(false);
    }
  };

  const deactivate = async () => {
    if (!browserSupportsPush()) return;
    setBusy(true);
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await removeSubscription({ data: { endpoint: subscription.endpoint } });
        await subscription.unsubscribe();
      }
      setState("inactive");
      toast.success("Coach-Push deaktiviert");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Push konnte nicht deaktiviert werden");
    } finally {
      setBusy(false);
    }
  };

  const test = async () => {
    setBusy(true);
    try {
      await sendTest();
      toast.success("Test-Push wurde versendet");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Test-Push fehlgeschlagen");
    } finally {
      setBusy(false);
    }
  };

  return (
    <details className="group rounded-xl border border-border bg-card sm:col-span-2 lg:col-span-2">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2.5">
        <span className="flex min-w-0 items-center gap-2.5">
          <span className="rounded-lg bg-primary/10 p-2 text-primary">
            {state === "active" ? <Bell className="h-4 w-4" /> : <BellOff className="h-4 w-4" />}
          </span>
          <span className="min-w-0">
            <span className="block font-display text-sm font-bold">Coach Push</span>
            <span className="block truncate text-xs text-muted-foreground">{statusText}</span>
          </span>
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition group-open:rotate-180" />
      </summary>

      <div className="border-t border-border p-3">
        <p className="text-xs text-muted-foreground">
          Neue Kundennachrichten und Check-ins direkt auf diesem Gerät melden.
        </p>

        <div className="mt-3 flex flex-wrap gap-2">
          {state === "active" ? (
            <>
              <Button size="sm" variant="outline" onClick={test} disabled={busy}>
                {busy ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Send className="mr-2 h-4 w-4" />
                )}
                Test-Push
              </Button>
              <Button size="sm" variant="ghost" onClick={deactivate} disabled={busy}>
                Deaktivieren
              </Button>
            </>
          ) : (
            <Button
              size="sm"
              onClick={activate}
              disabled={
                busy ||
                state === "loading" ||
                state === "blocked" ||
                state === "unsupported" ||
                state === "unconfigured"
              }
            >
              {busy ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Bell className="mr-2 h-4 w-4" />
              )}
              Push aktivieren
            </Button>
          )}
        </div>
      </div>
    </details>
  );
}
