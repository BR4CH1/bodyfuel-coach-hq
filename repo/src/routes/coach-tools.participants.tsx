import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/bodyfuel/session";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Trash2, Plus, X, Check } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/coach-tools/participants")({
  head: () => ({ meta: [{ title: "Teilnehmerliste — Coach Tools" }] }),
  component: ParticipantsPage,
});

type P = { id: string; name: string; notes: string | null; is_active: boolean };
type A = { participant_id: string; present: boolean };

const today = () => new Date().toISOString().slice(0, 10);

function ParticipantsPage() {
  const { supabaseUser } = useSession();
  const [items, setItems] = useState<P[]>([]);
  const [attendance, setAttendance] = useState<Record<string, boolean>>({});
  const [showForm, setShowForm] = useState(false);
  const [date, setDate] = useState(today());
  const [editing, setEditing] = useState<P | null>(null);

  const load = async () => {
    const [{ data: parts }, { data: att }] = await Promise.all([
      supabase.from("course_participants").select("*").order("name"),
      supabase.from("course_attendance").select("participant_id, present").eq("session_date", date),
    ]);
    setItems((parts ?? []) as any);
    const map: Record<string, boolean> = {};
    (att ?? []).forEach((a: any) => { map[a.participant_id] = a.present; });
    setAttendance(map);
  };
  useEffect(() => { load(); }, [date]); // eslint-disable-line

  const toggle = async (p: P) => {
    if (!supabaseUser) return;
    const next = !attendance[p.id];
    setAttendance((m) => ({ ...m, [p.id]: next }));
    await supabase.from("course_attendance").upsert(
      { owner_id: supabaseUser.id, participant_id: p.id, session_date: date, present: next },
      { onConflict: "owner_id,participant_id,session_date" }
    );
  };

  const del = async (id: string) => {
    if (!confirm("Teilnehmer entfernen?")) return;
    await supabase.from("course_participants").delete().eq("id", id);
    load();
  };

  const presentCount = Object.values(attendance).filter(Boolean).length;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-widest text-gold">Coach Tools</div>
          <h1 className="font-display text-2xl font-bold">Teilnehmerliste</h1>
          <p className="text-sm text-muted-foreground">{presentCount} von {items.length} anwesend</p>
        </div>
        <div className="flex items-end gap-2">
          <div>
            <Label className="text-xs">Datum</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <Button onClick={() => setShowForm(true)} className="bg-gradient-gold"><Plus className="mr-2 h-4 w-4" /> Neu</Button>
        </div>
      </header>

      <div className="space-y-2">
        {items.map((p) => {
          const present = !!attendance[p.id];
          return (
            <div key={p.id} className="flex items-center gap-3 rounded-2xl border border-border bg-card/60 p-3 backdrop-blur">
              <button
                onClick={() => toggle(p)}
                className={`grid h-10 w-10 shrink-0 place-items-center rounded-lg border-2 transition ${
                  present ? "border-emerald-500 bg-emerald-500/20 text-emerald-400" : "border-border text-muted-foreground"
                }`}
                aria-label={present ? "Anwesend" : "Abwesend"}
              >
                {present && <Check className="h-5 w-5" />}
              </button>
              <button onClick={() => setEditing(p)} className="min-w-0 flex-1 text-left">
                <div className="font-medium">{p.name}</div>
                {p.notes && <div className="truncate text-xs text-muted-foreground">{p.notes}</div>}
              </button>
              <button onClick={() => del(p.id)} className="p-2 text-muted-foreground hover:text-red-500">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          );
        })}
        {items.length === 0 && (
          <div className="rounded-2xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
            Noch keine Teilnehmer. Lege den ersten Eintrag an.
          </div>
        )}
      </div>

      {showForm && <ParticipantForm onClose={() => { setShowForm(false); load(); }} userId={supabaseUser?.id ?? ""} />}
      {editing && <ParticipantEdit p={editing} onClose={() => { setEditing(null); load(); }} />}
    </div>
  );
}

function ParticipantForm({ onClose, userId }: { onClose: () => void; userId: string }) {
  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");
  const save = async () => {
    if (!name.trim()) return toast.error("Name fehlt");
    const { error } = await supabase.from("course_participants").insert({ owner_id: userId, name: name.trim(), notes: notes || null });
    if (error) return toast.error(error.message);
    onClose();
  };
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-xl font-bold">Neuer Teilnehmer</h2>
          <button onClick={onClose}><X className="h-5 w-5" /></button>
        </div>
        <div className="grid gap-3">
          <div><Label>Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div><Label>Notiz (optional)</Label><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} /></div>
          <Button onClick={save} className="bg-gradient-gold">Speichern</Button>
        </div>
      </div>
    </div>
  );
}

function ParticipantEdit({ p, onClose }: { p: P; onClose: () => void }) {
  const [notes, setNotes] = useState(p.notes ?? "");
  const save = async () => {
    await supabase.from("course_participants").update({ notes: notes || null }).eq("id", p.id);
    toast.success("Notiz gespeichert");
    onClose();
  };
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-xl font-bold">{p.name}</h2>
          <button onClick={onClose}><X className="h-5 w-5" /></button>
        </div>
        <div className="grid gap-3">
          <div><Label>Notizen</Label><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={5} /></div>
          <Button onClick={save} className="bg-gradient-gold">Speichern</Button>
        </div>
      </div>
    </div>
  );
}
