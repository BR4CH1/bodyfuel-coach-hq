import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Check, Copy, MessageCircleMore, UserRoundSearch } from "lucide-react";
import { toast } from "sonner";

import { Fuely } from "@/components/bodyfuel/Fuely";
import { Button } from "@/components/ui/button";
import type { CoachFollowUpDraft, CoachFollowUpTone } from "@/features/coach-dashboard/types";
import { cn } from "@/lib/utils";

const TONE_STYLES: Record<CoachFollowUpTone, string> = {
  urgent: "border-red-500/30 bg-red-500/7",
  attention: "border-amber-500/30 bg-amber-500/7",
  info: "border-gold/25 bg-gold/5",
};

export function CoachFuelyFollowUps({ drafts }: { drafts: CoachFollowUpDraft[] }) {
  if (drafts.length === 0) return null;

  return (
    <section className="rounded-3xl border border-border bg-card p-5 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Fuely emotion="happy" animation="idle" size="md" className="shrink-0" />
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">
              Fuely Follow-ups
            </p>
            <h2 className="mt-1 font-display text-xl font-bold">
              Persönlich nachfassen – ohne Textarbeit
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Fuely bereitet die wichtigsten Nachrichten vor. Prüfen, kopieren, senden.
            </p>
          </div>
        </div>
        <div className="rounded-full border border-gold/25 bg-gold/8 px-3 py-1 text-xs font-semibold text-gold">
          {drafts.length} vorbereitet
        </div>
      </div>

      <div className="mt-5 grid gap-4 xl:grid-cols-3">
        {drafts.map((draft) => (
          <FollowUpCard key={draft.id} draft={draft} />
        ))}
      </div>
    </section>
  );
}

function FollowUpCard({ draft }: { draft: CoachFollowUpDraft }) {
  const [copied, setCopied] = useState(false);

  async function copyMessage() {
    try {
      await navigator.clipboard.writeText(draft.message);
      setCopied(true);
      toast.success(`Nachricht für ${draft.recipientName} kopiert`);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      toast.error("Nachricht konnte nicht kopiert werden.");
    }
  }

  return (
    <article
      className={cn("flex min-h-72 flex-col rounded-2xl border p-4", TONE_STYLES[draft.tone])}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            {categoryLabel(draft.category)}
          </div>
          <div className="mt-1 font-display text-lg font-bold">{draft.recipientName}</div>
          <div className="mt-1 text-xs text-muted-foreground">{draft.reason}</div>
        </div>
        <MessageCircleMore className="h-5 w-5 shrink-0 text-gold" />
      </div>

      <blockquote className="mt-4 flex-1 rounded-xl border border-border/70 bg-background/55 p-3 text-sm leading-relaxed text-foreground/90">
        “{draft.message}”
      </blockquote>

      <div className="mt-4 grid grid-cols-[1fr_auto] gap-2">
        <Button
          type="button"
          onClick={copyMessage}
          className="bg-gradient-gold text-primary-foreground"
        >
          {copied ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
          {copied ? "Kopiert" : "Nachricht kopieren"}
        </Button>
        <TargetLink draft={draft} />
      </div>
    </article>
  );
}

function TargetLink({ draft }: { draft: CoachFollowUpDraft }) {
  const className =
    "inline-flex h-10 w-10 items-center justify-center rounded-md border border-border bg-background/60 transition hover:border-gold/50 hover:text-gold";

  if (draft.target.kind === "customer") {
    return (
      <Link
        to="/coach/customers/$userId"
        params={{ userId: draft.target.userId }}
        className={className}
        aria-label={`${draft.recipientName} öffnen`}
        title="Kundenprofil öffnen"
      >
        <UserRoundSearch className="h-4 w-4" />
      </Link>
    );
  }

  return (
    <Link
      to="/coach/leads"
      className={className}
      aria-label="Anfragen öffnen"
      title="Anfragen öffnen"
    >
      <UserRoundSearch className="h-4 w-4" />
    </Link>
  );
}

function categoryLabel(category: CoachFollowUpDraft["category"]) {
  switch (category) {
    case "risk":
      return "Risikokunde";
    case "checkin":
      return "Check-in Erinnerung";
    case "inactive":
      return "Reaktivierung";
    case "plan":
      return "Planverlängerung";
    case "lead":
      return "Neue Anfrage";
  }
}
