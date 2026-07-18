/**
 * FuelyFAB — global floating Fuely mascot.
 *
 * Ersetzt die klassische Chat-Blase. Fuely ist überall unten rechts sichtbar,
 * mit Idle-Animation. Tap → kurzes Winken, dann Navigation zur Fuely-Chat-Seite.
 * Optional: Notification-Badge und flüchtige Speech-Bubble.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { Fuely, type FuelyAnimation, type FuelyEmotion } from "@/components/bodyfuel/Fuely";
import { useSession } from "@/lib/bodyfuel/session";
import { useEntitlements } from "@/lib/bodyfuel/entitlements";

/** Idle-Zyklus: welche Emotion+Animation zufällig rotieren. */
const IDLE_CYCLE: Array<{ emotion: FuelyEmotion; anim: FuelyAnimation; weight: number }> = [
  { emotion: "waving", anim: "idle", weight: 4 },
  { emotion: "happy", anim: "idle", weight: 4 },
  { emotion: "happy", anim: "float", weight: 2 },
  { emotion: "motivated", anim: "idle", weight: 2 },
  { emotion: "thinking", anim: "idle", weight: 2 },
  { emotion: "waving", anim: "wiggle", weight: 1 },
  { emotion: "celebrating", anim: "bounce", weight: 1 },
];
function pickIdle() {
  const total = IDLE_CYCLE.reduce((s, i) => s + i.weight, 0);
  let r = Math.random() * total;
  for (const item of IDLE_CYCLE) {
    r -= item.weight;
    if (r <= 0) return item;
  }
  return IDLE_CYCLE[0];
}


// Pfade, auf denen Fuely NICHT erscheinen soll (Auth, Legal, Marketing-Landing).
const HIDDEN_PREFIXES = [
  "/auth",
  "/login",
  "/tracker/login",
  "/tracker/signup",
  "/tracker",
  "/onboarding",
  "/impressum",
  "/datenschutz",
  "/trust",
  "/welcome",
  "/checkout",
  "/guardian-consent",
  "/join",
  "/unsubscribe",
  "/.lovable",
];

type FuelyToast = { id: number; message: string; href?: string };

let pushToastRef: ((t: Omit<FuelyToast, "id">) => void) | null = null;
let markUnreadRef: ((n: number) => void) | null = null;

/** Öffentliche API: von überall Fuely-Hinweis anzeigen. */
export function showFuelyHint(message: string, opts?: { href?: string }) {
  pushToastRef?.({ message, href: opts?.href });
}
/** Öffentliche API: Ungelesene Nachrichten setzen (0 = keine). */
export function setFuelyUnread(count: number) {
  markUnreadRef?.(count);
}

