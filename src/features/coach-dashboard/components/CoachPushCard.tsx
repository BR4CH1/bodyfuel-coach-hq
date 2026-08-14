import { useCallback, useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Bell, BellOff, ChevronDown, Loader2, RefreshCw, Send } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  getCoachPushConfig,
  removeMyCoachPushSubscription,
  saveMyCoachPushSubscription,
  sendMyCoachPushTest,
} from "@/lib/coach-push.functions";

type PushState =
  | "loading"
  | "unsupported"
  | "blocked"
  | "inactive"
  | "active"
  | "unconfigured"
  | "error";

const STATUS_TIMEOUT_MS = 5000;

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

function withTimeout<T>(promise: Promise<T>, message: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timeoutId = window.setTimeout(() => reject(new Error(message)), STATUS_TIMEOUT_MS);
    promise.then(
      (value) => {
        window.clearTimeout(timeoutId);
        resolve(value);
      },
      (error) => {
        window.clearTimeout(timeoutId);
        reject(error);
      },
    );
  });
}

async function getExistingPushSubscription(): Promise<PushSubscription | null> {
  const registration = await withTimeout(
    navigator.serviceWorker.getRegistration(),
    "Service Worker antwortet nicht",
  );
  if (!registration) return null;
  return withTimeout(registration.pushManager.getSubscription(), "Push-Status antwortet nicht");
}

async function ensurePushRegistration(): Promise<ServiceWorkerRegistration> {
  const existing = await withTimeout(
    navigator.serviceWorker.getRegistration(),
    "Service Worker antwortet nicht",
  );
  if (existing) return existing;

  await withTimeout(navigator.serviceWorker.register("/sw.js"), "Service Worker konnte nicht gestartet werden");
  return withTimeout(navigator.serviceWorker.ready, "Service Worker wurde nicht rechtzeitig bereit");
}

export function CoachPushCard() {
  const getConfig = useServerFn(getCoachPushConfig);
  const saveSubscription = useServerFn(saveMyCoachPushSubscription);
  const removeSubscription = useServerFn(removeMyCoachPushSubscription);
  const sendTest = useServerFn(sendMyCoachPushTest);

  const [state, setState] = useState<PushState>("loading");
  const [busy, setBusy] = useState(false);

  const statusText = useMemo(() => {
    if (state === "active") return "Aktiv auf diesem Gerät";
    if (state === "blocked") return "Im Browser blockiert";
    if (state === "unsupported") return "Auf diesem Gerät nicht verfügbar";
    if (state === "unconfigured") return "Server-Konfiguration fehlt";
    if (state === "inactive") return "Noch nicht aktiviert";
    if (state === "error") return "Status konnte nicht geprüft werden";
    return "Status wird geprüft…";
  }, [state]);

  const checkStatus = useCallback(async () => {
    setState("loading");
    if (!browserSupportsPush()) {
      setState("unsupported");
      return;
    }
    if (Notification.permission === "denied") {
      setState("blocked");
      return;
    }

    try {
      const existing = await getExistingPushSubscription();
      setState(existing ? "active" : "inactive");
    } catch {
      setState("error");
    }
  }, []);

  useEffect(() => {
    void checkStatus();
  }, [checkStatus]);

  const activate = async () => {
    if (!browserSupportsPush()) {
      setState("unsupported");
      return;
    }

    setBusy(true);
    try {
      const config = await withTimeout(getConfig(), "Push-Konfiguration antwortet nicht");
      if (!config.configured) {
        setState("unconfigured");
        toast.error("Push ist serverseitig noch nicht konfiguriert");
        return;
      }

      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState(permission === "denied" ? "blocked" : "inactive");
        return;
      }

      const registration = await ensurePushRegistration();
      const subscription =
        (await withTimeout(registration.pushManager.getSubscription(), "Push-Status antwortet nicht")) ??
        (await withTimeout(
          registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(config.publicKey),
          }),
          "Push-Aktivierung dauert zu lange",
        ));

      const json = subscription.toJSON();
      if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
        throw new Error("Browser hat keine vollständige Push-Subscription geliefert");
      }

      await withTimeout(
        saveSubscription({
          data: {
            endpoint: json.endpoint,
            keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
            userAgent: navigator.userAgent,
          },
        }),
        "Push-Subscription konnte nicht gespeichert werden",
      );
      setState("active");
      toast.success("Coach-Push aktiviert");
    } catch (error) {
      setState("error");
      toast.error(error instanceof Error ? error.message : "Push konnte nicht aktiviert werden");
    } finally {
      setBusy(false);
    }
  };

  const deactivate = async () => {
    if (!browserSupportsPush()) return;
    setBusy(true);
    try {
      const subscription = await getExistingPushSubscription();
      if (subscription) {
        await withTimeout(
          removeSubscription({ data: { endpoint: subscription.endpoint } }),
          "Push-Subscription konnte nicht entfernt werden",
        );
        await withTimeout(subscription.unsubscribe(), "Push konnte nicht deaktiviert werden");
      }
      setState("inactive");
      toast.success("Coach-Push deaktiviert");
    } catch (error) {
      setState("error");
      toast.error(error instanceof Error ? error.message : "Push konnte nicht deaktiviert werden");
    } finally {
      setBusy(false);
    }
  };

  const test = async () => {
    setBusy(true);
    try {
      await withTimeout(sendTest(), "Test-Push antwortet nicht");
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
          Nachrichten, Check-ins, Anfragen und neue Registrierungen direkt auf diesem Gerät melden.
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
          ) : state === "error" ? (
            <Button size="sm" variant="outline" onClick={() => void checkStatus()} disabled={busy}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Erneut prüfen
            </Button>
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
