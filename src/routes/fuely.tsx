import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { fallback, zodValidator } from "@tanstack/zod-adapter";
import { z } from "zod";
import { ArrowLeft, Brain, Send, Trash2, Sparkles, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Fuely, type FuelyEmotion } from "@/components/bodyfuel/Fuely";
import { FuelyTimeline } from "@/components/bodyfuel/FuelyTimeline";
import {
  listFuelyMessages,
  sendFuelyMessage,
  clearFuelyChat,
  listFuelyMemories,
  upsertFuelyMemory,
  deleteFuelyMemory,
  type FuelyMessage,
  type FuelyMemory,
} from "@/lib/fuely.functions";

const fuelySearchSchema = z.object({
  tab: fallback(z.enum(["chat", "timeline"]), "chat").default("chat"),
});

export const Route = createFileRoute("/fuely")({
  head: () => ({ meta: [{ title: "Fuely — BodyFuel" }] }),
  validateSearch: zodValidator(fuelySearchSchema),
  component: PersonalFuelyPage,
});

type QuickAction = { emoji: string; label: string; prompt: string };
const QUICK_ACTIONS: QuickAction[] = [
  { emoji: "🍽", label: "Ernährung analysieren", prompt: "Analysiere meine heutige Ernährung — bin ich auf Kurs bei Kalorien und Protein?" },
  { emoji: "🏋", label: "Trainingsplan erklären", prompt: "Erkläre mir kurz meinen aktuellen Trainingsplan und was heute wichtig ist." },
  { emoji: "📈", label: "Fortschritt bewerten", prompt: "Wie steht's um meinen Fortschritt der letzten 2 Wochen? Ehrliche Einschätzung bitte." },
  { emoji: "🥤", label: "Tagesziele", prompt: "Was sind heute meine wichtigsten Ziele und was fehlt mir noch?" },
  { emoji: "🔥", label: "Motivation", prompt: "Ich brauch' kurz einen Motivationsschub." },
  { emoji: "🎯", label: "Challenge finden", prompt: "Schlag mir eine passende Challenge oder ein Mini-Ziel für die nächste Woche vor." },
];

