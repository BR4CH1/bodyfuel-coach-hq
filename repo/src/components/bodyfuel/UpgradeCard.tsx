import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ArrowRight, Sparkles, Crown, X } from "lucide-react";
import { trackUpgradeEvent, type UpgradeTier } from "@/lib/upgrade-events.functions";
import { useStripeCheckout } from "@/hooks/useStripeCheckout";
import { isPaymentsConfigured } from "@/lib/stripe";

type Props = {
  currentTier: UpgradeTier;
  source?: string;
  compact?: boolean;
};

const TARGETS: Record<UpgradeTier, UpgradeTier[]> = {
  free: ["smart", "coaching"],
  trial: ["smart", "coaching"],
  smart: ["coaching"],
  coaching: [],
};

const META: Record<UpgradeTier, { label: string; price: string; tagline: string; icon: any }> = {
  free: { label: "Free", price: "0 €", tagline: "Basis", icon: Sparkles },
  trial: { label: "Trial", price: "Test", tagline: "Test", icon: Sparkles },
  smart: {
    label: "BodyFuel Smart",
    price: "14,99 € / Monat",
    tagline: "Dein persönlicher Autopilot",
    icon: Sparkles,
  },
  coaching: {
    label: "BodyFuel Coaching",
    price: "69 € / Monat",
    tagline: "1:1-Betreuung mit Manu",
    icon: Crown,
  },
};

export function UpgradeCard({ currentTier, source = "dashboard", compact }: Props) {
  const trackFn = useServerFn(trackUpgradeEvent);
  const { openCheckout, closeCheckout, isOpen, checkoutElement } = useStripeCheckout();
  const targets = TARGETS[currentTier] ?? [];
  if (targets.length === 0) return null;

  const handleClick = (to: UpgradeTier) => {
    trackFn({
      data: { to_tier: to, from_tier: currentTier, event: "click", source },
    }).catch(() => {});
    if (to === "smart" && isPaymentsConfigured()) {
      trackFn({
        data: { to_tier: to, from_tier: currentTier, event: "started", source },
      }).catch(() => {});
      openCheckout({ priceId: "bodyfuel_smart_monthly" });
    }
  };

  const SmartButtonOrLink = (props: { children: React.ReactNode; className: string }) => {
    if (isPaymentsConfigured()) {
      return (
        <button onClick={() => handleClick("smart")} className={props.className}>
          {props.children}
        </button>
      );
    }
    return (
      <Link to="/smart" onClick={() => handleClick("smart")} className={props.className}>
        {props.children}
      </Link>
    );
  };

  if (compact) {
    return (
      <>
        <div className="flex flex-wrap gap-2">
          {targets.map((t) => {
            const m = META[t];
            const Icon = m.icon;
            const cls =
              "inline-flex items-center gap-2 rounded-lg bg-gradient-gold px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90";
            if (t === "smart") {
              return (
                <SmartButtonOrLink key={t} className={cls}>
                  <Icon className="h-4 w-4" />
                  Upgrade auf {m.label}
                  <ArrowRight className="h-3.5 w-3.5" />
                </SmartButtonOrLink>
              );
            }
            return (
              <Link
                key={t}
                to="/"
                hash="pakete"
                onClick={() => handleClick(t)}
                className={cls}
              >
                <Icon className="h-4 w-4" />
                Upgrade auf {m.label}
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            );
          })}
        </div>
        <CheckoutModal isOpen={isOpen} onClose={closeCheckout}>
          {checkoutElement}
        </CheckoutModal>
      </>
    );
  }

  return (
    <>
      <div className="rounded-2xl border border-gold/30 bg-gradient-to-br from-card to-secondary/40 p-6">
        <div className="text-xs uppercase tracking-[0.2em] text-gold">Upgrade</div>
        <h3 className="mt-1 font-display text-2xl font-bold">
          Hol dir mehr aus BodyFuel
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Du bist aktuell auf <span className="font-semibold text-foreground">{META[currentTier].label}</span>.
          Wähle deinen nächsten Schritt:
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {targets.map((t) => {
            const m = META[t];
            const Icon = m.icon;
            const cardCls =
              "group flex flex-col gap-2 rounded-xl border border-border bg-background/60 p-4 transition-colors hover:border-gold text-left";
            const content = (
              <>
                <div className="flex items-center gap-2">
                  <Icon className="h-4 w-4 text-gold" />
                  <div className="font-display text-lg font-semibold">{m.label}</div>
                </div>
                <div className="text-sm text-muted-foreground">{m.tagline}</div>
                <div className="mt-auto flex items-center justify-between pt-2">
                  <div className="font-semibold text-gold">{m.price}</div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1" />
                </div>
              </>
            );
            if (t === "smart") {
              return (
                <SmartButtonOrLink key={t} className={cardCls}>
                  {content}
                </SmartButtonOrLink>
              );
            }
            return (
              <Link
                key={t}
                to="/"
                hash="pakete"
                onClick={() => handleClick(t)}
                className={cardCls}
              >
                {content}
              </Link>
            );
          })}
        </div>
      </div>
      <CheckoutModal isOpen={isOpen} onClose={closeCheckout}>
        {checkoutElement}
      </CheckoutModal>
    </>
  );
}

function CheckoutModal({
  isOpen,
  onClose,
  children,
}: {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 p-4 overflow-y-auto">
      <div className="relative my-8 w-full max-w-xl rounded-2xl bg-background shadow-xl">
        <button
          onClick={onClose}
          aria-label="Schließen"
          className="absolute right-3 top-3 z-10 rounded-full bg-background p-2 shadow hover:bg-accent"
        >
          <X className="h-4 w-4" />
        </button>
        <div className="p-4 pt-12">{children}</div>
      </div>
    </div>
  );
}
