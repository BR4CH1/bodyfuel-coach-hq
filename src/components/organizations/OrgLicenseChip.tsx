// Read-only Lizenz-Statuschip für das Org-Cockpit.
// Zeigt Plan + Status. Keine Stripe-Integration.

import { CircleAlert, CircleCheck, CircleDollarSign, CircleDot, Clock } from "lucide-react";

type Props = {
  plan?: string | null;
  status?: string | null;
  startedAt?: string | null;
  expiresAt?: string | null;
  maxCustomers?: number | null;
  maxCoaches?: number | null;
};

const STATUS_META: Record<string, { label: string; tone: string; Icon: typeof CircleDot }> = {
  trial: { label: "Testphase", tone: "border-sky-400/50 bg-sky-400/10 text-sky-100", Icon: Clock },
  active: { label: "Aktiv", tone: "border-emerald-400/50 bg-emerald-400/10 text-emerald-100", Icon: CircleCheck },
  payment_due: { label: "Zahlung ausstehend", tone: "border-amber-400/50 bg-amber-400/10 text-amber-100", Icon: CircleDollarSign },
  suspended: { label: "Gesperrt", tone: "border-red-400/50 bg-red-400/10 text-red-100", Icon: CircleAlert },
  cancelled: { label: "Gekündigt", tone: "border-neutral-500/50 bg-neutral-500/10 text-neutral-200", Icon: CircleDot },
};

const PLAN_LABEL: Record<string, string> = {
  trial: "Trial",
  starter: "Starter",
  pro: "Pro",
  unlimited: "Unlimited",
  custom: "Custom",
};

function fmtDate(iso: string | null | undefined) {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleDateString("de-DE");
  } catch {
    return null;
  }
}

export function OrgLicenseChip({ plan, status, startedAt, expiresAt, maxCustomers, maxCoaches }: Props) {
  const s = (status ?? "trial").toLowerCase();
  const meta = STATUS_META[s] ?? STATUS_META.trial;
  const planLabel = PLAN_LABEL[(plan ?? "trial").toLowerCase()] ?? (plan ?? "Trial");
  const Icon = meta.Icon;
  const started = fmtDate(startedAt);
  const expires = fmtDate(expiresAt);

  return (
    <div
      className={`inline-flex flex-wrap items-center gap-2 rounded-xl border px-3 py-2 text-[11px] ${meta.tone}`}
      title="Lizenz-Status dieser Organisation"
    >
      <Icon className="h-3.5 w-3.5 shrink-0" />
      <span className="font-bold uppercase tracking-wider">{planLabel}</span>
      <span className="opacity-70">·</span>
      <span className="font-semibold">{meta.label}</span>
      {(maxCustomers != null || maxCoaches != null) && (
        <>
          <span className="opacity-70">·</span>
          <span className="opacity-80">
            {maxCustomers != null ? `${maxCustomers} Kunden` : "∞ Kunden"}
            {" / "}
            {maxCoaches != null ? `${maxCoaches} Coaches` : "∞ Coaches"}
          </span>
        </>
      )}
      {(started || expires) && (
        <span className="opacity-60">
          {started && <> · seit {started}</>}
          {expires && <> · bis {expires}</>}
        </span>
      )}
    </div>
  );
}