export function FuelyFAB() {
  const { supabaseUser, loading } = useSession();
  const ent = useEntitlements();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const [anim, setAnim] = useState<FuelyAnimation>("idle");
  const [emotion, setEmotion] = useState<FuelyEmotion>("waving");
  const [toast, setToast] = useState<FuelyToast | null>(null);
  const [unread, setUnread] = useState(0);
  const [sleeping, setSleeping] = useState(false);
  const lastActivityRef = useRef(Date.now());

  // Öffentliche API
  useEffect(() => {
    let counter = 0;
    pushToastRef = (t) => {
      counter += 1;
      const next = { ...t, id: counter };
      setToast(next);
      // Sanfter Haptik-Puls auf Mobile
      try {
        if (typeof navigator !== "undefined" && "vibrate" in navigator) {
          (navigator as any).vibrate?.([15, 40, 15]);
        }
      } catch {}
      window.setTimeout(() => {
        setToast((cur) => (cur?.id === next.id ? null : cur));
      }, 5000);
    };
    markUnreadRef = (n) => setUnread(Math.max(0, n | 0));
    return () => {
      pushToastRef = null;
      markUnreadRef = null;
    };
  }, []);

  // Idle-Zyklus: alle 12–20s zufällige Emotion/Animation wählen, solange kein Toast/Unread aktiv.
  useEffect(() => {
    let cancelled = false;
    function schedule() {
      const delay = 12000 + Math.random() * 8000;
      window.setTimeout(() => {
        if (cancelled) return;
        // Nichts überschreiben, wenn Nutzer gerade Fuely-Interaktion hat
        if (!toast && unread === 0) {
          const pick = pickIdle();
          setEmotion(pick.emotion);
          setAnim(pick.anim);
        }
        schedule();
      }, delay);
    }
    schedule();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sleep-Modus: nach 5 Min ohne Interaktion Fuely „dösen" lassen.
  useEffect(() => {
    const bump = () => {
      lastActivityRef.current = Date.now();
      if (sleeping) setSleeping(false);
    };
    const events = ["pointerdown", "keydown", "scroll", "touchstart"];
    events.forEach((e) => window.addEventListener(e, bump, { passive: true }));
    const iv = window.setInterval(() => {
      if (Date.now() - lastActivityRef.current > 5 * 60 * 1000) {
        setSleeping(true);
      }
    }, 30_000);
    return () => {
      events.forEach((e) => window.removeEventListener(e, bump));
      window.clearInterval(iv);
    };
  }, [sleeping]);

      "auth","login","dashboard","coach","coach-tools","admin","app","tracker",
      "smart","messages","achievements","ranking","measurements","profile",
      "progress","training","training-import","nutrition","community","checkout",
      "welcome","impressum","datenschutz","trust","unsubscribe","join","guardian-consent",
      "check-in","daily-checklist","mein-bodyfuel","onboarding","strength-check",
      "api",".lovable",".well-known",".mcp","bulls","email","lovable","mcp",
    ]);
    if (seg && !topLevelRoutes.has(seg)) return seg;
    // bulls hat eine eigene Route-Struktur — dort ebenfalls auf $orgSlug.fuely
    if (seg === "bulls") return "bulls";
    return ent.primaryOrgSlug;
  }, [pathname, ent.primaryOrgSlug]);

  const hidden =
    loading ||
    !supabaseUser ||
    !targetOrgSlug ||
    pathname.endsWith("/fuely") ||
    HIDDEN_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"));

  if (hidden) return null;

  const handleTap = () => {
    setAnim("wiggle");
    setUnread(0);
    window.setTimeout(() => {
      setAnim("idle");
      if (toast?.href) {
        navigate({ to: toast.href });
        setToast(null);
      } else if (targetOrgSlug) {
        navigate({ to: "/$orgSlug/fuely", params: { orgSlug: targetOrgSlug } });
      }
    }, 450);
  };


  const activeAnim: FuelyAnimation = unread > 0 && anim === "idle" ? "bounce" : anim;

  return (
    <div
      className="pointer-events-none fixed right-3 z-[60] flex flex-col items-end"
      style={{
        // Über der Bottom-Nav (~64px) + Safe Area
        bottom: "calc(env(safe-area-inset-bottom, 0px) + 76px)",
      }}
      aria-live="polite"
    >
      {toast && (
        <button
          type="button"
          onClick={() => {
            if (toast.href) navigate({ to: toast.href });
            setToast(null);
          }}
          className="pointer-events-auto mb-2 max-w-[240px] animate-fade-in rounded-2xl rounded-br-sm bg-white px-3 py-2 text-left text-xs font-medium text-neutral-900 shadow-lg"
        >
          {toast.message}
        </button>
      )}

      <button
        type="button"
        onClick={handleTap}
        aria-label="Fuely öffnen"
        className="pointer-events-auto relative grid h-16 w-16 place-items-center rounded-full transition active:scale-95"
      >
        <Fuely emotion="waving" animation={activeAnim} size="md" />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 grid h-5 min-w-5 place-items-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white shadow ring-2 ring-background">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>
    </div>
  );
}

export default FuelyFAB;
