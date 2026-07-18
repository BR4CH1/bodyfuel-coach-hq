import { useEffect, useRef } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getFuelyDailyNote, markFuelyDailyRead } from "@/lib/fuely-daily.functions";
import { Card } from "@/components/ui/card";
import { Loader2, MessageCircle, Sparkles, Moon } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = { orgSlug: string; className?: string };

export function FuelyDailyCard({ orgSlug, className }: Props) {
  // Vormittags: Morning Briefing. Abends (ab 18 Uhr Lokalzeit): Evening Review.
  const hour = new Date().getHours();
  const kind: "morning" | "evening" = hour >= 18 || hour < 4 ? "evening" : "morning";

  const fetchNote = useServerFn(getFuelyDailyNote);
  const markRead = useServerFn(markFuelyDailyRead);
  const navigate = useNavigate();
  const qc = useQueryClient();

  const q = useQuery({
    queryKey: ["fuely-daily", kind],
    queryFn: () => fetchNote({ data: { kind } }),
    staleTime: 60 * 60 * 1000,
    retry: 0,
  });

  const note = q.data as any;
  const isEvening = kind === "evening";
  const Icon = isEvening ? Moon : Sparkles;

  // Auto-mark-read nach 3s Sichtbarkeit — danach ist die Karte "gesehen"
  // und verschwindet beim nächsten Laden.
  const markedRef = useRef(false);
  useEffect(() => {
    if (!note?.id || note.read_at || markedRef.current) return;
    const t = setTimeout(async () => {
      markedRef.current = true;
      try {
        await markRead({ data: { id: note.id } });
        qc.setQueryData(["fuely-daily", kind], { ...note, read_at: new Date().toISOString() });
      } catch {
        /* egal */
      }
    }, 3000);
    return () => clearTimeout(t);
  }, [note?.id, note?.read_at, kind, markRead, qc]);

  // Bereits gelesen → ausblenden
  if (note?.read_at) return null;

  const openChat = async () => {
    if (note?.id && !note.read_at) {
      try {
        await markRead({ data: { id: note.id } });
        qc.setQueryData(["fuely-daily", kind], { ...note, read_at: new Date().toISOString() });
      } catch {
        // egal
      }
    }
    navigate({ to: "/$orgSlug/fuely", params: { orgSlug } });
  };

  return (
    <Card
      onClick={openChat}
      className={cn(
        "relative overflow-hidden cursor-pointer transition-all hover:scale-[1.01] active:scale-[0.99]",
        "border-primary/20 bg-gradient-to-br from-primary/10 via-background to-background",
        "p-4 shadow-md",
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <div
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
            "bg-gradient-to-br from-primary to-primary/60 text-primary-foreground shadow-inner",
          )}
        >
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-semibold uppercase tracking-wide text-primary">
              {isEvening ? "Abend-Rückblick von Fuely" : "Fuely am Morgen"}
            </span>
            {note && !note.read_at ? (
              <span className="h-2 w-2 rounded-full bg-primary animate-pulse" />
            ) : null}
          </div>

          {q.isLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Fuely bereitet {isEvening ? "deinen Rückblick" : "dein Briefing"} vor…</span>
            </div>
          ) : q.isError || !note?.content ? (
            <div className="text-sm text-muted-foreground">
              Fuely meldet sich später bei dir. Tipp an, um zu chatten. 💚
            </div>
          ) : (
            <p className="whitespace-pre-line text-sm leading-relaxed text-foreground">
              {note.content}
            </p>
          )}

          <div className="mt-3 flex items-center gap-1 text-xs text-muted-foreground">
            <MessageCircle className="h-3.5 w-3.5" />
            Antippen, um mit Fuely weiterzureden
          </div>
        </div>
      </div>
    </Card>
  );
}

export default FuelyDailyCard;
