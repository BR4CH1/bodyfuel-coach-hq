import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { CheckSquare, MessageSquare, StickyNote, X, Trash2 } from "lucide-react";

import { createAthleteTask } from "@/lib/organizations/coach-athlete-tasks.functions";
import {
  sendOrgMessageToAthlete,
  createCoachAthleteNote,
  listCoachAthleteNotes,
  deleteCoachAthleteNote,
} from "@/lib/organizations/coach-athlete-actions.functions";

type Props = {
  orgId: string;
  userId: string;
  athleteName: string;
};

type Modal = "task" | "message" | "note" | null;

export function AthleteQuickActions({ orgId, userId, athleteName }: Props) {
  const [modal, setModal] = useState<Modal>(null);

  return (
    <>
      <div className="grid grid-cols-3 gap-2">
        <QuickBtn
          icon={<CheckSquare className="h-3.5 w-3.5" />}
          label="Aufgabe"
          onClick={() => setModal("task")}
        />
        <QuickBtn
          icon={<MessageSquare className="h-3.5 w-3.5" />}
          label="Nachricht"
          onClick={() => setModal("message")}
        />
        <QuickBtn
          icon={<StickyNote className="h-3.5 w-3.5" />}
          label="Notiz"
          onClick={() => setModal("note")}
        />
      </div>

      {modal === "task" && (
        <TaskDialog
          orgId={orgId}
          userId={userId}
          athleteName={athleteName}
          onClose={() => setModal(null)}
        />
      )}
      {modal === "message" && (
        <MessageDialog
          orgId={orgId}
          userId={userId}
          athleteName={athleteName}
          onClose={() => setModal(null)}
        />
      )}
      {modal === "note" && (
        <NoteDialog
          orgId={orgId}
          userId={userId}
          athleteName={athleteName}
          onClose={() => setModal(null)}
        />
      )}
    </>
  );
}

function QuickBtn({
  icon,
  label,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center justify-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-foreground hover:bg-muted/40"
    >
      {icon}
      {label}
    </button>
  );
}

