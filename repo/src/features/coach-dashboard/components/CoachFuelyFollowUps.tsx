import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  Check,
  Copy,
  Loader2,
  Mail,
  MessageCircleMore,
  MessagesSquare,
  UserRoundSearch,
} from "lucide-react";
import { toast } from "sonner";

import { Fuely } from "@/components/bodyfuel/Fuely";
import { Button } from "@/components/ui/button";
import { sendCoachFollowUp } from "@/features/coach-dashboard/lib/coach-followups.functions";
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
              Persönlich nachfassen – sofort versenden
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Nachricht prüfen und direkt als In-App-Nachricht oder E-Mail verschicken.
            </p>
          </div>
        </div>
        <div className="rounded-full border border-gold/25 bg-gold/8 px-3 py-1 text-xs font-semibold text-gold">
          {drafts.length} versandbereit
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
  const qc = useQueryClient();
  const sendFn = useServerFn(sendCoachFollowUp);

  const sendMutation = useMutation({
    mutationFn: (channel: "message" | "email" | "both") =>
      sendFn({
        data: {
          target: draft.target,
          channel,
          body: draft.message,
          subject: draft.emailSubject,
        },
      }),
    onSuccess: (_result, channel) => {
      const label =
        channel === "message"
          ? "Nachricht"
          : channel === "email"
            ? "E-Mail"
            : "Nachricht und E-Mail";
      toast.success(`${label} an ${draft.recipientName} versendet`);
      qc.invalidateQueries({ queryKey: ["coach-inbox"] });
      if (draft.target.kind === "customer") {
        qc.invalidateQueries({ queryKey: ["coach-thread", draft.target.userId] });
      }
    },
    onError: (error: Error) => toast.error(error.message || "Versand fehlgeschlagen"),
  });

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

  const isCustomer = draft.target.kind === "customer";

  return (
    <article
      className={cn("flex min-h-80 flex-col rounded-2xl border p-4", TONE_STYLES[draft.tone])}
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

      <div className="mt-4 grid grid-cols-2 gap-2">
        {isCustomer && (
          <Button
            type="button"
            onClick={() => sendMutation.mutate("message")}
            disabled={sendMutation.isPending}
            className="bg-gradient-gold text-primary-foreground"
          >
            {sendMutation.isPending && sendMutation.variables === "message" ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <MessagesSquare className="mr-2 h-4 w-4" />
            )}
            Nachricht
          </Button>
        )}
        <Button
          type="button"
          variant={isCustomer ? "outline" : "default"}
          onClick={() => sendMutation.mutate("email")}
          disabled={sendMutation.isPending}
          className={cn(!isCustomer && "col-span-2 bg-gradient-gold text-primary-foreground")}
        >
          {sendMutation.isPending && sendMutation.variables === "email" ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Mail className="mr-2 h-4 w-4" />
          )}
          Als Mail
        </Button>
        {isCustomer && (
          <Button
            type="button"
            variant="secondary"
            onClick={() => sendMutation.mutate("both")}
            disabled={sendMutation.isPending}
            className="col-span-2"
          >
            {sendMutation.isPending && sendMutation.variables === "both" ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Check className="mr-2 h-4 w-4" />
            )}
            Nachricht + Mail senden
          </Button>
        )}
        <Button type="button" variant="ghost" onClick={copyMessage} className="justify-start">
          {copied ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
          {copied ? "Kopiert" : "Kopieren"}
        </Button>
        <TargetLink draft={draft} />
      </div>
    </article>
  );
}

function TargetLink({ draft }: { draft: CoachFollowUpDraft }) {
  const className =
    "inline-flex h-10 items-center justify-center rounded-md border border-border bg-background/60 px-3 text-sm transition hover:border-gold/50 hover:text-gold";

  if (draft.target.kind === "customer") {
    return (
      <Link
        to="/coach/customers/$userId"
        params={{ userId: draft.target.userId }}
        className={className}
        aria-label={`${draft.recipientName} öffnen`}
        title="Kundenprofil öffnen"
      >
        <UserRoundSearch className="mr-2 h-4 w-4" />
        Profil
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
      <UserRoundSearch className="mr-2 h-4 w-4" />
      Anfrage
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