function PersonalFuelyPage() {
  const search = Route.useSearch();
  const tab = search.tab;
  const navigate = useNavigate();
  const qc = useQueryClient();
  const setTab = (next: "chat" | "timeline") =>
    navigate({ to: "/fuely", search: { tab: next }, replace: true });
  const [userId, setUserId] = useState<string | null>(null);
  const [firstName, setFirstName] = useState<string>("");
  const [input, setInput] = useState("");
  const [showMemories, setShowMemories] = useState(false);
  const [showClear, setShowClear] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) {
        navigate({ to: "/auth" });
        return;
      }
      setUserId(data.user.id);
      const { data: prof } = await supabase
        .from("profiles")
        .select("display_name")
        .eq("id", data.user.id)
        .maybeSingle();
      const dn = (prof as any)?.display_name?.trim() ?? "";
      setFirstName(dn ? dn.split(/\s+/)[0] : "");
    });
  }, [navigate]);

  const listFn = useServerFn(listFuelyMessages);
  const sendFn = useServerFn(sendFuelyMessage);
  const clearFn = useServerFn(clearFuelyChat);

  const messagesQ = useQuery({
    queryKey: ["fuely-messages", userId],
    enabled: !!userId,
    queryFn: () => listFn(),
  });

  const messages: FuelyMessage[] = messagesQ.data?.items ?? [];

  const sendMutation = useMutation({
    mutationFn: (content: string) => sendFn({ data: { content } }),
    onMutate: async (content) => {
      qc.setQueryData<{ items: FuelyMessage[] }>(["fuely-messages", userId], (prev) => ({
        items: [
          ...(prev?.items ?? []),
          { id: `optim-${Date.now()}`, role: "user", content, created_at: new Date().toISOString() },
        ],
      }));
    },
    onSuccess: (res: any) => {
      if (res?.nav?.path) {
        toast(res.nav.label ?? "Öffnen", {
          action: { label: "Los", onClick: () => navigate({ to: res.nav.path }) },
        });
      }
      qc.invalidateQueries({ queryKey: ["fuely-messages", userId] });
    },
    onError: (e: any) => {
      toast.error(e?.message ?? "Fuely konnte nicht antworten");
      qc.invalidateQueries({ queryKey: ["fuely-messages", userId] });
    },
  });

  const clearMutation = useMutation({
    mutationFn: () => clearFn(),
    onSuccess: () => {
      setShowClear(false);
      qc.invalidateQueries({ queryKey: ["fuely-messages", userId] });
    },
  });

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length, sendMutation.isPending]);

  useEffect(() => {
    inputRef.current?.focus();
  }, [messages.length, sendMutation.isPending]);

  function submit(text?: string) {
    const content = (text ?? input).trim();
    if (!content || sendMutation.isPending) return;
    setInput("");
    sendMutation.mutate(content);
  }

  const isEmpty = messages.length === 0 && !messagesQ.isLoading;
  const emotion: FuelyEmotion = sendMutation.isPending ? "thinking" : isEmpty ? "waving" : "happy";

  return (
    <div className="flex min-h-[100dvh] flex-col bg-background text-foreground">
      <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-border bg-card/95 px-4 py-3 backdrop-blur">
        <Link to="/dashboard" aria-label="Zurück" className="rounded-full p-1.5 hover:bg-muted">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <Fuely emotion={emotion} size="sm" animation={sendMutation.isPending ? "wiggle" : "idle"} />
        <div className="flex-1">
          <div className="font-display text-base font-bold leading-tight">Fuely</div>
          <div className="text-[11px] text-muted-foreground">Dein persönlicher BodyFuel Coach</div>
        </div>
        <Sheet open={showMemories} onOpenChange={setShowMemories}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Erinnerungen">
              <Brain className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-full max-w-md sm:max-w-md">
            <SheetHeader>
              <SheetTitle>Fuely Memory</SheetTitle>
            </SheetHeader>
            <FuelyMemoryPanel userId={userId} />
          </SheetContent>
        </Sheet>
        <Button variant="ghost" size="icon" aria-label="Chat leeren" onClick={() => setShowClear(true)}>
          <Trash2 className="h-5 w-5" />
        </Button>
      </header>

      <div className="border-b border-border bg-card/60 px-4">
        <div className="mx-auto flex max-w-2xl gap-1 py-2">
          {(["chat", "timeline"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`rounded-full px-4 py-1.5 text-xs font-semibold uppercase tracking-wider transition ${
                tab === t ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
              }`}
            >
              {t === "chat" ? "Chat" : "Timeline"}
            </button>
          ))}
        </div>
      </div>

      {tab === "timeline" ? (
        <div className="mx-auto w-full max-w-2xl flex-1 px-4 py-4">
          <FuelyTimeline />
        </div>
      ) : (
        <>
          <ScrollArea className="flex-1">
            <div ref={scrollRef} className="mx-auto flex max-w-2xl flex-col gap-3 px-4 py-4">
              {isEmpty && (
                <div className="mt-6 flex flex-col items-center gap-4 text-center">
                  <Fuely emotion="waving" size="xl" animation="float" />
                  <div className="space-y-2">
                    <div className="font-display text-2xl font-bold">
                      👋 Hallo{firstName ? ` ${firstName}` : ""}
                    </div>
                    <div className="font-display text-lg font-semibold">Ich bin Fuely.</div>
                    <p className="max-w-sm text-sm text-muted-foreground">
                      Dein smarter Begleiter für Training, Ernährung und Gesundheit.
                      Frag mich alles — ich kenne deine Daten und helfe dir, dranzubleiben.
                    </p>
                  </div>
                </div>
              )}

              {messages.map((m) => (
                <MessageBubble key={m.id} m={m} />
              ))}

              {sendMutation.isPending && (
                <div className="flex items-end gap-2">
                  <Fuely emotion="thinking" size="xs" animation="wiggle" />
                  <div className="flex items-center gap-1 rounded-2xl rounded-bl-sm bg-muted px-3 py-2">
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-foreground/60 [animation-delay:0ms]" />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-foreground/60 [animation-delay:120ms]" />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-foreground/60 [animation-delay:240ms]" />
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>

          <div className="border-t border-border bg-card/70 px-3 pt-2">
            <div className="mx-auto flex max-w-2xl gap-2 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {QUICK_ACTIONS.map((qa) => (
                <button
                  key={qa.label}
                  type="button"
                  onClick={() => submit(qa.prompt)}
                  disabled={sendMutation.isPending}
                  className="shrink-0 rounded-full border border-border bg-background px-3 py-1.5 text-xs font-medium transition hover:bg-muted disabled:opacity-50"
                >
                  <span className="mr-1">{qa.emoji}</span>
                  {qa.label}
                </button>
              ))}
            </div>
          </div>

          <div className="border-t border-border bg-background px-3 py-3" style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}>
            <form
              className="mx-auto flex max-w-2xl items-end gap-2"
              onSubmit={(e) => { e.preventDefault(); submit(); }}
            >
              <Textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); }
                }}
                placeholder="Frag Fuely alles ..."
                rows={1}
                className="min-h-[44px] max-h-40 resize-none"
                disabled={sendMutation.isPending}
              />
              <Button type="submit" size="icon" className="h-11 w-11 shrink-0" disabled={!input.trim() || sendMutation.isPending}>
                {sendMutation.isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
              </Button>
            </form>
          </div>
        </>
      )}

      <Dialog open={showClear} onOpenChange={setShowClear}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Chat mit Fuely leeren?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Der gesamte Chatverlauf wird gelöscht. Deine langfristigen Erinnerungen (Memory) bleiben erhalten.
          </p>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowClear(false)}>Abbrechen</Button>
            <Button variant="destructive" onClick={() => clearMutation.mutate()} disabled={clearMutation.isPending}>
              Löschen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function MessageBubble({ m }: { m: FuelyMessage }) {
  const isUser = m.role === "user";
  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="max-w-[80%] whitespace-pre-wrap rounded-2xl rounded-br-sm bg-primary px-3.5 py-2 text-sm text-primary-foreground shadow-sm">
          {m.content}
        </div>
      </div>
    );
  }
  return (
    <div className="flex items-end gap-2">
      <Fuely emotion="happy" size="xs" className="mb-1" />
      <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-bl-sm bg-muted px-3.5 py-2 text-sm">
        {m.content}
      </div>
    </div>
  );
}