function ModalShell({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-t-2xl border border-border bg-card p-4 shadow-xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-bold uppercase tracking-wider">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-md text-muted-foreground hover:bg-muted/40"
            aria-label="Schließen"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

/* ---------- Aufgabe ---------- */

function TaskDialog({
  orgId,
  userId,
  athleteName,
  onClose,
}: {
  orgId: string;
  userId: string;
  athleteName: string;
  onClose: () => void;
}) {
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [date, setDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const create = useServerFn(createAthleteTask);
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!title.trim()) return;
    setBusy(true);
    try {
      await create({
        data: {
          orgId,
          userId,
          title: title.trim(),
          subtitle: subtitle.trim() ? subtitle.trim() : null,
          scheduledFor: new Date(date + "T09:00:00").toISOString(),
          taskType: "custom",
        },
      });
      toast.success("Aufgabe erstellt.");
      qc.invalidateQueries({ queryKey: ["coach-athlete-detail", orgId, userId] });
      onClose();
      navigate({
        to: "/coach/teams/$orgId/athletes/$userId",
        params: { orgId, userId },
        search: { tab: "tasks" },
        replace: true,
      });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <ModalShell title={`Aufgabe für ${athleteName}`} onClose={onClose}>
      <div className="space-y-3">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Titel (z.B. „3× Sprint-Training diese Woche")"
          className="w-full rounded border border-border bg-background px-3 py-2 text-sm"
          autoFocus
        />
        <textarea
          value={subtitle}
          onChange={(e) => setSubtitle(e.target.value)}
          placeholder="Details (optional)"
          rows={3}
          className="w-full rounded border border-border bg-background px-3 py-2 text-sm"
        />
        <label className="block text-xs">
          <span className="text-muted-foreground">Fällig am</span>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="mt-1 w-full rounded border border-border bg-background px-3 py-2 text-sm"
          />
        </label>
        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-border px-3 py-1.5 text-xs font-semibold"
          >
            Abbrechen
          </button>
          <button
            type="button"
            disabled={!title.trim() || busy}
            onClick={submit}
            className="rounded bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground disabled:opacity-50"
          >
            {busy ? "Speichern…" : "Aufgabe erstellen"}
          </button>
        </div>
      </div>
    </ModalShell>
  );
}

/* ---------- Nachricht ---------- */

function MessageDialog({
  orgId,
  userId,
  athleteName,
  onClose,
}: {
  orgId: string;
  userId: string;
  athleteName: string;
  onClose: () => void;
}) {
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const send = useServerFn(sendOrgMessageToAthlete);

  async function submit() {
    if (!body.trim()) return;
    setBusy(true);
    try {
      await send({ data: { orgId, userId, body: body.trim() } });
      toast.success(`Nachricht an ${athleteName} gesendet.`);
      onClose();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <ModalShell title={`Nachricht an ${athleteName}`} onClose={onClose}>
      <div className="space-y-3">
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Deine Nachricht…"
          rows={5}
          autoFocus
          className="w-full rounded border border-border bg-background px-3 py-2 text-sm"
        />
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-border px-3 py-1.5 text-xs font-semibold"
          >
            Abbrechen
          </button>
          <button
            type="button"
            disabled={!body.trim() || busy}
            onClick={submit}
            className="rounded bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground disabled:opacity-50"
          >
            {busy ? "Senden…" : "Senden"}
          </button>
        </div>
      </div>
    </ModalShell>
  );
}

/* ---------- Notiz ---------- */

function NoteDialog({
  orgId,
  userId,
  athleteName,
  onClose,
}: {
  orgId: string;
  userId: string;
  athleteName: string;
  onClose: () => void;
}) {
  const [body, setBody] = useState("");
  const list = useServerFn(listCoachAthleteNotes);
  const create = useServerFn(createCoachAthleteNote);
  const del = useServerFn(deleteCoachAthleteNote);
  const qc = useQueryClient();
  const key = ["coach-athlete-notes", orgId, userId];

  const { data, isLoading } = useQuery({
    queryKey: key,
    queryFn: () => list({ data: { orgId, userId } }),
  });

  const createMut = useMutation({
    mutationFn: async () => {
      const b = body.trim();
      if (!b) throw new Error("Notiz darf nicht leer sein.");
      return create({ data: { orgId, userId, body: b } });
    },
    onSuccess: () => {
      setBody("");
      qc.invalidateQueries({ queryKey: key });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: async (noteId: string) => del({ data: { noteId } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
    onError: (e: Error) => toast.error(e.message),
  });

  const notes = data?.notes ?? [];

  return (
    <ModalShell title={`Notizen zu ${athleteName}`} onClose={onClose}>
      <div className="space-y-3">
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Neue Coach-Notiz (nur für Coaches sichtbar)"
          rows={3}
          className="w-full rounded border border-border bg-background px-3 py-2 text-sm"
        />
        <div className="flex justify-end">
          <button
            type="button"
            disabled={!body.trim() || createMut.isPending}
            onClick={() => createMut.mutate()}
            className="rounded bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground disabled:opacity-50"
          >
            {createMut.isPending ? "Speichern…" : "Notiz speichern"}
          </button>
        </div>

        <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
          {isLoading ? (
            <div className="text-xs text-muted-foreground">Notizen werden geladen…</div>
          ) : notes.length === 0 ? (
            <div className="rounded border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
              Noch keine Notizen.
            </div>
          ) : (
            notes.map((n) => (
              <div key={n.id} className="rounded-md border border-border bg-background p-2 text-sm">
                <div className="mb-1 flex items-center justify-between text-[10px] uppercase tracking-wider text-muted-foreground">
                  <span>
                    {n.author_name ?? "Coach"} · {new Date(n.created_at).toLocaleDateString("de-DE")}
                  </span>
                  {n.is_mine && (
                    <button
                      type="button"
                      onClick={() => deleteMut.mutate(n.id)}
                      className="text-muted-foreground hover:text-destructive"
                      aria-label="Notiz löschen"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  )}
                </div>
                <div className="whitespace-pre-wrap">{n.body}</div>
              </div>
            ))
          )}
        </div>
      </div>
    </ModalShell>
  );
}
