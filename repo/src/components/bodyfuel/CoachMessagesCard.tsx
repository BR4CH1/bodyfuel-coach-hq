import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { MessageCircle, Send, Loader2, Megaphone, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useFormDraft, clearFormDraft } from "@/hooks/use-form-draft";
import {
  getCoachInbox,
  broadcastFromCoach,
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

export function CoachMessagesCard() {
  const qc = useQueryClient();
  const inboxFn = useServerFn(getCoachInbox);
  const broadcastFn = useServerFn(broadcastFromCoach);

  const { data: inbox, isLoading } = useQuery({
    queryKey: ["coach-inbox"],
    queryFn: () => inboxFn(),
    refetchInterval: 60_000,
  });

  // Realtime: any new message → refresh inbox
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
    (d) => {
      if (typeof d.broadcastBody === "string") setBroadcastBody(d.broadcastBody);
      if (d.audience === "all" || d.audience === "client" || d.audience === "free") setAudience(d.audience);
      if (typeof d.broadcastBody === "string" && d.broadcastBody.length > 0) setShowBroadcast(true);
    },
  );

  const broadcastMut = useMutation({
    mutationFn: () => broadcastFn({ data: { body: broadcastBody.trim(), audience } }),
    onSuccess: (res: any) => {
      toast.success(`Broadcast gesendet an ${res?.sent ?? 0} Kunden`);
      setBroadcastBody("");
      clearFormDraft("bf.coach.broadcast.v1");
      setShowBroadcast(false);
      qc.invalidateQueries({ queryKey: ["coach-inbox"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Fehler"),
  });

  const threads = (inbox ?? []) as InboxThread[];
  const totalUnread = threads.reduce((s, t) => s + t.unread_count, 0);

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="mb-4 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <MessageCircle className="h-5 w-5 text-gold" />
          <h2 className="font-display text-lg font-bold">Nachrichten</h2>
          {totalUnread > 0 && (
            <span className="rounded-full bg-red-500/15 px-2 py-0.5 text-xs font-bold text-red-500">
              {totalUnread} neu
            </span>
          )}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowBroadcast((v) => !v)}
        >
          <Megaphone className="mr-1.5 h-4 w-4" />
          An alle
        </Button>
      </div>

      {showBroadcast && (
        <div className="mb-4 space-y-2 rounded-xl border border-gold/30 bg-gold/5 p-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-muted-foreground">Empfänger:</span>
            <Select value={audience} onValueChange={(v) => setAudience(v as any)}>
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
            onChange={(e) => setBroadcastBody(e.target.value)}
            placeholder="Nachricht an alle Kunden…"
            rows={3}
            maxLength={4000}
          />
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-muted-foreground">
              Wird in jeden Kunden-Thread eingefügt.
            </span>
            <Button
              size="sm"
              onClick={() => broadcastMut.mutate()}
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
      )}

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Lade…</p>
      ) : threads.length === 0 ? (
        <p className="text-sm text-muted-foreground">Noch keine Nachrichten.</p>
      ) : (
        <div className="space-y-1.5">
          {threads.slice(0, 8).map((t) => {
            const name = t.nickname || t.display_name || "Unbekannt";
            return (
              <Link
                key={t.user_id}
                to="/coach/customers/$userId"
                params={{ userId: t.user_id }}
                hash="messages"
                className="flex items-center justify-between gap-2 rounded-lg px-3 py-2 transition hover:bg-secondary"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-semibold">{name}</span>
                    {t.unread_count > 0 && (
                      <span className="shrink-0 rounded-full bg-red-500 px-1.5 text-[10px] font-bold text-white">
                        {t.unread_count}
                      </span>
                    )}
                  </div>
                  <p className="truncate text-xs text-muted-foreground">
                    {t.last_from_coach ? "Du: " : ""}
                    {t.last_body}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1.5 text-[11px] text-muted-foreground">
                  {timeAgo(t.last_at)}
                  <ChevronRight className="h-3.5 w-3.5" />
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
