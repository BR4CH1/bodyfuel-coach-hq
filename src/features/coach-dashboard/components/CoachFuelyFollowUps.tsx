import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  Check,
  ChevronDown,
  ChevronUp,
  Clock3,
  Copy,
  Loader2,
  Mail,
  MessageCircleMore,
  MessagesSquare,
  UserRoundSearch,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { Fuely } from "@/components/bodyfuel/Fuely";
import { Button } from "@/components/ui/button";
import { sendCoachFollowUp } from "@/features/coach-dashboard/lib/coach-followups.functions";
import type {
  CoachFollowUpCategory,
  CoachFollowUpDraft,
  CoachFollowUpTone,
} from "@/features/coach-dashboard/types";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "bodyfuel:coach-followup-state:v1";

type StoredAction = {
  status: "snoozed" | "completed" | "dismissed";
  until?: string;
  reason?: string;
  completedAt?: string;
  deliveryChannel?: "message" | "email" | "both" | "manual";
};

type StateMap = Record<string, StoredAction>;

const TONE_STYLES: Record<CoachFollowUpTone, string> = {
  urgent: "border-red-500/30 bg-red-500/7",
  attention: "border-amber-500/30 bg-amber-500/7",
  info: "border-gold/25 bg-gold/5",
};

export function CoachFuelyFollowUps({
  drafts,
  selectedCategory,
  onClearFilter,
}: {
  drafts: CoachFollowUpDraft[];
  selectedCategory?: CoachFollowUpCategory | null;
  onClearFilter?: () => void;
}) {
  const [state, setState] = useState<StateMap>({});

  useEffect(() => {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}") as StateMap;
      setState(parsed && typeof parsed === "object" ? parsed : {});
    } catch {
      setState({});
    }
  }, []);

  function updateState(id: string, action: StoredAction) {
    setState((current) => {
      const next = { ...current, [id]: action };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }

  const visibleDrafts = useMemo(() => {
    const now = Date.now();
    return drafts.filter((draft) => {
      const action = state[draft.sourceSignalId];
      if (!action) return !selectedCategory || draft.category === selectedCategory;
      if (action.status === "completed" || action.status === "dismissed") return false;
      if (action.status === "snoozed" && action.until && new Date(action.until).getTime() > now)
        return false;
      return !selectedCategory || draft.category === selectedCategory;
    });
  }, [drafts, selectedCategory, state]);

  if (drafts.length === 0) return null;

  return (
    <section
      id="fuely-followups"
      className="scroll-mt-24 rounded-3xl border border-border bg-card p-5 sm:p-6"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Fuely emotion="happy" animation="idle" size="md" className="shrink-0" />
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">
              Fuely Follow-ups
            </p>
            <h2 className="mt-1 font-display text-xl font-bold">
              Persönlich nachfassen – kompakt priorisiert
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Name und Grund sofort sehen. Nachricht nur bei Bedarf ausklappen.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {selectedCategory && (
            <button
              type="button"
              onClick={onClearFilter}
              className="inline-flex items-center rounded-full border border-border px-3 py-1 text-xs font-semibold"
            >
              Filter: {categoryLabel(selectedCategory)} <X className="ml-1.5 h-3.5 w-3.5" />
            </button>
          )}
          <div className="rounded-full border border-gold/25 bg-gold/8 px-3 py-1 text-xs font-semibold text-gold">
            {visibleDrafts.length} offen
          </div>
        </div>
      </div>

      {visibleDrafts.length === 0 ? (
        <div className="mt-5 rounded-2xl border border-border bg-background/50 p-5 text-sm text-muted-foreground">
          Für diesen Filter sind aktuell keine offenen Follow-ups vorhanden.
        </div>
      ) : (
        <div className="mt-5 grid gap-3 xl:grid-cols-2">
          {visibleDrafts.map((draft) => (
            <FollowUpCard
              key={draft.id}
              draft={draft}
              onComplete={(channel) =>
                updateState(draft.sourceSignalId, {
                  status: "completed",
                  completedAt: new Date().toISOString(),
                  deliveryChannel: channel,
                })
              }
              onSnooze={() =>
                updateState(draft.sourceSignalId, {
                  status: "snoozed",
                  until: tomorrowAtEight().toISOString(),
                })
              }
              onDismiss={(reason) =>
                updateState(draft.sourceSignalId, { status: "dismissed", reason })
              }
            />
          ))}
        </div>
      )}
    </section>
  );
}

function tomorrowAtEight() {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  date.setHours(8, 0, 0, 0);
  return date;
}

function FollowUpCard({
  draft,
  onComplete,
  onSnooze,
  onDismiss,
}: {
  draft: CoachFollowUpDraft;
  onComplete: (channel: "message" | "email" | "both" | "manual") => void;
  onSnooze: () => void;
  onDismiss: (reason: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const qc = useQueryClient();
  const sendFn = useServerFn(sendCoachFollowUp);

  const sendMutation = useMutation({
    mutationFn: (channel: "message" | "email" | "both") =>
      sendFn({
        data: { target: draft.target, channel, body: draft.message, subject: draft.emailSubject },
      }),
    onSuccess: (_result, channel) => {
      const label =
        channel === "message"
          ? "Nachricht"
          : channel === "email"
            ? "E-Mail"
            : "Nachricht und E-Mail";
      toast.success(`${label} an ${draft.recipientName} versendet`);
      onComplete(channel);
      qc.invalidateQueries({ queryKey: ["coach-inbox"] });
      if (draft.target.kind === "customer")
        qc.invalidateQueries({ queryKey: ["coach-thread", draft.target.userId] });
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

  function dismiss() {
    const choices =
      "Kein Follow-up nötig | Bereits persönlich geklärt | Falsches Signal | Kunde pausiert | Sonstiges";
    const reason = window.prompt(
      `Grund fürs Ausblenden:\n${choices}`,
      "Bereits persönlich geklärt",
    );
    if (!reason?.trim()) return;
    onDismiss(reason.trim());
    toast.success("Follow-up ausgeblendet");
  }

  const isCustomer = draft.target.kind === "customer";

  return (
    <article className={cn("rounded-2xl border p-4", TONE_STYLES[draft.tone])}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            {categoryLabel(draft.category)}
          </div>
          <div className="mt-1 truncate font-display text-lg font-bold">{draft.recipientName}</div>
          <div className="mt-1 text-xs leading-relaxed text-muted-foreground">{draft.reason}</div>
        </div>
        <MessageCircleMore className="h-5 w-5 shrink-0 text-gold" />
      </div>

      <button
        type="button"
        onClick={() => setExpanded((value) => !value)}
        className="mt-4 flex w-full items-center justify-between rounded-xl border border-border/70 bg-background/55 px-3 py-3 text-left text-sm font-semibold"
      >
        {expanded ? "Nachricht ausblenden" : "Nachricht anzeigen"}
        {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>

      {expanded && (
        <blockquote className="mt-3 rounded-xl border border-border/70 bg-background/55 p-3 text-sm leading-relaxed text-foreground/90">
          “{draft.message}”
        </blockquote>
      )}

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
            )}{" "}
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
          )}{" "}
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
            )}{" "}
            Nachricht + Mail senden
          </Button>
        )}
        <Button type="button" variant="ghost" onClick={copyMessage} className="justify-start">
          {copied ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
          {copied ? "Kopiert" : "Kopieren"}
        </Button>
        <TargetLink draft={draft} />
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            onSnooze();
            toast.success("Morgen um 08:00 Uhr wieder sichtbar");
          }}
          className="justify-start"
        >
          <Clock3 className="mr-2 h-4 w-4" /> Morgen erinnern
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={dismiss}
          className="justify-start text-muted-foreground"
        >
          <X className="mr-2 h-4 w-4" /> Ausblenden
        </Button>
      </div>
    </article>
  );
}

function TargetLink({ draft }: { draft: CoachFollowUpDraft }) {
  const className =
    "inline-flex h-10 items-center justify-center rounded-md border border-border bg-background/60 px-3 text-sm transition hover:border-gold/50 hover:text-gold";
  return draft.target.kind === "customer" ? (
    <Link
      to="/coach/customers/$userId"
      params={{ userId: draft.target.userId }}
      className={className}
    >
      <UserRoundSearch className="mr-2 h-4 w-4" /> Profil
    </Link>
  ) : (
    <Link to="/coach/leads" className={className}>
      <UserRoundSearch className="mr-2 h-4 w-4" /> Anfrage
    </Link>
  );
}

function categoryLabel(category: CoachFollowUpCategory) {
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
    case "stagnation":
      return "Stagnation";
    case "attention":
      return "Aufmerksamkeit";
  }
}
