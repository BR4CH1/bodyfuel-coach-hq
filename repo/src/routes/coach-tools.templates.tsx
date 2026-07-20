import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/bodyfuel/session";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Star, Trash2, Play, Plus, X } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/coach-tools/templates")({
  head: () => ({ meta: [{ title: "Kursvorlagen — Coach Tools" }] }),
  component: TemplatesPage,
});

type Tpl = {
  id: string;
  name: string;
  description: string | null;
  duration_minutes: number | null;
  target_group: string | null;
  equipment: string[];
  blocks: any[];
  is_favorite: boolean;
};

function TemplatesPage() {
  const { supabaseUser } = useSession();
  const navigate = useNavigate();
  const [items, setItems] = useState<Tpl[]>([]);
  const [showForm, setShowForm] = useState(false);

  const load = async () => {
    const { data } = await supabase.from("course_templates").select("*").order("is_favorite", { ascending: false }).order("updated_at", { ascending: false });
    setItems((data ?? []) as any);
  };
  useEffect(() => { load(); }, []);

  const del = async (id: string) => {
    if (!confirm("Vorlage löschen?")) return;
    await supabase.from("course_templates").delete().eq("id", id);
    load();
  };
  const toggleFav = async (t: Tpl) => {
    await supabase.from("course_templates").update({ is_favorite: !t.is_favorite }).eq("id", t.id);
    load();
  };

  const startLive = (t: Tpl) => {
    // Client-seitige Navigation (kein window.location.href): sonst geht bei
    // hartem Reload der aktive Org-Kontext (localStorage) auf dem SSR-Rendering
    // durch die Query-Gate-Logik verloren und die Coach-Tools-Layout leitet
    // fälschlich in den Default-Org-Kontext um.
    sessionStorage.setItem("coach-tools:live-template", JSON.stringify(t));
    navigate({ to: "/coach-tools/live" });
  };

  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-widest text-gold">Coach Tools</div>
          <h1 className="font-display text-2xl font-bold">Kursvorlagen</h1>
        </div>
        <Button onClick={() => setShowForm(true)} className="bg-gradient-gold">
          <Plus className="mr-2 h-4 w-4" /> Neue Vorlage
        </Button>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {items.map((t) => (
          <div key={t.id} className="rounded-2xl border border-border bg-card/60 p-4 backdrop-blur">
            <div className="flex items-start justify-between">
              <div>
                <div className="font-display text-lg font-bold">{t.name}</div>
                <div className="text-xs text-muted-foreground">
                  {t.duration_minutes ?? "?"} min · {t.blocks?.length ?? 0} Blöcke
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => toggleFav(t)}><Star className={`h-5 w-5 ${t.is_favorite ? "fill-gold text-gold" : "text-muted-foreground"}`} /></button>
                <button onClick={() => del(t.id)}><Trash2 className="h-4 w-4 text-muted-foreground hover:text-red-500" /></button>
              </div>
            </div>
            {t.target_group && <p className="mt-2 text-xs text-muted-foreground">👥 {t.target_group}</p>}
            {t.description && <p className="mt-1 text-sm text-muted-foreground line-clamp-2">{t.description}</p>}
            <div className="mt-3 flex gap-2">
              <Button size="sm" onClick={() => startLive(t)} className="bg-gradient-gold">
                <Play className="mr-2 h-3 w-3" /> Live starten
              </Button>
            </div>
          </div>
        ))}
        {items.length === 0 && (
          <div className="col-span-full rounded-2xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
            Noch keine Vorlagen. Lege eine an oder generiere eine mit der <Link to="/coach-tools/ai" className="text-gold underline">KI</Link>.
          </div>
        )}
      </div>

      {showForm && <TemplateForm onClose={() => { setShowForm(false); load(); }} userId={supabaseUser?.id ?? ""} />}
    </div>
  );
}

function TemplateForm({ onClose, userId }: { onClose: () => void; userId: string }) {
  const [name, setName] = useState("");
  const [target, setTarget] = useState("");
  const [duration, setDuration] = useState(45);
  const [notes, setNotes] = useState("");

  const save = async () => {
    if (!name.trim()) return toast.error("Name fehlt");
    const { error } = await supabase.from("course_templates").insert({
      owner_id: userId,
      name: name.trim(),
      description: notes || null,
      duration_minutes: duration,
      target_group: target || null,
      blocks: [],
    });
    if (error) return toast.error(error.message);
    toast.success("Vorlage angelegt");
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-xl font-bold">Neue Vorlage</h2>
          <button onClick={onClose}><X className="h-5 w-5" /></button>
        </div>
        <div className="grid gap-3">
          <div><Label>Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div><Label>Zielgruppe</Label><Input value={target} onChange={(e) => setTarget(e.target.value)} /></div>
          <div><Label>Dauer (Min)</Label><Input type="number" value={duration} onChange={(e) => setDuration(Number(e.target.value) || 45)} /></div>
          <div><Label>Notizen</Label><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} /></div>
          <p className="text-xs text-muted-foreground">Blöcke kannst du am schnellsten über den <Link to="/coach-tools/ai" className="text-gold underline">KI-Generator</Link> hinzufügen.</p>
          <Button onClick={save} className="bg-gradient-gold">Speichern</Button>
        </div>
      </div>
    </div>
  );
}
