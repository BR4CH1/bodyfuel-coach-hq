import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Send, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useFormDraft, clearFormDraft } from "@/hooks/use-form-draft";
import { supabase } from "@/integrations/supabase/client";
import {
  getThreadForClient,
  sendMessageToClient,
  markThreadReadByCoach,
  getMyThread,
  sendMessageToCoach,
  markMyThreadRead,
  type CoachMessage,
} from "@/lib/coach-messages.functions";

function fmtTime(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const sameDay = d.toDateString() === today.toDateString();
  return sameDay
    ? d.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })
    : d.toLocaleString("de-DE", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

type Props = {
  mode: "coach" | "client";
  /** Required when mode === "coach" */
  userId?: string;
};

export function CoachMessageThread({ mode, userId }: Props) {
  const qc = useQueryClient();
  const threadKey = mode === "coach" ? ["coach-thread", userId] : ["my-thread"];

  const getCoachFn = useServerFn(getThreadForClient);
  const getMineFn = useServerFn(getMyThread);
  const sendCoachFn = useServerFn(sendMessageToClient);
  const sendMineFn = useServerFn(sendMessageToCoach);
  const markCoachReadFn = useServerFn(markThreadReadByCoach);
  const markMineReadFn = useServerFn(markMyThreadRead);

  const { data, isLoading } = useQuery({
    queryKey: threadKey,
    queryFn: () =>
      mode === "coach"
        ? getCoachFn({ data: { userId: userId! } })
        : getMineFn(),
    enabled: mode === "client" || !!userId,
  });

  const [text, setText] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const draftKey =
    mode === "coach" && userId
      ? `bf.coach.thread.reply.v1.${userId}`
      : mode === "client"
        ? "bf.client.thread.reply.v1"
        : null;
  useFormDraft(draftKey, { text }, (d) => {
    if (typeof d.text === "string") setText(d.text);
  });

  // Auto-scroll on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [data]);

  // Mark read on mount/load
  useEffect(() => {
    if (!data || data.length === 0) return;
    if (mode === "coach" && userId) {
      markCoachReadFn({ data: { userId } }).then(() => {
        qc.invalidateQueries({ queryKey: ["coach-inbox"] });
      });
    } else if (mode === "client") {
      markMineReadFn().then(() => {
        qc.invalidateQueries({ queryKey: ["my-unread"] });
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.length, mode, userId]);

  // Realtime
  useEffect(() => {
    if (mode === "coach" && !userId) return;
    const filter = mode === "coach"
      ? `thread_user_id=eq.${userId}`
      : undefined;
    const channel = supabase
      .channel(`messages-${mode}-${userId ?? "me"}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "coach_messages", filter },
        () => {
          qc.invalidateQueries({ queryKey: threadKey });
          qc.invalidateQueries({ queryKey: ["coach-inbox"] });
          qc.invalidateQueries({ queryKey: ["my-unread"] });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, userId]);

  const sendMut = useMutation({
    mutationFn: async (body: string) => {
      if (mode === "coach") {
        return sendCoachFn({ data: { userId: userId!, body } });
      }
      return sendMineFn({ data: { body } });
    },
    onSuccess: () => {
      setText("");
      qc.invalidateQueries({ queryKey: threadKey });
      qc.invalidateQueries({ queryKey: ["coach-inbox"] });
      qc.invalidateQueries({ queryKey: ["my-unread"] });
      if (mode === "client") {
        toast.success("Nachricht gesendet", {
          description: "Dein Coach meldet sich so schnell wie möglich bei dir.",
        });
      }
    },
    onError: (e: any) => toast.error(e.message ?? "Fehler beim Senden"),
  });

  function onSend() {
    const body = text.trim();
    if (!body) return;
    sendMut.mutate(body);
  }

  const messages = (data ?? []) as CoachMessage[];

  return (
    <div className="flex h-full min-h-[360px] flex-col rounded-2xl border border-border bg-card">
      <div
        ref={scrollRef}
        className="flex-1 space-y-3 overflow-y-auto p-4"
        style={{ maxHeight: "60vh" }}
      >
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Lade Nachrichten…</p>
        ) : messages.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {mode === "client"
              ? "Noch keine Nachrichten. Schreibe deinem Coach!"
              : "Noch keine Nachrichten in diesem Thread."}
          </p>
        ) : (
          messages.map((m) => {
            const mine = mode === "coach" ? m.from_coach : !m.from_coach;
            return (
              <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[80%] rounded-2xl px-3.5 py-2 text-sm ${
                    mine
                      ? "bg-gold/15 text-foreground border border-gold/30"
                      : "bg-secondary text-foreground"
                  }`}
                >
                  <div className="whitespace-pre-wrap break-words">{m.body}</div>
                  <div className="mt-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                    {fmtTime(m.created_at)}
                    {m.broadcast_id && mine ? " • Broadcast" : ""}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
      <div className="border-t border-border p-3">
        <div className="flex items-end gap-2">
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                onSend();
              }
            }}
            placeholder={mode === "client" ? "Nachricht an deinen Coach…" : "Antwort an Kunde…"}
            rows={2}
            maxLength={4000}
            className="min-h-[44px] resize-none"
          />
          <Button onClick={onSend} disabled={sendMut.isPending || !text.trim()} size="sm">
            {sendMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
        <p className="mt-1.5 text-[11px] text-muted-foreground">
          {text.length}/4000 · ⌘/Ctrl+Enter zum Senden
        </p>
      </div>
    </div>
  );
}
