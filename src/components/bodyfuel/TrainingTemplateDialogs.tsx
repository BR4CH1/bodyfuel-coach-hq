import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { BookOpen, Copy, Trash2, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  listTrainingTemplates,
  getTrainingTemplate,
  duplicateTrainingTemplate,
  deleteTrainingTemplate,
  type TrainingTemplateSummary,
  type TrainingTemplateDetail,
} from "@/lib/training-templates.functions";

export function TrainingTemplateLibraryDialog({
  open,
  onOpenChange,
  onSelect,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSelect: (tpl: TrainingTemplateDetail) => void;
}) {
  const qc = useQueryClient();
  const listFn = useServerFn(listTrainingTemplates);
  const getFn = useServerFn(getTrainingTemplate);
  const dupFn = useServerFn(duplicateTrainingTemplate);
  const delFn = useServerFn(deleteTrainingTemplate);

  const q = useQuery({
    queryKey: ["training-templates"],
    queryFn: () => listFn(),
    enabled: open,
  });

  const [busyId, setBusyId] = useState<string | null>(null);

  const dupM = useMutation({
    mutationFn: (id: string) => dupFn({ data: { templateId: id } }),
    onSuccess: () => {
      toast.success("Vorlage dupliziert");
      qc.invalidateQueries({ queryKey: ["training-templates"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Fehler"),
  });
  const delM = useMutation({
    mutationFn: (id: string) => delFn({ data: { templateId: id } }),
    onSuccess: () => {
      toast.success("Vorlage gelöscht");
      qc.invalidateQueries({ queryKey: ["training-templates"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Fehler"),
  });

  async function handleUse(t: TrainingTemplateSummary) {
    try {
      setBusyId(t.id);
      const detail = await getFn({ data: { templateId: t.id } });
      onSelect(detail);
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message ?? "Vorlage konnte nicht geladen werden");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Trainingsvorlagen</DialogTitle>
          <DialogDescription>
            Wähle eine Vorlage, um die Plan-Struktur (Tage &amp; Übungen) in den Builder zu laden.
            Die Vorlage bleibt statisch — der zugewiesene Athletenplan entwickelt sich eigenständig weiter.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[60vh] overflow-y-auto rounded-lg border border-border">
          {q.isLoading ? (
            <div className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Lade Vorlagen…
            </div>
          ) : !q.data?.length ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              <BookOpen className="mx-auto mb-2 h-6 w-6 opacity-40" />
              Noch keine Vorlagen. Speichere den aktuellen Plan als Vorlage, um ihn wiederzuverwenden.
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {q.data.map((t) => (
                <li key={t.id} className="flex items-start justify-between gap-3 p-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-semibold">{t.name}</p>
                      <span className="rounded-full border border-border px-2 py-0.5 text-[10px] text-muted-foreground">
                        {t.weeks_count} Woche{t.weeks_count > 1 ? "n" : ""} · v{t.current_version}
                      </span>
                    </div>
                    {t.description && (
                      <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{t.description}</p>
                    )}
                    {t.tags?.length > 0 && (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {t.tags.map((tag) => (
                          <span key={tag} className="rounded-full bg-secondary px-2 py-0.5 text-[10px]">
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      onClick={() => handleUse(t)}
                      disabled={busyId === t.id}
                      className="rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-50"
                    >
                      {busyId === t.id ? "Lade…" : "Verwenden"}
                    </button>
                    <button
                      onClick={() => dupM.mutate(t.id)}
                      title="Duplizieren"
                      className="rounded-md border border-border p-1.5 text-muted-foreground hover:text-foreground"
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => {
                        if (confirm(`Vorlage "${t.name}" löschen?`)) delM.mutate(t.id);
                      }}
                      title="Löschen"
                      className="rounded-md border border-border p-1.5 text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <DialogFooter>
          <button
            onClick={() => onOpenChange(false)}
            className="rounded-md border border-border px-3 py-1.5 text-sm"
          >
            Schließen
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function SaveAsTemplateDialog({
  open,
  onOpenChange,
  defaultName,
  onConfirm,
  saving,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  defaultName: string;
  onConfirm: (v: { name: string; description: string | null; tags: string[]; note: string | null }) => void;
  saving?: boolean;
}) {
  const [name, setName] = useState(defaultName);
  const [description, setDescription] = useState("");
  const [tagsRaw, setTagsRaw] = useState("");
  const [note, setNote] = useState("");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Als Vorlage speichern</DialogTitle>
          <DialogDescription>
            Speichert die aktuelle Struktur als wiederverwendbare Vorlage. Bereits zugewiesene Athletenpläne bleiben unverändert.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Beschreibung</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              placeholder="Optional — für wen, welches Ziel?"
            />
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Tags (Komma getrennt)</label>
            <input
              value={tagsRaw}
              onChange={(e) => setTagsRaw(e.target.value)}
              className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              placeholder="Hypertrophie, PPL, 4x/Woche"
            />
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Versions-Notiz</label>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              placeholder="z.B. Kniebeuge durch Beinpresse ersetzt"
            />
          </div>
        </div>

        <DialogFooter>
          <button
            onClick={() => onOpenChange(false)}
            className="rounded-md border border-border px-3 py-1.5 text-sm"
            disabled={saving}
          >
            Abbrechen
          </button>
          <button
            onClick={() =>
              onConfirm({
                name: name.trim() || defaultName,
                description: description.trim() || null,
                tags: tagsRaw.split(",").map((s) => s.trim()).filter(Boolean),
                note: note.trim() || null,
              })
            }
            disabled={saving || !name.trim()}
            className="rounded-md bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
          >
            {saving ? "Speichere…" : "Vorlage speichern"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
