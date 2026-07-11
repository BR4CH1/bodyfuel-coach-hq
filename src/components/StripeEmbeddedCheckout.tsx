import {
  EmbeddedCheckoutProvider,
  EmbeddedCheckout,
} from "@stripe/react-stripe-js";
import { getStripe, getStripeEnvironment } from "@/lib/stripe";
import { createSmartCheckoutSession } from "@/lib/payments.functions";

interface Props {
  priceId: string;
  returnUrl?: string;
  promoCode?: string;
}

export function StripeEmbeddedCheckoutForm({ priceId, returnUrl, promoCode }: Props) {
  const fetchClientSecret = async (): Promise<string> => {
    const result = await createSmartCheckoutSession({
      data: {
        priceId,
        returnUrl: returnUrl || `${window.location.origin}/checkout/return?session_id={CHECKOUT_SESSION_ID}`,
        environment: getStripeEnvironment(),
        ...(promoCode ? { promoCode } : {}),
      },
    });
    if ("error" in result) throw new Error(result.error);
    if (!result.clientSecret) throw new Error("Stripe lieferte keinen Client-Secret");
    return result.clientSecret;
  };

  return (
    <div id="checkout" className="w-full">
      <EmbeddedCheckoutProvider
        stripe={getStripe()}
        options={{ fetchClientSecret }}
      >
        <EmbeddedCheckout />
      </EmbeddedCheckoutProvider>
    </div>
  );
}
