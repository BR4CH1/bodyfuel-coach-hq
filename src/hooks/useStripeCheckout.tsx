import { useState, useCallback } from "react";
import { StripeEmbeddedCheckoutForm } from "@/components/StripeEmbeddedCheckout";

type Options = { priceId: string; returnUrl?: string };

export function useStripeCheckout() {
  const [isOpen, setIsOpen] = useState(false);
  const [options, setOptions] = useState<Options | null>(null);

  const openCheckout = useCallback((opts: Options) => {
    setOptions(opts);
    setIsOpen(true);
  }, []);

  const closeCheckout = useCallback(() => {
    setIsOpen(false);
    setOptions(null);
  }, []);

  const checkoutElement =
    isOpen && options ? <StripeEmbeddedCheckoutForm {...options} /> : null;

  return { openCheckout, closeCheckout, isOpen, checkoutElement };
}
