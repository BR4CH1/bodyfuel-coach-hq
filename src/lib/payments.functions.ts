import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  type StripeEnv,
  createStripeClient,
  getStripeErrorMessage,
} from "@/lib/stripe.server";

type CheckoutSessionResult = { clientSecret: string } | { error: string };
type PortalSessionResult = { url: string } | { error: string };

async function resolveOrCreateCustomer(
  stripe: ReturnType<typeof createStripeClient>,
  options: { email?: string; userId?: string },
): Promise<string> {
  if (options.userId && !/^[a-zA-Z0-9_-]+$/.test(options.userId)) {
    throw new Error("Invalid userId");
  }
  if (options.userId) {
    const found = await stripe.customers.search({
      query: `metadata['userId']:'${options.userId}'`,
      limit: 1,
    });
    if (found.data.length) return found.data[0].id;
  }
  if (options.email) {
    const existing = await stripe.customers.list({
      email: options.email,
      limit: 1,
    });
    if (existing.data.length) {
      const customer = existing.data[0];
      if (options.userId && customer.metadata?.userId !== options.userId) {
        await stripe.customers.update(customer.id, {
          metadata: { ...customer.metadata, userId: options.userId },
        });
      }
      return customer.id;
    }
  }
  const created = await stripe.customers.create({
    ...(options.email && { email: options.email }),
    ...(options.userId && { metadata: { userId: options.userId } }),
  });
  return created.id;
}

export const createSmartCheckoutSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: {
      priceId: string;
      returnUrl: string;
      environment: StripeEnv;
    }) => {
      if (!/^[a-zA-Z0-9_-]+$/.test(data.priceId))
        throw new Error("Invalid priceId");
      return data;
    },
  )
  .handler(
    async ({ data, context }): Promise<CheckoutSessionResult> => {
      try {
        const { supabase, userId } = context;

        // ──────────── Minderjährigenschutz ────────────
        // Minderjährige dürfen keine eigenständigen kostenpflichtigen Buchungen
        // tätigen. Vertragspartner muss eine erziehungsberechtigte Person sein,
        // die per Double-Opt-In bestätigt hat.
        const { data: prof } = await supabase
          .from("profiles")
          .select("is_minor, account_status, guardian_consent_at")
          .eq("id", userId)
          .maybeSingle();
        if (prof?.is_minor && !prof.guardian_consent_at) {
          return {
            error:
              "BodyFuel kann von Minderjährigen nur mit Zustimmung eines Erziehungsberechtigten genutzt werden. Bitte lass deine Eltern den Bestätigungslink per E-Mail bestätigen — danach kannst du den Kauf abschließen.",
          };
        }
        if (prof?.account_status === "pending_guardian_consent") {
          return {
            error:
              "Dein Account wartet auf die Bestätigung deiner Eltern. Sobald sie den Link aus der E-Mail bestätigt haben, kannst du den Kauf abschließen.",
          };
        }
        if (prof?.account_status === "blocked") {
          return { error: "Dein Account ist aktuell gesperrt." };
        }

        const { data: { user } } = await supabase.auth.getUser();
        const stripe = createStripeClient(data.environment);

        const prices = await stripe.prices.list({ lookup_keys: [data.priceId] });
        if (!prices.data.length) throw new Error("Preis nicht gefunden");
        const stripePrice = prices.data[0];
        const isRecurring = stripePrice.type === "recurring";

        const customerId = await resolveOrCreateCustomer(stripe, {
          email: user?.email ?? undefined,
          userId,
        });

        const session = await stripe.checkout.sessions.create({
          line_items: [{ price: stripePrice.id, quantity: 1 }],
          mode: isRecurring ? "subscription" : "payment",
          ui_mode: "embedded_page",
          return_url: data.returnUrl,
          customer: customerId,
          metadata: { userId },
          ...(isRecurring && {
            subscription_data: { metadata: { userId } },
          }),
        } as any);

        return { clientSecret: session.client_secret ?? "" };
      } catch (error) {
        return { error: getStripeErrorMessage(error) };
      }
    },
  );

export const createPortalSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: { returnUrl?: string; environment: StripeEnv }) => data,
  )
  .handler(async ({ data, context }): Promise<PortalSessionResult> => {
    try {
      const { supabase, userId } = context;
      const { data: sub } = await supabase
        .from("subscriptions")
        .select("stripe_customer_id")
        .eq("user_id", userId)
        .eq("environment", data.environment)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!sub?.stripe_customer_id) throw new Error("Kein Abo gefunden");

      const stripe = createStripeClient(data.environment);
      const portal = await stripe.billingPortal.sessions.create({
        customer: sub.stripe_customer_id as string,
        ...(data.returnUrl && { return_url: data.returnUrl }),
      });
      return { url: portal.url };
    } catch (error) {
      return { error: getStripeErrorMessage(error) };
    }
  });

export const getMySmartSubscription = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data } = await supabase
      .from("subscriptions")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    return data;
  });
