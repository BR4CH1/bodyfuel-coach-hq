import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Calendar, CreditCard, Sparkles, Crown } from "lucide-react";
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

type PlanOption = {
  key: "smart" | "coaching";
  name: string;
  short: string;
  price: number;
  priceId: string;
  icon: React.ReactNode;
  blurb: string;
  bullets: string[];
};

const PLAN_OPTIONS: PlanOption[] = [
  {
    key: "smart",
    name: "BodyFuel Smart",
    short: "Smart",
    price: 14.99,
    priceId: "bodyfuel_smart_monthly",
    icon: <Sparkles className="h-4 w-4" />,
    blurb: "Dein persönlicher Fitness-Autopilot.",
    bullets: [
      "Individueller Ernährungs- & Trainingsplan",
      "Automatische Anpassungen & Verlängerung",
      "Tracker, Tagespunkte & Community inklusive",
      "Selbstständig mit intelligenter Unterstützung",
    ],
  },
  {
    key: "coaching",
    name: "BodyFuel Coaching",
    short: "Coaching",
    price: 69,
    priceId: "bodyfuel_coaching_monthly",
    icon: <Crown className="h-4 w-4" />,
    blurb: "Persönliche 1:1 Betreuung durch deinen Coach.",
    bullets: [
      "Individueller Ernährungs- & Trainingsplan",
      "Persönliche Anpassungen statt Automatiken",
      "Direkter Chat-Support bei Fragen",
      "Wöchentliche Check-Ins & Feedback",
    ],
  },
];

export function MyPackagePanel() {
  const getFn = useServerFn(getMyPackage);
  const { openCheckout, checkoutElement } = useStripeCheckout();

  const { data } = useQuery({
    queryKey: ["my-package"],
    queryFn: () => getFn(),
    retry: false,
  });

  const pkg = data?.active ?? null;
  const daysLeft = pkg
    ? Math.max(0, Math.ceil((new Date(pkg.end_date).getTime() - Date.now()) / 86400000))
    : 0;
  const lastPayment = data?.payments?.[0];
  const hasAnyPayment = (data?.payments?.length ?? 0) > 0;
  const ctaPrefix = hasAnyPayment ? "Verlängern mit" : "Starten mit";

  const handleSelect = (priceId: string) => {
    openCheckout({
      priceId,
      returnUrl: `${window.location.origin}/dashboard?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
    });
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-6">
      {pkg && (
        <>
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

          <div className="mt-5 border-t border-border pt-5" />
        </>
      )}

      <div className="mb-3 text-xs uppercase tracking-[0.2em] text-muted-foreground">
        {hasAnyPayment ? "Paket wählen & verlängern" : "Paket wählen & starten"}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {PLAN_OPTIONS.map((opt) => {
          const isCurrent = pkg ? opt.key === pkg.package : false;
          return (
            <div
              key={opt.key}
              className={`flex flex-col rounded-xl border p-4 ${
                isCurrent ? "border-gold/60 bg-gold/5" : "border-border bg-background/40"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 font-display text-base font-bold">
                  {opt.icon}
                  {opt.name}
                </div>
                <div className="font-display text-lg text-gold">
                  {opt.price.toFixed(2).replace(".", ",")} €
                </div>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">{opt.blurb}</p>
              <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                {opt.bullets.map((b) => (
                  <li key={b}>• {b}</li>
                ))}
              </ul>
              <Button
                onClick={() => handleSelect(opt.priceId)}
                className="mt-4 bg-gradient-gold text-primary-foreground"
                size="sm"
              >
                {ctaPrefix} {opt.short}
              </Button>
              {isCurrent && (
                <div className="mt-2 text-center text-[10px] uppercase tracking-wider text-gold">
                  Dein aktuelles Paket
                </div>
              )}
            </div>
          );
        })}
      </div>
      <p className="mt-3 text-[11px] text-muted-foreground">
        Wechsel jederzeit möglich — die Laufzeit beginnt nach Zahlung neu für 1 Monat.
      </p>

      {(data?.payments?.length ?? 0) > 0 && (
        <details className="mt-4">
          <summary className="cursor-pointer text-sm font-semibold">Zahlungshistorie</summary>
          <ul className="mt-3 space-y-2 text-sm">
            {data!.payments.map((p) => (
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
