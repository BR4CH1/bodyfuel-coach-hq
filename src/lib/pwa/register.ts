// Guarded service-worker registration. Never registers in dev, iframes,
// or Lovable preview hosts. Supports a ?sw=off kill switch.

function isBlockedHost(): boolean {
  if (typeof window === "undefined") return true;
  const h = window.location.hostname;
  if (h.startsWith("id-preview--") || h.startsWith("preview--")) return true;
  if (h === "lovableproject.com" || h.endsWith(".lovableproject.com")) return true;
  if (h === "lovableproject-dev.com" || h.endsWith(".lovableproject-dev.com")) return true;
  if (h === "beta.lovable.dev" || h.endsWith(".beta.lovable.dev")) return true;
  return false;
}

async function unregisterMatching() {
  if (!("serviceWorker" in navigator)) return;
  try {
    const regs = await navigator.serviceWorker.getRegistrations();
    for (const r of regs) {
      const url = r.active?.scriptURL ?? r.installing?.scriptURL ?? r.waiting?.scriptURL ?? "";
      if (url.endsWith("/sw.js")) await r.unregister();
    }
  } catch {
    /* ignore */
  }
}

export function registerOfflineSW() {
  if (typeof window === "undefined") return;
  if (!("serviceWorker" in navigator)) return;

  const inIframe = window.self !== window.top;
  const killSwitch = new URL(window.location.href).searchParams.get("sw") === "off";
  const allowed = import.meta.env.PROD && !inIframe && !isBlockedHost() && !killSwitch;

  if (!allowed) {
    void unregisterMatching();
    return;
  }

  // Defer until idle so it doesn't compete with first paint. Always bypass the
  // browser's HTTP cache for worker updates: otherwise mobile mail browsers can
  // keep an old invite/password flow active after a deployment.
  const start = () => {
    navigator.serviceWorker
      .register("/sw.js", { scope: "/", updateViaCache: "none" })
      .then((registration) => registration.update())
      .catch(() => {
        /* ignore */
      });
  };
  if (document.readyState === "complete") start();
  else window.addEventListener("load", start, { once: true });
}
