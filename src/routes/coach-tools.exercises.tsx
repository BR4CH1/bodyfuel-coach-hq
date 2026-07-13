import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/bodyfuel/session";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Star, Trash2, Search, Plus, X } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/coach-tools/exercises")({
  head: () => ({ meta: [{ title: "Übungsbibliothek — Coach Tools" }] }),
  component: ExercisesPage,
});

type Ex = {
  id: string;
  name: string;
  description: string | null;
  coaching_cues: string | null;
  muscle_groups: string[];
  equipment: string[];
  difficulty: string;
  media_url: string | null;
  is_favorite: boolean;
  is_public: boolean;
  owner_id: string;
};

function ExercisesPage() {
  const { supabaseUser } = useSession();
  const [items, setItems] = useState<Ex[]>([]);
  const [q, setQ] = useState("");
  const [favOnly, setFavOnly] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const load = async () => {
    const { data } = await supabase
      .from("course_exercises")
      .select("*")
      .order("is_favorite", { ascending: false })
      .order("name", { ascending: true });
    setItems((data ?? []) as Ex[]);
  };
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return items.filter((it) => {
      if (favOnly && !it.is_favorite) return false;
      if (!needle) return true;
      return [it.name, it.description, it.coaching_cues, ...it.muscle_groups, ...it.equipment]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(needle));
    });
  }, [items, q, favOnly]);

  const toggleFav = async (ex: Ex) => {
    await supabase.from("course_exercises").update({ is_favorite: !ex.is_favorite }).eq("id", ex.id);
    load();
  };

  const del = async (id: string) => {
    if (!confirm("Übung löschen?")) return;
    await supabase.from("course_exercises").delete().eq("id", id);
    load();
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-widest text-gold">Coach Tools</div>
          <h1 className="font-display text-2xl font-bold">Übungsbibliothek</h1>
        </div>
        <Button onClick={() => setShowForm(true)} className="bg-gradient-gold">
          <Plus className="mr-2 h-4 w-4" /> Übung anlegen
        </Button>
      </header>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Suche: Name, Muskel, Equipment…" className="pl-9" />
        </div>
        <button
          onClick={() => setFavOnly((v) => !v)}
          className={`rounded-full border px-4 py-2 text-sm ${favOnly ? "border-gold bg-gold/15 text-gold" : "border-border text-muted-foreground"}`}
        >
          ★ Favoriten
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {filtered.map((ex) => (
          <div key={ex.id} className="rounded-2xl border border-border bg-card/60 p-4 backdrop-blur">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="font-display text-lg font-bold">{ex.name}</div>
                <div className="mt-1 flex flex-wrap gap-1 text-[11px] text-muted-foreground">
                  {ex.muscle_groups.map((m) => <span key={m} className="rounded-full bg-background/60 px-2 py-0.5">{m}</span>)}
                  {ex.equipment.map((eq) => <span key={eq} className="rounded-full bg-background/60 px-2 py-0.5">{eq}</span>)}
                  <span className="rounded-full bg-background/60 px-2 py-0.5">{ex.difficulty}</span>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => toggleFav(ex)} aria-label="Favorit">
                  <Star className={`h-5 w-5 ${ex.is_favorite ? "fill-gold text-gold" : "text-muted-foreground"}`} />
                </button>
                {ex.owner_id === supabaseUser?.id && (
                  <button onClick={() => del(ex.id)} aria-label="Löschen">
                    <Trash2 className="h-4 w-4 text-muted-foreground hover:text-red-500" />
                  </button>
                )}
              </div>
            </div>
            {ex.description && <p className="mt-2 text-sm text-muted-foreground">{ex.description}</p>}
            {ex.coaching_cues && (
              <p className="mt-2 rounded-md bg-background/60 p-2 text-xs italic text-muted-foreground">
                💡 {ex.coaching_cues}
              </p>
            )}
            {ex.media_url && (
              <a href={ex.media_url} target="_blank" rel="noreferrer" className="mt-2 inline-block text-xs text-gold underline">
                Video / GIF öffnen
              </a>
            )}
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="col-span-full rounded-2xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
            Keine Übungen gefunden. Lege deine erste Übung an.
          </div>
        )}
      </div>

      {showForm && <ExerciseForm onClose={() => { setShowForm(false); load(); }} userId={supabaseUser?.id ?? ""} />}
    </div>
  );
}

function ExerciseForm({ onClose, userId }: { onClose: () => void; userId: string }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [cues, setCues] = useState("");
  const [muscles, setMuscles] = useState("");
  const [equipment, setEquipment] = useState("");
  const [difficulty, setDifficulty] = useState("medium");
  const [media, setMedia] = useState("");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!name.trim()) return toast.error("Name fehlt");
    setSaving(true);
    const { error } = await supabase.from("course_exercises").insert({
      owner_id: userId,
      name: name.trim(),
      description: description || null,
      coaching_cues: cues || null,
      muscle_groups: muscles.split(",").map((s) => s.trim()).filter(Boolean),
      equipment: equipment.split(",").map((s) => s.trim()).filter(Boolean),
      difficulty,
      media_url: media || null,
    });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Gespeichert");
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4">
      <div className="w-full max-w-lg rounded-2xl border border-border bg-card p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-xl font-bold">Neue Übung</h2>
          <button onClick={onClose}><X className="h-5 w-5" /></button>
        </div>
        <div className="grid gap-3">
          <div><Label>Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div><Label>Beschreibung</Label><Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} /></div>
          <div><Label>Coaching-Hinweise</Label><Textarea value={cues} onChange={(e) => setCues(e.target.value)} rows={2} /></div>
          <div><Label>Muskelgruppen (Komma)</Label><Input value={muscles} onChange={(e) => setMuscles(e.target.value)} placeholder="Beine, Rumpf" /></div>
          <div><Label>Equipment (Komma)</Label><Input value={equipment} onChange={(e) => setEquipment(e.target.value)} placeholder="Kurzhantel, Matte" /></div>
          <div>
            <Label>Schwierigkeit</Label>
            <select value={difficulty} onChange={(e) => setDifficulty(e.target.value)} className="mt-1 w-full rounded-md border border-border bg-background p-2 text-sm">
              <option value="easy">Leicht</option>
              <option value="medium">Mittel</option>
              <option value="hard">Schwer</option>
            </select>
          </div>
          <div><Label>Video/GIF-URL</Label><Input value={media} onChange={(e) => setMedia(e.target.value)} placeholder="https://…" /></div>
          <Button onClick={save} disabled={saving} className="bg-gradient-gold">{saving ? "Speichern…" : "Speichern"}</Button>
        </div>
      </div>
    </div>
  );
}
