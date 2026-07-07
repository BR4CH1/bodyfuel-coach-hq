import { useMemo, useState } from "react";
import { ListChecks, Plus, Trash2, Pencil, X } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { CoachAthleteDetail } from "@/lib/organizations/coach-athlete-drilldown.functions";
import {
  createAthleteTask,
  updateAthleteTask,
  deleteAthleteTask,
} from "@/lib/organizations/coach-athlete-tasks.functions";
import { Section, TinyStat } from "./athlete-tab-shared";

type Filter = "all" | "open" | "done" | "missed";

type TaskRow = CoachAthleteDetail["training"]["timeline"][number];

export function AthleteTasksTab({
  data,
  orgId,
  userId,
}: {
  data: CoachAthleteDetail;
  orgId: string;
  userId: string;
}) {
  const [filter, setFilter] = useState<Filter>("all");
  const [dialog, setDialog] = useState<null | { mode: "create" } | { mode: "edit"; row: TaskRow }>(
    null,
  );
  const qc = useQueryClient();
  const t = data.training;

  const createFn = useServerFn(createAthleteTask);
  const updateFn = useServerFn(updateAthleteTask);
  const deleteFn = useServerFn(deleteAthleteTask);

  const invalidate = () =>
    qc.invalidateQueries({ queryKey: ["coach-athlete-detail", orgId, userId] });

  const statusMut = useMutation({
    mutationFn: (v: { id: string; status: "open" | "done" | "missed" }) =>
      updateFn({ data: { taskId: v.id, orgId, patch: { status: v.status } } }),
    onSuccess: () => {
      invalidate();
      toast.success("Status aktualisiert.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { taskId: id, orgId } }),
    onSuccess: () => {
      invalidate();
      toast.success("Aufgabe gelöscht.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const filtered = useMemo(() => {
    if (filter === "all") return t.timeline;
    return t.timeline.filter((i) => i.status === filter);
  }, [t.timeline, filter]);

  return (
    <div className="space-y-4">
      <Section title="Aufgaben · letzte 30 Tage" icon={<ListChecks className="h-4 w-4" />}>
        <div className="grid grid-cols-4 gap-2">
          <TinyStat label="Zugewiesen" value={t.assigned} />
          <TinyStat label="Abgeschl." value={t.done} tone="green" />
          <TinyStat label="Offen" value={t.open} tone="yellow" />
          <TinyStat label="Ausgel." value={t.missed} tone="red" />
        </div>
      </Section>

      <div className="flex items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1.5">
          {(
            [
              ["all", "Alle"],
              ["open", "Offen"],
              ["done", "Erledigt"],
              ["missed", "Überfällig"],
            ] as Array<[Filter, string]>
          ).map(([k, label]) => (
            <button
              key={k}
              onClick={() => setFilter(k)}
              className={`rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${
                filter === k
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted-foreground"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setDialog({ mode: "create" })}
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-primary-foreground"
        >
          <Plus className="h-3.5 w-3.5" />
          Aufgabe
        </button>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-4 text-xs text-muted-foreground">
          Keine Aufgaben in diesem Filter.
        </div>
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border bg-card">
          {filtered.map((item) => {
            const dateStr = new Date(item.date).toLocaleDateString("de-DE", {
              day: "2-digit",
              month: "2-digit",
              year: "2-digit",
            });
            const statusLabel =
              item.status === "done"
                ? "Erledigt"
                : item.status === "missed"
                ? "Überfällig"
                : item.status === "open"
                ? "Offen"
                : "—";
            const statusCls =
              item.status === "done"
                ? "text-green-500"
                : item.status === "missed"
                ? "text-red-500"
                : "text-yellow-600";
            return (
              <li key={item.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold">{item.title}</div>
                  <div className="text-[11px] text-muted-foreground">
                    Fällig: {dateStr} ·{" "}
                    <span className={`font-bold uppercase tracking-wider ${statusCls}`}>
                      {statusLabel}
                    </span>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  {item.status !== "done" && (
                    <button
                      type="button"
                      onClick={() => statusMut.mutate({ id: item.id, status: "done" })}
                      className="rounded-md border border-border px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-green-600 hover:bg-green-500/10"
                      title="Als erledigt markieren"
                    >
                      ✓
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setDialog({ mode: "edit", row: item })}
                    className="rounded-md border border-border p-1.5 text-muted-foreground hover:text-foreground"
                    title="Bearbeiten"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm("Aufgabe wirklich löschen?")) deleteMut.mutate(item.id);
                    }}
                    className="rounded-md border border-border p-1.5 text-destructive hover:bg-destructive/10"
                    title="Löschen"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {dialog && (
        <TaskDialog
          initial={dialog.mode === "edit" ? dialog.row : null}
          onClose={() => setDialog(null)}
          onSubmit={async (values) => {
            try {
              if (dialog.mode === "create") {
                await createFn({
                  data: {
                    orgId,
                    userId,
                    title: values.title,
                    scheduledFor: values.scheduledFor,
                    taskType: "custom",
                  },
                });
                toast.success("Aufgabe erstellt.");
              } else {
                await updateFn({
                  data: {
                    taskId: dialog.row.id,
                    orgId,
                    patch: { title: values.title, scheduledFor: values.scheduledFor },
                  },
                });
                toast.success("Aufgabe aktualisiert.");
              }
              invalidate();
              setDialog(null);
            } catch (e) {
              toast.error((e as Error).message);
            }
          }}
        />
      )}
    </div>
  );
}

function TaskDialog({
  initial,
  onClose,
  onSubmit,
}: {
  initial: TaskRow | null;
  onClose: () => void;
  onSubmit: (v: { title: string; scheduledFor: string }) => Promise<void>;
}) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [date, setDate] = useState(() => {
    const base = initial ? new Date(initial.date) : new Date();
    // yyyy-mm-dd
    return base.toISOString().slice(0, 10);
  });
  const [busy, setBusy] = useState(false);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-lg border border-border bg-card p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="font-display text-base font-bold uppercase tracking-tight">
            {initial ? "Aufgabe bearbeiten" : "Neue Aufgabe"}
          </h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4 space-y-3">
          <label className="block">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Titel
            </span>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Mobility Routine durchführen"
              className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              maxLength={200}
            />
          </label>
          <label className="block">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Fällig am
            </span>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            />
          </label>
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-border px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground"
          >
            Abbrechen
          </button>
          <button
            type="button"
            disabled={busy || title.trim().length === 0}
            onClick={async () => {
              setBusy(true);
              await onSubmit({
                title: title.trim(),
                scheduledFor: new Date(date + "T12:00:00").toISOString(),
              });
              setBusy(false);
            }}
            className="rounded-md bg-primary px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-primary-foreground disabled:opacity-50"
          >
            {busy ? "Speichert…" : "Speichern"}
          </button>
        </div>
      </div>
    </div>
  );
}
