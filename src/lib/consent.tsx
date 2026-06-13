import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type ConsentCategory = "necessary" | "analytics" | "marketing";
export type ConsentState = Record<ConsentCategory, boolean>;

const STORAGE_KEY = "bodyfuel.cookie-consent.v1";
const DEFAULT: ConsentState = { necessary: true, analytics: false, marketing: false };

type Ctx = {
  consent: ConsentState | null;
  decided: boolean;
  save: (c: ConsentState) => void;
  acceptAll: () => void;
  rejectAll: () => void;
  openSettings: () => void;
  isSettingsOpen: boolean;
  closeSettings: () => void;
};

const ConsentContext = createContext<Ctx | null>(null);

function load(): ConsentState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return { ...DEFAULT, ...parsed, necessary: true };
  } catch {
    return null;
  }
}

function applyConsent(c: ConsentState) {
  if (typeof window === "undefined") return;
  // Google Consent Mode v2 (no-op until gtag is loaded)
  const w = window as unknown as { dataLayer?: unknown[]; gtag?: (...args: unknown[]) => void };
  w.dataLayer = w.dataLayer || [];
  const gtag = w.gtag || ((...args: unknown[]) => { w.dataLayer!.push(args); });
  w.gtag = gtag;
  gtag("consent", "update", {
    ad_storage: c.marketing ? "granted" : "denied",
    ad_user_data: c.marketing ? "granted" : "denied",
    ad_personalization: c.marketing ? "granted" : "denied",
    analytics_storage: c.analytics ? "granted" : "denied",
  });
  window.dispatchEvent(new CustomEvent("bodyfuel:consent-change", { detail: c }));
}

export function ConsentProvider({ children }: { children: ReactNode }) {
  const [consent, setConsent] = useState<ConsentState | null>(null);
  const [decided, setDecided] = useState(false);
  const [isSettingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    const existing = load();
    if (existing) {
      setConsent(existing);
      setDecided(true);
      applyConsent(existing);
    } else {
      // Default denied for Consent Mode v2 before any choice
      applyConsent(DEFAULT);
    }
  }, []);

  const save = (c: ConsentState) => {
    const next = { ...c, necessary: true };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    setConsent(next);
    setDecided(true);
    setSettingsOpen(false);
    applyConsent(next);
  };

  const value: Ctx = {
    consent,
    decided,
    save,
    acceptAll: () => save({ necessary: true, analytics: true, marketing: true }),
    rejectAll: () => save({ necessary: true, analytics: false, marketing: false }),
    openSettings: () => setSettingsOpen(true),
    closeSettings: () => setSettingsOpen(false),
    isSettingsOpen,
  };

  return <ConsentContext.Provider value={value}>{children}</ConsentContext.Provider>;
}

export function useConsent() {
  const ctx = useContext(ConsentContext);
  if (!ctx) throw new Error("useConsent must be used within ConsentProvider");
  return ctx;
}