function FuelyMemoryPanel({ userId }: { userId: string | null }) {
  const qc = useQueryClient();
  const listFn = useServerFn(listFuelyMemories);
  const upsertFn = useServerFn(upsertFuelyMemory);
  const delFn = useServerFn(deleteFuelyMemory);

  const memQ = useQuery({
    queryKey: ["fuely-memories", userId],
    enabled: !!userId,
    queryFn: () => listFn(),
  });
  const [newContent, setNewContent] = useState("");
  const [newCategory, setNewCategory] = useState("general");

  const addMutation = useMutation({
    mutationFn: () => upsertFn({ data: { content: newContent, category: newCategory, importance: 3 } }),
    onSuccess: () => {
      setNewContent("");
      qc.invalidateQueries({ queryKey: ["fuely-memories", userId] });
    },
  });

  const delMutation = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["fuely-memories", userId] }),
  });

  const items: FuelyMemory[] = memQ.data?.items ?? [];
  const byCat = useMemo(() => {
    const m = new Map<string, FuelyMemory[]>();
    items.forEach((it) => {
      if (!m.has(it.category)) m.set(it.category, []);
      m.get(it.category)!.push(it);
    });
    return Array.from(m.entries());
  }, [items]);

  return (
    <div className="mt-4 flex h-[calc(100dvh-8rem)] flex-col gap-4">
      <div className="flex items-start gap-3 rounded-lg border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
        <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <p>
          Das merkt sich Fuely dauerhaft über dich (Ziele, Vorlieben, Verletzungen usw.).
          Du kannst jederzeit Einträge hinzufügen, ändern oder löschen.
        </p>
      </div>

      <div className="space-y-2 rounded-lg border border-border p-3">
        <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Neue Erinnerung
        </div>
        <div className="flex gap-2">
          <Input
            placeholder="Kategorie (z.B. goal, allergy, injury)"
            value={newCategory}
            onChange={(e) => setNewCategory(e.target.value)}
            className="max-w-[45%]"
          />
          <Input
            placeholder="z.B. Zielgewicht 92 kg"
            value={newContent}
            onChange={(e) => setNewContent(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && newContent.trim()) addMutation.mutate();
            }}
          />
        </div>
        <Button size="sm" onClick={() => addMutation.mutate()} disabled={!newContent.trim() || addMutation.isPending}>
          Speichern
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="space-y-4 pr-2">
          {memQ.isLoading && <div className="text-sm text-muted-foreground">Lade …</div>}
          {!memQ.isLoading && items.length === 0 && (
            <div className="rounded-lg border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
              Noch keine Erinnerungen. Fuely legt sie automatisch an, während ihr chattet.
            </div>
          )}
          {byCat.map(([cat, list]) => (
            <div key={cat} className="space-y-2">
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="uppercase">{cat}</Badge>
                <span className="text-xs text-muted-foreground">{list.length}</span>
              </div>
              <ul className="space-y-1.5">
                {list.map((it) => (
                  <li
                    key={it.id}
                    className="flex items-start justify-between gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm"
                  >
                    <span className="flex-1">{it.content}</span>
                    <button
                      type="button"
                      onClick={() => delMutation.mutate(it.id)}
                      className="shrink-0 text-muted-foreground hover:text-destructive"
                      aria-label="Löschen"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
