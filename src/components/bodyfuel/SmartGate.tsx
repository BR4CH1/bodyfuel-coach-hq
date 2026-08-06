import type { ReactNode } from "react";
import { Lock, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useStripeCheckout } from "@/hooks/useStripeCheckout";
import { isPaymentsConfigured } from "@/lib/stripe";
import { Link } from "@tanstack/react-router";
import { useEntitlement } from "@/hooks/use-entitlement";
import { TRIAL_EXPIRED_MESSAGE } from "@/lib/entitlements.logic";

/** CTA-Button, der direkt den bestehenden Smart-Checkout öffnet. */
export function SmartCheckoutButton({
  children = "Smart buchen",
  className = "bg-gradient-gold font-bold text-primary-foreground",
}: {
  children?: ReactNode;
  className?: string;
}) {
  const { openCheckout, closeCheckout, isOpen, checkoutElement } = useStripeCheckout();

  if (!isPaymentsConfigured()) {
    return (
      <Button asChild className={className}>
        <Link to="/smart">{children}</Link>
      </Button>
    );
  }

  return (
    <>
      <Button
        className={className}
        onClick={() => openCheckout({ priceId: "bodyfuel_smart_monthly" })}
      >
        {children}
      </Button>
      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-4"
          onClick={closeCheckout}
        >
          <div className="w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
            {checkoutElement}
          </div>
        </div>
      )}
    </>
  );
}

/**
 * Sperrkarte für Smart-Funktionen (Free-Nutzer und abgelaufene Tests).
 * Zeigt nach Ablauf des Tests die verbindliche Upgrade-Aufforderung.
 */
export function SmartLockCard({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  const { isTrialExpired } = useEntitlement();

  return (
    <div className="rounded-2xl border border-dashed border-gold/40 bg-card/60 p-6 text-center">
      <div className="mx-auto mb-3 inline-flex h-10 w-10 items-center justify-center rounded-full bg-gold/15">
        <Lock className="h-5 w-5 text-gold" />
      </div>
      <h3 className="font-display text-lg font-bold">{title}</h3>
      <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
        {description ??
          (isTrialExpired
            ? TRIAL_EXPIRED_MESSAGE
            : "Diese Funktion gehört zu BodyFuel Smart.")}
      </p>
      <div className="mt-4 flex justify-center">
        <SmartCheckoutButton />
      </div>
    </div>
  );
}

/**
 * Gate-Wrapper: rendert die Kinder nur mit gültigem Smart-Entitlement
 * (bezahlt ODER laufender 7-Tage-Test), sonst die Sperrkarte.
 */
export function SmartGate({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  const { hasSmart, loading } = useEntitlement();
  if (loading) {
    return (
      <div className="flex items-center gap-2 rounded-2xl border border-border bg-card/60 p-6 text-sm text-muted-foreground">
        <Sparkles className="h-4 w-4 animate-pulse text-gold" /> Zugriff wird geprüft …
      </div>
    );
  }
  if (!hasSmart) return <SmartLockCard title={title} description={description} />;
  return <>{children}</>;
}
