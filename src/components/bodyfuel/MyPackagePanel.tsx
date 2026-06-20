import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Calendar, CreditCard, RefreshCcw } from "lucide-react";
import { getMyPackage } from "@/lib/coaching.functions";
import { Button } from "@/components/ui/button";
import { useStripeCheckout } from "@/hooks/useStripeCheckout";

const PKG_LABEL: Record<string, string> = {
  smart: "BodyFuel Smart",
  coaching: "BodyFuel Coaching",
  // Legacy
  starter: "BodyFuel Coaching",
  premium: "BodyFuel Coaching",
};

// Stripe-Preise pro Paket (1 Monat). Müssen mit den im Lovable
// Payments-Setup angelegten lookup_keys übereinstimmen.
const STRIPE_PRICE_BY_PKG: Record<string, string> = {
  smart: "bodyfuel_smart_monthly",
};

export function MyPackagePanel() {
  const getFn = useServerFn(getMyPackage);
  const { openCheckout, checkoutElement } = useStripeCheckout();

  const { data } = useQuery({
    queryKey: ["my-package"],
    queryFn: () => getFn(),
    retry: false,
  });

  if (!data?.active) return null;
  const pkg = data.active;
  const daysLeft = Math.max(
    0,
    Math.ceil(
      (new Date(pkg.end_date).getTime() - Date.now()) / 86400000,
    ),
  );
  const lastPayment = data.payments[0];
  const hasAnyPayment = data.payments.length > 0;
  const renewLabel = hasAnyPayment ? "Coaching verlängern" : "Coaching starten";
  const stripePriceId = STRIPE_PRICE_BY_PKG[pkg.package];

  const handleRenew = () => {
    if (!stripePriceId) return;
    openCheckout({
      priceId: stripePriceId,
      returnUrl: `${window.location.origin}/dashboard?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
    });
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-xs uppercase tracking-[0.2em] text-gold">Dein Paket</div>
          <div className="mt-1 font-display text-2xl font-bold">
            {PKG_LABEL[pkg.package] ?? pkg.package}
          </div>
          <div className="mt-1 font-display text-xl text-gold">
            {Number(pkg.price_eur).toFixed(2)} € / Monat
          </div>
        </div>
        {stripePriceId && (
          <Button
            onClick={handleRenew}
            className="bg-gradient-gold text-primary-foreground"
          >
            <RefreshCcw className="mr-1 h-4 w-4" />
            {renewLabel}
          </Button>
        )}
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <Stat icon={<Calendar className="h-4 w-4" />} label="Start" value={pkg.start_date} />
        <Stat icon={<Calendar className="h-4 w-4" />} label="Ende" value={pkg.end_date} />
        <Stat
          icon={<CreditCard className="h-4 w-4" />}
          label="Status"
          value={lastPayment ? `${lastPayment.status}` : pkg.is_active ? "aktiv" : "inaktiv"}
        />
      </div>

      <p className="mt-4 text-xs text-muted-foreground">
        Restlaufzeit: {daysLeft} Tage. Zahlung sicher per Kreditkarte/SEPA über
        Stripe; nach Bestätigung wird deine Laufzeit um 1 Monat verlängert.
      </p>

      {data.payments.length > 0 && (
        <details className="mt-4">
          <summary className="cursor-pointer text-sm font-semibold">Zahlungshistorie</summary>
          <ul className="mt-3 space-y-2 text-sm">
            {data.payments.map((p) => (
              <li key={p.id} className="flex items-center justify-between border-t border-border pt-2">
                <span>{p.payment_date} · {Number(p.amount_eur).toFixed(2)} €</span>
                <span className="text-xs uppercase text-muted-foreground">{p.status}</span>
              </li>
            ))}
          </ul>
        </details>
      )}

      {checkoutElement}
    </div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-background/40 p-3">
      <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
        {icon} {label}
      </div>
      <div className="mt-1 font-display text-sm font-bold">{value}</div>
    </div>
  );
}
