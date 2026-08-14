import { describe, expect, it } from "vitest";

import { classifySuccessfulPayment } from "@/lib/payment-push.logic";

describe("classifySuccessfulPayment", () => {
  it("accepts a paid subscription invoice with a positive collected amount", () => {
    expect(
      classifySuccessfulPayment({
        id: "evt_invoice_paid",
        type: "invoice.payment_succeeded",
        data: { object: { id: "in_123", amount_paid: 1499 } },
      }),
    ).toEqual({
      eventKey: "stripe-payment:evt_invoice_paid",
      title: "💰 Neue Zahlung",
      body: "Eine neue Zahlung wurde erfolgreich bestätigt.",
      url: "/coach",
      tag: "payment-invoice-in_123",
    });
  });

  it("ignores zero-value invoices such as trial activation", () => {
    expect(
      classifySuccessfulPayment({
        id: "evt_trial",
        type: "invoice.payment_succeeded",
        data: { object: { id: "in_trial", amount_paid: 0 } },
      }),
    ).toBeNull();
  });

  it("accepts a completed paid one-time Checkout session", () => {
    expect(
      classifySuccessfulPayment({
        id: "evt_checkout_paid",
        type: "checkout.session.completed",
        data: {
          object: {
            id: "cs_123",
            mode: "payment",
            payment_status: "paid",
            amount_total: 2999,
          },
        },
      }),
    ).not.toBeNull();
  });

  it("accepts a later successful asynchronous one-time payment", () => {
    expect(
      classifySuccessfulPayment({
        id: "evt_checkout_async_paid",
        type: "checkout.session.async_payment_succeeded",
        data: {
          object: {
            id: "cs_async",
            mode: "payment",
            payment_status: "paid",
            amount_total: 2999,
          },
        },
      }),
    ).not.toBeNull();
  });

  it("ignores unpaid and subscription Checkout completion events", () => {
    expect(
      classifySuccessfulPayment({
        id: "evt_unpaid",
        type: "checkout.session.completed",
        data: {
          object: {
            id: "cs_unpaid",
            mode: "payment",
            payment_status: "unpaid",
            amount_total: 2999,
          },
        },
      }),
    ).toBeNull();

    expect(
      classifySuccessfulPayment({
        id: "evt_subscription_checkout",
        type: "checkout.session.completed",
        data: {
          object: {
            id: "cs_sub",
            mode: "subscription",
            payment_status: "paid",
            amount_total: 1499,
          },
        },
      }),
    ).toBeNull();
  });

  it("ignores unrelated events and malformed events without an event id", () => {
    expect(
      classifySuccessfulPayment({
        id: "evt_customer",
        type: "customer.subscription.updated",
        data: { object: { id: "sub_123" } },
      }),
    ).toBeNull();

    expect(
      classifySuccessfulPayment({
        type: "invoice.payment_succeeded",
        data: { object: { id: "in_123", amount_paid: 1499 } },
      }),
    ).toBeNull();
  });
});
