export type PaymentPushIntent = {
  eventKey: string;
  title: string;
  body: string;
  url: string;
  tag: string;
};

type StripeEventLike = {
  id?: string;
  type: string;
  data?: {
    object?: Record<string, unknown>;
  };
};

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function positiveAmount(value: unknown): boolean {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

/**
 * Returns a coach notification only for Stripe events that prove money was
 * actually collected. Environment filtering stays in the webhook handler so
 * sandbox events can never reach this classifier in production delivery.
 */
export function classifySuccessfulPayment(event: StripeEventLike): PaymentPushIntent | null {
  const object = event.data?.object ?? {};
  const eventId = stringValue(event.id);
  if (!eventId) return null;

  if (event.type === "invoice.payment_succeeded") {
    const invoiceId = stringValue(object.id);
    if (!invoiceId || !positiveAmount(object.amount_paid)) return null;

    return {
      eventKey: `stripe-payment:${eventId}`,
      title: "💰 Neue Zahlung",
      body: "Eine neue Zahlung wurde erfolgreich bestätigt.",
      url: "/coach",
      tag: `payment-invoice-${invoiceId}`,
    };
  }

  if (
    event.type === "checkout.session.completed" ||
    event.type === "checkout.session.async_payment_succeeded"
  ) {
    const sessionId = stringValue(object.id);
    if (
      !sessionId ||
      object.mode !== "payment" ||
      object.payment_status !== "paid" ||
      !positiveAmount(object.amount_total)
    ) {
      return null;
    }

    return {
      eventKey: `stripe-payment:${eventId}`,
      title: "💰 Neue Zahlung",
      body: "Eine neue Zahlung wurde erfolgreich bestätigt.",
      url: "/coach",
      tag: `payment-checkout-${sessionId}`,
    };
  }

  return null;
}
