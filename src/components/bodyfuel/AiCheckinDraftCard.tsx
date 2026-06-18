import { useState } from "react";
import { Sparkles, Loader2, CheckCircle2, XCircle, Pencil, Copy } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { generateCheckinDraft, type CheckinDraft } from "@/lib/checkin-ai.functions";

type Status = "idle" | "pending" | "approved" | "edited" | "rejected";

const levelStyles: Record<CheckinDraft["status_level"], string> = {
  green: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
  yellow: "bg-amber-500/10 text-amber-400 border-amber-500/30",
  red: "bg-red-500/10 text-red-400 border-red-500/30",
};

const priorityStyles: Record<string, string> = {
  high: "bg-red-500/10 text-red-400 border-red-500/30",
  medium: "bg-amber-500/10 text-amber-400 border-amber-500/30",
  low: "bg-muted text-muted-foreground border-border",
};

const areaLabel: Record<string, string> = {
  nutrition: "Ernährung",
  training: "Training",
  lifestyle: "Lifestyle",
  communication: "Kommunikation",
};

export function AiCheckinDraftCard({ userId }: { userId: string }) {
  const genFn = useServerFn(generateCheckinDraft);
  const [draft, setDraft] = useState<CheckinDraft | null>(null);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [editing, setEditing] = useState(false);
  const [messageDraft, setMessageDraft] = useState("");

  const mutation = useMutation({
    mutationFn: () => genFn({ data: { user_id: userId } }),
    onSuccess: (res) => {
      setDraft(res.draft);
      setGeneratedAt(res.generated_at);
      setMessageDraft(res.draft.coach_message);
      setStatus("pending");
      setEditing(false);
    },
    onError: (err: Error) => toast.error(err.message || "Entwurf konnte nicht erstellt werden"),
  });

  const copyMessage = async () => {
    try {
      await navigator.clipboard.writeText(messageDraft);
      toast.success("Nachricht kopiert");
    } catch {
      toast.error("Kopieren fehlgeschlagen");
    }
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-6">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-gold" />
          <div>
            <h2 className="font-display text-lg font-bold">KI Check-in-Entwurf</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              KI analysiert die letzten Wochen und schlägt einen Check-in-Entwurf vor. Du entscheidest.
            </p>
          </div>
        </div>
        <Button
          size="sm"
          onClick={() => mutation.mutate()}
          disabled={mutation.isPending}
          className="shrink-0"
        >
          {mutation.isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Analysiere…
            </>
          ) : draft ? (
            "Neu erstellen"
          ) : (
            "Entwurf erstellen"
          )}
        </Button>
      </div>

      {!draft && !mutation.isPending && (
        <p className="mt-6 text-sm text-muted-foreground">
          Noch kein Entwurf. Klicke auf „Entwurf erstellen", um eine KI-Analyse zu starten.
        </p>
      )}

      {draft && (
        <div className="mt-5 space-y-5">
          {/* Status */}
          <div className={`rounded-xl border px-4 py-3 ${levelStyles[draft.status_level]}`}>
            <div className="flex items-center justify-between gap-2">
              <div className="text-xs font-bold uppercase tracking-wide">
                Status: {draft.status_level === "green" ? "Auf Kurs" : draft.status_level === "yellow" ? "Beobachten" : "Handlungsbedarf"}
              </div>
              {status !== "idle" && status !== "pending" && (
                <span className="rounded-full bg-background/30 px-2 py-0.5 text-[10px] font-semibold uppercase">
                  {status === "approved" ? "Freigegeben" : status === "edited" ? "Bearbeitet" : "Abgelehnt"}
                </span>
              )}
            </div>
            <p className="mt-1 text-sm">{draft.status_summary}</p>
          </div>

          {/* Wins / Concerns */}
          <div className="grid gap-4 sm:grid-cols-2">
            {draft.wins.length > 0 && (
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wide text-emerald-400">Wins</h3>
                <ul className="mt-2 space-y-1.5 text-sm">
                  {draft.wins.map((w, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="text-emerald-400">+</span>
                      <span>{w}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {draft.concerns.length > 0 && (
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wide text-amber-400">Concerns</h3>
                <ul className="mt-2 space-y-1.5 text-sm">
                  {draft.concerns.map((c, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="text-amber-400">!</span>
                      <span>{c}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Actions */}
          {draft.recommended_actions.length > 0 && (
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                Empfohlene Aktionen
              </h3>
              <div className="mt-2 space-y-2">
                {draft.recommended_actions.map((a, i) => (
                  <div key={i} className="rounded-lg border border-border bg-background/40 p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${
                          priorityStyles[a.priority] ?? priorityStyles.medium
                        }`}
                      >
                        {a.priority}
                      </span>
                      <span className="rounded-full border border-border bg-muted/40 px-2 py-0.5 text-[10px] font-semibold uppercase text-muted-foreground">
                        {areaLabel[a.area] ?? a.area}
                      </span>
                      <span className="text-sm font-semibold">{a.title}</span>
                    </div>
                    <p className="mt-1.5 text-sm text-muted-foreground">{a.detail}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Plan-Anpassungen */}
          {(draft.nutrition_adjustment || draft.training_adjustment) && (
            <div className="grid gap-3 sm:grid-cols-2">
              {draft.nutrition_adjustment && (
                <div className="rounded-lg border border-border bg-background/40 p-3">
                  <h3 className="text-xs font-bold uppercase tracking-wide text-gold">
                    Ernährungs-Anpassung
                  </h3>
                  <p className="mt-1 text-sm">{draft.nutrition_adjustment}</p>
                </div>
              )}
              {draft.training_adjustment && (
                <div className="rounded-lg border border-border bg-background/40 p-3">
                  <h3 className="text-xs font-bold uppercase tracking-wide text-gold">
                    Trainings-Anpassung
                  </h3>
                  <p className="mt-1 text-sm">{draft.training_adjustment}</p>
                </div>
              )}
            </div>
          )}

          {/* Coach-Nachricht */}
          <div>
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                Nachricht an Kunde
              </h3>
              <button
                onClick={copyMessage}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
              >
                <Copy className="h-3 w-3" /> Kopieren
              </button>
            </div>
            {editing ? (
              <Textarea
                value={messageDraft}
                onChange={(e) => setMessageDraft(e.target.value)}
                rows={5}
                className="mt-2"
              />
            ) : (
              <p className="mt-2 whitespace-pre-wrap rounded-lg border border-border bg-background/40 p-3 text-sm">
                {messageDraft}
              </p>
            )}
          </div>

          {/* Entscheidungs-Buttons */}
          <div className="flex flex-wrap gap-2 border-t border-border pt-4">
            <Button
              size="sm"
              variant="default"
              onClick={() => {
                setStatus(editing ? "edited" : "approved");
                setEditing(false);
                toast.success(editing ? "Bearbeitete Version übernommen" : "Entwurf freigegeben");
              }}
              disabled={status === "rejected"}
            >
              <CheckCircle2 className="mr-1.5 h-4 w-4" />
              {editing ? "Bearbeitung übernehmen" : "Freigeben"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setEditing((v) => !v)}
              disabled={status === "rejected"}
            >
              <Pencil className="mr-1.5 h-4 w-4" />
              {editing ? "Abbrechen" : "Bearbeiten"}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setStatus("rejected");
                setEditing(false);
                toast.info("Entwurf abgelehnt");
              }}
              className="text-red-400 hover:text-red-300"
            >
              <XCircle className="mr-1.5 h-4 w-4" />
              Ablehnen
            </Button>
            {generatedAt && (
              <span className="ml-auto self-center text-[11px] text-muted-foreground">
                Erstellt: {new Date(generatedAt).toLocaleString("de-DE")}
              </span>
            )}
          </div>

          <p className="text-[11px] text-muted-foreground">
            Hinweis: Freigaben werden in dieser Version nicht gespeichert — Persistenz folgt im
            nächsten Mini-PR.
          </p>
        </div>
      )}
    </div>
  );
}
