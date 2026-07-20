import { createClientOnlyFn } from "@tanstack/react-start";
import { useEffect, useState, type ComponentType } from "react";

interface Props {
  priceId: string;
  returnUrl?: string;
  promoCode?: string;
}

const loadClientCheckout = createClientOnlyFn(async () => {
  const module = await import("./StripeEmbeddedCheckout.client");
  return module.StripeEmbeddedCheckoutForm as ComponentType<Props>;
});

export function StripeEmbeddedCheckoutForm(props: Props) {
  const [Checkout, setCheckout] = useState<ComponentType<Props> | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;

    void loadClientCheckout()
      .then((component) => {
        if (active) setCheckout(() => component);
      })
      .catch((error: unknown) => {
        console.error("Stripe Checkout konnte nicht geladen werden", error);
        if (active) setFailed(true);
      });

    return () => {
      active = false;
    };
  }, []);

  if (failed) {
    return (
      <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
        Checkout konnte nicht geladen werden. Bitte lade die Seite neu.
      </div>
    );
  }

  if (!Checkout) {
    return <div className="min-h-24 w-full animate-pulse rounded-xl bg-muted" aria-hidden="true" />;
  }

  return <Checkout {...props} />;
}
