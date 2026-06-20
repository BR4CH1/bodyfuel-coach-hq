import { useState } from "react";
import { Sparkles, Loader2, CheckCircle2, XCircle, Pencil, Copy, History, Trash2 } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  generateCheckinDraft,
  listCheckinDrafts,
  decideCheckinDraft,
  deleteCheckinDraft,
  type CheckinDraft,
  type CheckinDraftRecord,
} from "@/lib/checkin-ai.functions";

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

const statusLabel: Record<CheckinDraftRecord["status"], string> = {
  pending: "Offen",
  approved: "Freigegeben",
  edited: "Bearbeitet",
  rejected: "Abgelehnt",
};

const statusBadge: Record<CheckinDraftRecord["status"], string> = {
  pending: "bg-amber-500/10 text-amber-400 border-amber-500/30",
  approved: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
  edited: "bg-sky-500/10 text-sky-400 border-sky-500/30",
  rejected: "bg-red-500/10 text-red-400 border-red-500/30",
};

export function AiCheckinDraftCard({ userId }: { userId: string }) {
  const genFn = useServerFn(generateCheckinDraft);
  const listFn = useServerFn(listCheckinDrafts);
  const decideFn = useServerFn(decideCheckinDraft);
  const deleteFn = useServerFn(deleteCheckinDraft);
  const qc = useQueryClient();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [messageDraft, setMessageDraft] = useState("");
  const [showHistory, setShowHistory] = useState(false);

  const queryKey = ["ai-checkin-drafts", userId];
  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: () => listFn({ data: { user_id: userId, limit: 20 } }),
  });

  const items = data?.items ?? [];
  const active =
    items.find((i) => i.id === selectedId) ??
    items.find((i) => i.status === "pending") ??
    items[0] ??
    null;

  // sync editor with active draft
  const activeMessage = active?.message_final ?? active?.draft.coach_message ?? "";
  if (active && !editing && messageDraft !== activeMessage && selectedId !== active.id) {
    // initial selection load — keep last edit when same draft
  }

  const ensureMessage = () => {
    if (active && messageDraft === "" && !editing) {
      setMessageDraft(activeMessage);
    }
  };
  ensureMessage();

  const generateMutation = useMutation({
    mutationFn: () => genFn({ data: { user_id: userId } }),
    onSuccess: async (res) => {
      await qc.invalidateQueries({ queryKey });
      setSelectedId(res.id);
      setMessageDraft(res.message_final);
      setEditing(false);
      toast.success("Entwurf erstellt");
    },
    onError: (err: Error) => toast.error(err.message || "Entwurf konnte nicht erstellt werden"),
  });

  const decideMutation = useMutation({
    mutationFn: (p: {
      decision: "approved" | "edited" | "rejected";
      message?: string;
    }) =>
      decideFn({
        data: {
          draft_id: active!.id,
          decision: p.decision,
          message_final: p.message,
        },
      }),
    onSuccess: async (_r, vars) => {
      await qc.invalidateQueries({ queryKey });
      setEditing(false);
      toast.success(
        vars.decision === "approved"
          ? "Entwurf freigegeben"
          : vars.decision === "edited"
            ? "Bearbeitete Version übernommen"
            : "Entwurf abgelehnt",
      );
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { draft_id: id } }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey });
      setSelectedId(null);
      toast.success("Entwurf gelöscht");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const copyMessage = async () => {
    try {
      await navigator.clipboard.writeText(messageDraft);
      toast.success("Nachricht kopiert");
    } catch {
      toast.error("Kopieren fehlgeschlagen");
    }
  };

  const selectDraft = (id: string) => {
    const it = items.find((x) => x.id === id);
    if (!it) return;
    setSelectedId(id);
    setMessageDraft(it.message_final ?? it.draft.coach_message);
    setEditing(false);
  };

  const draft = active?.draft;
  const decided = active && active.status !== "pending";

  return (
    <div className="rounded-2xl border border-border bg-card p-6">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-gold" />
          <div>
            <h2 className="font-display text-lg font-bold">Check-in-Entwurf</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              BodyFuel analysiert die letzten Wochen und schlägt einen Check-in-Entwurf vor. Du entscheidest.
            </p>
          </div>
        </div>
        <div className="flex shrink-0 gap-2">
          {items.length > 0 && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowHistory((v) => !v)}
              type="button"
            >
              <History className="mr-1.5 h-4 w-4" />
              Historie ({items.length})
            </Button>
          )}
          <Button
            size="sm"
            onClick={() => generateMutation.mutate()}
            disabled={generateMutation.isPending}
          >
            {generateMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Analysiere…
              </>
            ) : items.length > 0 ? (
              "Neu erstellen"
            ) : (
              "Entwurf erstellen"
            )}
          </Button>
        </div>
      </div>

      {showHistory && items.length > 0 && (
        <div className="mt-4 space-y-1.5 rounded-xl border border-border bg-background/40 p-2">
          {items.map((it) => (
            <div
              key={it.id}
              className={`flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs cursor-pointer hover:bg-muted/40 ${
                it.id === active?.id ? "bg-muted/60" : ""
              }`}
              onClick={() => selectDraft(it.id)}
            >
              <span
                className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${statusBadge[it.status]}`}
              >
                {statusLabel[it.status]}
              </span>
              <span className="text-muted-foreground">
                {new Date(it.generated_at).toLocaleString("de-DE")}
              </span>
              <span className="ml-auto" />
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (confirm("Entwurf wirklich löschen?")) deleteMutation.mutate(it.id);
                }}
                className="text-muted-foreground hover:text-red-400"
                title="Löschen"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {isLoading && !active && (
        <p className="mt-6 text-sm text-muted-foreground">Lade Entwürfe…</p>
      )}

      {!isLoading && !active && !generateMutation.isPending && (
        <p className="mt-6 text-sm text-muted-foreground">
          Noch kein Entwurf. Klicke auf „Entwurf erstellen", um eine Analyse zu starten.
        </p>
      )}

      {active && draft && (
        <div className="mt-5 space-y-5">
          {/* Status */}
          <div className={`rounded-xl border px-4 py-3 ${levelStyles[draft.status_level]}`}>
            <div className="flex items-center justify-between gap-2">
              <div className="text-xs font-bold uppercase tracking-wide">
                Status:{" "}
                {draft.status_level === "green"
                  ? "Auf Kurs"
                  : draft.status_level === "yellow"
                    ? "Beobachten"
                    : "Handlungsbedarf"}
              </div>
              <span
                className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${statusBadge[active.status]}`}
              >
                {statusLabel[active.status]}
              </span>
            </div>
            <p className="mt-1 text-sm">{draft.status_summary}</p>
          </div>

          {/* Wins / Concerns */}
          <div className="grid gap-4 sm:grid-cols-2">
            {draft.wins.length > 0 && (
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wide text-emerald-400">
                  Wins
                </h3>
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
                <h3 className="text-xs font-bold uppercase tracking-wide text-amber-400">
                  Concerns
                </h3>
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
                type="button"
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
              onClick={() =>
                decideMutation.mutate({
                  decision: editing ? "edited" : "approved",
                  message: messageDraft,
                })
              }
              disabled={decideMutation.isPending || decided}
            >
              <CheckCircle2 className="mr-1.5 h-4 w-4" />
              {editing ? "Bearbeitung übernehmen" : "Freigeben"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setEditing((v) => !v)}
              disabled={decideMutation.isPending || decided}
            >
              <Pencil className="mr-1.5 h-4 w-4" />
              {editing ? "Abbrechen" : "Bearbeiten"}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() =>
                decideMutation.mutate({ decision: "rejected", message: messageDraft })
              }
              disabled={decideMutation.isPending || decided}
              className="text-red-400 hover:text-red-300"
            >
              <XCircle className="mr-1.5 h-4 w-4" />
              Ablehnen
            </Button>
            <span className="ml-auto self-center text-[11px] text-muted-foreground">
              Erstellt: {new Date(active.generated_at).toLocaleString("de-DE")}
              {active.decided_at && (
                <> · Entschieden: {new Date(active.decided_at).toLocaleString("de-DE")}</>
              )}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
