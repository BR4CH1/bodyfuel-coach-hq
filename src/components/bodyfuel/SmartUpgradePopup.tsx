import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Sparkles, X, ArrowRight, Check } from "lucide-react";
import { useSession } from "@/lib/bodyfuel/session";
import { getMyPackage } from "@/lib/coaching.functions";
import { useStripeCheckout } from "@/hooks/useStripeCheckout";
import { isPaymentsConfigured } from "@/lib/stripe";
import { Link } from "@tanstack/react-router";
import { trackUpgradeEvent } from "@/lib/upgrade-events.functions";

const STORAGE_KEY = "bodyfuel.smartUpgradePopup.dismissed";

// Vorerst nur für den Test-Account "Brachi Schrader" anzeigen.
// Sobald freigegeben, einfach `null` setzen oder Liste erweitern.
const ALLOWED_NAMES = ["brachi schrader"];

export function SmartUpgradePopup() {
  const { profile, tier, loading } = useSession();
  const fn = useServerFn(getMyPackage);
  const { data, isLoading } = useQuery({
    queryKey: ["my-package"],
    queryFn: () => fn(),
    retry: false,
    enabled: !!profile,
  });
  const trackFn = useServerFn(trackUpgradeEvent);
  const { openCheckout, closeCheckout, isOpen, checkoutElement } = useStripeCheckout();
  const [open, setOpen] = useState(false);

  const pkg = (data?.active?.package as string | undefined) ?? null;
  const isFree = !loading && !isLoading && !pkg && (tier === "free" || tier === "client" || tier === null);

  const name = (profile?.display_name ?? "").toLowerCase().trim();
  const allowed = ALLOWED_NAMES.includes(name);

  useEffect(() => {
    if (!allowed || !isFree) return;
    try {
      if (localStorage.getItem(STORAGE_KEY)) return;
    } catch {}
    const t = setTimeout(() => setOpen(true), 800);
    return () => clearTimeout(t);
  }, [allowed, isFree]);

  const dismiss = () => {
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {}
    setOpen(false);
  };

  const startSmart = () => {
    trackFn({
      data: { to_tier: "smart", from_tier: "free", event: "click", source: "popup" },
    }).catch(() => {});
    if (isPaymentsConfigured()) {
      trackFn({
        data: { to_tier: "smart", from_tier: "free", event: "started", source: "popup" },
      }).catch(() => {});
      openCheckout({ priceId: "bodyfuel_smart_monthly" });
    }
  };

  if (!open && !isOpen) return null;

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 sm:items-center overflow-y-auto"
          onClick={dismiss}
        >
          <div
            className="relative my-4 w-full max-w-md rounded-2xl border border-gold/30 bg-gradient-to-br from-card to-secondary/40 p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={dismiss}
              aria-label="Schließen"
              className="absolute right-3 top-3 rounded-full bg-background/60 p-1.5 hover:bg-accent"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-gold">
              <Sparkles className="h-3.5 w-3.5" />
              Neu für dich
            </div>
            <h2 className="mt-2 font-display text-2xl font-bold">
              Upgrade auf BodyFuel Smart
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Dein persönlicher Autopilot – Ernährung & Training automatisch geplant.
            </p>

            <ul className="mt-4 space-y-2 text-sm">
              {[
                "Persönlicher Ernährungsplan",
                "Rezepte auf dich abgestimmt",
                "Automatische Einkaufsliste",
                "Mahlzeiten-Tausch jederzeit",
              ].map((f) => (
                <li key={f} className="flex items-start gap-2">
                  <Check className="mt-0.5 h-4 w-4 text-gold" />
                  <span>{f}</span>
                </li>
              ))}
            </ul>

            <div className="mt-5 flex items-baseline gap-2">
              <span className="font-display text-2xl font-bold text-gold">14,99 €</span>
              <span className="text-sm text-muted-foreground">/ Monat · jederzeit kündbar</span>
            </div>

            <div className="mt-5 flex flex-col gap-2">
              {isPaymentsConfigured() ? (
                <button
                  onClick={startSmart}
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-gradient-gold px-4 py-3 text-sm font-semibold text-primary-foreground hover:opacity-90"
                >
                  <Sparkles className="h-4 w-4" />
                  Jetzt Smart starten
                  <ArrowRight className="h-4 w-4" />
                </button>
              ) : (
                <Link
                  to="/smart"
                  onClick={startSmart}
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-gradient-gold px-4 py-3 text-sm font-semibold text-primary-foreground hover:opacity-90"
                >
                  <Sparkles className="h-4 w-4" />
                  Jetzt Smart starten
                  <ArrowRight className="h-4 w-4" />
                </Link>
              )}
              <button
                type="button"
                onClick={dismiss}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Später erinnern
              </button>
            </div>
          </div>
        </div>
      )}

      {isOpen && (
        <div className="fixed inset-0 z-[60] flex items-start justify-center bg-black/60 p-4 overflow-y-auto">
          <div className="relative my-8 w-full max-w-xl rounded-2xl bg-background shadow-xl">
            <button
              onClick={closeCheckout}
              aria-label="Schließen"
              className="absolute right-3 top-3 z-10 rounded-full bg-background p-2 shadow hover:bg-accent"
            >
              <X className="h-4 w-4" />
            </button>
            <div className="p-4 pt-12">{checkoutElement}</div>
          </div>
        </div>
      )}
    </>
  );
}
