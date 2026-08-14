import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { ChevronRight, Loader2, Megaphone, MessageCircle, Send } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { clearFormDraft, useFormDraft } from "@/hooks/use-form-draft";
import { supabase } from "@/integrations/supabase/client";
import {
  broadcastFromCoach,
  getCoachInbox,
  type InboxThread,
} from "@/lib/coach-messages.functions";

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "gerade eben";
  if (min < 60) return `vor ${min} Min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `vor ${h} Std`;
  const d = Math.floor(h / 24);
  return `vor ${d} Tag${d === 1 ? "" : "en"}`;
}

function audienceLabel(audience: "all" | "client" | "free") {
  if (audience === "client") return "alle Coaching-Kunden";
  if (audience === "free") return "alle Free-Nutzer";
  return "alle Client- und Free-Nutzer";
}

export function CoachMessagesCard() {
  const qc = useQueryClient();
  const inboxFn = useServerFn(getCoachInbox);
  const broadcastFn = useServerFn(broadcastFromCoach);

  const { data: inbox, isLoading } = useQuery({
    queryKey: ["coach-inbox"],
    queryFn: () => inboxFn(),
    refetchInterval: 60_000,
  });

  useEffect(() => {
    const channel = supabase
      .channel("coach-inbox-watch")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "coach_messages" },
        () => {
          qc.invalidateQueries({ queryKey: ["coach-inbox"] });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc]);

  const [broadcastBody, setBroadcastBody] = useState("");
  const [audience, setAudience] = useState<"all" | "client" | "free">("all");
  const [showBroadcast, setShowBroadcast] = useState(false);

  useFormDraft(
    "bf.coach.broadcast.v1",
    { broadcastBody, audience },
    (draft) => {
      if (typeof draft.broadcastBody === "string") setBroadcastBody(draft.broadcastBody);
      if (draft.audience === "all" || draft.audience === "client" || draft.audience === "free") {
        setAudience(draft.audience);
      }
      if (typeof draft.broadcastBody === "string" && draft.broadcastBody.length > 0) {
        setShowBroadcast(true);
      }
    },
  );

  const broadcastMut = useMutation({
    mutationFn: () => broadcastFn({ data: { body: broadcastBody.trim(), audience } }),
    onSuccess: (result: any) => {
      toast.success(`Broadcast gesendet an ${result?.sent ?? 0} Kunden`);
      setBroadcastBody("");
      clearFormDraft("bf.coach.broadcast.v1");
      setShowBroadcast(false);
      qc.invalidateQueries({ queryKey: ["coach-inbox"] });
    },
    onError: (error: any) => toast.error(error.message ?? "Fehler"),
  });

  const threads = (inbox ?? []) as InboxThread[];
  const totalUnread = threads.reduce((sum, thread) => sum + thread.unread_count, 0);

  const sendBroadcast = () => {
    const body = broadcastBody.trim();
    if (!body) return;
    const confirmed = window.confirm(
      `Broadcast wirklich an ${audienceLabel(audience)} senden?\n\n${body.slice(0, 240)}${body.length > 240 ? "…" : ""}`,
    );
    if (confirmed) broadcastMut.mutate();
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="mb-4 flex items-center gap-2">
        <MessageCircle className="h-5 w-5 text-gold" />
        <h2 className="font-display text-lg font-bold">Nachrichten</h2>
        {totalUnread > 0 && (
          <span className="rounded-full bg-red-500/15 px-2 py-0.5 text-xs font-bold text-red-500">
            {totalUnread} neu
          </span>
        )}
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Lade…</p>
      ) : threads.length === 0 ? (
        <p className="text-sm text-muted-foreground">Noch keine Nachrichten.</p>
      ) : (
        <div className="space-y-1.5">
          {threads.slice(0, 8).map((thread) => {
            const name = thread.nickname || thread.display_name || "Unbekannt";
            return (
              <Link
                key={thread.user_id}
                to="/coach/customers/$userId"
                params={{ userId: thread.user_id }}
                hash="messages"
                className="flex items-center justify-between gap-2 rounded-lg px-3 py-2 transition hover:bg-secondary"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-semibold">{name}</span>
                    {thread.unread_count > 0 && (
                      <span className="shrink-0 rounded-full bg-red-500 px-1.5 text-[10px] font-bold text-white">
                        {thread.unread_count}
                      </span>
                    )}
                  </div>
                  <p className="truncate text-xs text-muted-foreground">
                    {thread.last_from_coach ? "Du: " : ""}
                    {thread.last_body}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1.5 text-[11px] text-muted-foreground">
                  {timeAgo(thread.last_at)}
                  <ChevronRight className="h-3.5 w-3.5" />
                </div>
              </Link>
            );
          })}
        </div>
      )}

      <details
        open={showBroadcast}
        onToggle={(event) => setShowBroadcast(event.currentTarget.open)}
        className="group mt-4 border-t border-border/60 pt-3"
      >
        <summary className="flex cursor-pointer list-none items-center gap-2 text-xs font-semibold text-muted-foreground transition hover:text-foreground">
          <Megaphone className="h-4 w-4" />
          Broadcast an mehrere Nutzer
          <span className="ml-auto text-[10px] uppercase tracking-wider group-open:hidden">
            öffnen
          </span>
        </summary>

        <div className="mt-3 space-y-2 rounded-xl border border-gold/30 bg-gold/5 p-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-muted-foreground">Empfänger:</span>
            <Select
              value={audience}
              onValueChange={(value) => setAudience(value as "all" | "client" | "free")}
            >
              <SelectTrigger className="h-8 w-44 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle (Client + Free)</SelectItem>
                <SelectItem value="client">Nur Coaching-Kunden</SelectItem>
                <SelectItem value="free">Nur Free-Nutzer</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Textarea
            value={broadcastBody}
            onChange={(event) => setBroadcastBody(event.target.value)}
            placeholder="Nachricht an mehrere Nutzer…"
            rows={3}
            maxLength={4000}
          />
          <div className="flex items-center justify-between gap-3">
            <span className="text-[11px] text-muted-foreground">
              Vor dem Versand kommt immer eine Sicherheitsabfrage.
            </span>
            <Button
              size="sm"
              onClick={sendBroadcast}
              disabled={broadcastMut.isPending || broadcastBody.trim().length === 0}
            >
              {broadcastMut.isPending ? (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              ) : (
                <Send className="mr-1.5 h-4 w-4" />
              )}
              Senden
            </Button>
          </div>
        </div>
      </details>
    </div>
  );
}
