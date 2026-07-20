import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/bodyfuel/session";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Music4, ExternalLink, Trash2, Star, Plus, X } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/coach-tools/music")({
  head: () => ({ meta: [{ title: "Musik & Playlists — Coach Tools" }] }),
  component: MusicPage,
});

type Link = {
  id: string;
  title: string;
  url: string;
  provider: string;
  bpm: number | null;
  tags: string[];
  is_favorite: boolean;
};

const PROVIDERS = [
  { key: "spotify", label: "Spotify" },
  { key: "apple", label: "Apple Music" },
  { key: "youtube", label: "YouTube" },
  { key: "other", label: "Sonstiges" },
];

function detectProvider(url: string): string {
  if (/spotify\.com/.test(url)) return "spotify";
  if (/music\.apple\.com/.test(url)) return "apple";
  if (/youtube\.com|youtu\.be/.test(url)) return "youtube";
  return "other";
}

function MusicPage() {
  const { supabaseUser } = useSession();
  const [items, setItems] = useState<Link[]>([]);
  const [showForm, setShowForm] = useState(false);

  const load = async () => {
    const { data } = await supabase.from("course_music_links").select("*").order("is_favorite", { ascending: false }).order("title");
    setItems((data ?? []) as any);
  };
  useEffect(() => { load(); }, []);

  const del = async (id: string) => { await supabase.from("course_music_links").delete().eq("id", id); load(); };
  const toggleFav = async (l: Link) => { await supabase.from("course_music_links").update({ is_favorite: !l.is_favorite }).eq("id", l.id); load(); };

  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-widest text-gold">Coach Tools</div>
          <h1 className="font-display text-2xl font-bold">Musik & Playlists</h1>
          <p className="text-sm text-muted-foreground">Spotify · Apple Music · YouTube — mit einem Klick öffnen.</p>
        </div>
        <Button onClick={() => setShowForm(true)} className="bg-gradient-gold"><Plus className="mr-2 h-4 w-4" /> Link hinzufügen</Button>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {items.map((l) => (
          <div key={l.id} className="rounded-2xl border border-border bg-card/60 p-4 backdrop-blur">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-start gap-3">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gold/15">
                  <Music4 className="h-5 w-5 text-gold" />
                </div>
                <div>
                  <div className="font-display font-bold">{l.title}</div>
                  <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
                    {PROVIDERS.find((p) => p.key === l.provider)?.label ?? l.provider}
                    {l.bpm ? ` · ${l.bpm} BPM` : ""}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => toggleFav(l)}><Star className={`h-4 w-4 ${l.is_favorite ? "fill-gold text-gold" : "text-muted-foreground"}`} /></button>
                <button onClick={() => del(l.id)}><Trash2 className="h-4 w-4 text-muted-foreground hover:text-red-500" /></button>
              </div>
            </div>
            {l.tags?.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {l.tags.map((t) => <span key={t} className="rounded-full bg-background/60 px-2 py-0.5 text-[10px] text-muted-foreground">#{t}</span>)}
              </div>
            )}
            <a href={l.url} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1 text-xs text-gold underline">
              Öffnen <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        ))}
        {items.length === 0 && (
          <div className="col-span-full rounded-2xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
            Noch keine Playlists. Speichere deine Lieblings-Links für schnellen Zugriff im Kurs.
          </div>
        )}
      </div>

      {showForm && <MusicForm onClose={() => { setShowForm(false); load(); }} userId={supabaseUser?.id ?? ""} />}
    </div>
  );
}

function MusicForm({ onClose, userId }: { onClose: () => void; userId: string }) {
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [bpm, setBpm] = useState<string>("");
  const [tags, setTags] = useState("");

  const save = async () => {
    if (!title.trim() || !url.trim()) return toast.error("Titel und URL fehlen");
    const { error } = await supabase.from("course_music_links").insert({
      owner_id: userId,
      title: title.trim(),
      url: url.trim(),
      provider: detectProvider(url),
      bpm: bpm ? Number(bpm) : null,
      tags: tags.split(",").map((s) => s.trim()).filter(Boolean),
    });
    if (error) return toast.error(error.message);
    toast.success("Gespeichert");
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-xl font-bold">Playlist / Song hinzufügen</h2>
          <button onClick={onClose}><X className="h-5 w-5" /></button>
        </div>
        <div className="grid gap-3">
          <div><Label>Titel</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Sommer-HIIT Vol. 1" /></div>
          <div><Label>URL</Label><Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://open.spotify.com/…" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>BPM (optional)</Label><Input type="number" value={bpm} onChange={(e) => setBpm(e.target.value)} /></div>
            <div><Label>Tags (Komma)</Label><Input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="warmup, hiit" /></div>
          </div>
          <Button onClick={save} className="bg-gradient-gold">Speichern</Button>
        </div>
      </div>
    </div>
  );
}
