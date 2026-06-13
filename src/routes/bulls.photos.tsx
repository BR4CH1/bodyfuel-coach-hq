import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ArrowLeft, Upload, Image as ImageIcon } from "lucide-react";
import { AppLayout } from "@/components/bodyfuel/AppLayout";
import { BullsGate } from "@/components/bodyfuel/BullsGate";
import { BullsHero } from "@/components/bodyfuel/BullsHero";

import { listProgressPhotos, saveProgressPhotoSet } from "@/lib/bulls.functions";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/bodyfuel/session";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/bulls/photos")({
  head: () => ({ meta: [{ title: "Fortschrittsfotos — Bulls Hub" }] }),
  component: () => (
    <AppLayout>
      <BullsGate>
        <PhotosPage />
      </BullsGate>
    </AppLayout>
  ),
});

function PhotosPage() {
  const { supabaseUser } = useSession();
  const qc = useQueryClient();
  const listFn = useServerFn(listProgressPhotos);
  const saveFn = useServerFn(saveProgressPhotoSet);
  const { data, isLoading } = useQuery({ queryKey: ["bulls-photos"], queryFn: () => listFn() });

  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [front, setFront] = useState<File | null>(null);
  const [side, setSide] = useState<File | null>(null);
  const [back, setBack] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  const upload = async (file: File | null, slot: string) => {
    if (!file || !supabaseUser) return null;
    const ext = file.name.split(".").pop() || "jpg";
    const path = `${supabaseUser.id}/${date}-${slot}-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("bulls-progress-photos").upload(path, file);
    if (error) throw new Error(error.message);
    return path;
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!front && !side && !back) return toast.error("Mindestens ein Foto auswählen.");
    setBusy(true);
    try {
      const [fp, sp, bp] = await Promise.all([
        upload(front, "front"),
        upload(side, "side"),
        upload(back, "back"),
      ]);
      await saveFn({ data: { photo_date: date, front_path: fp, side_path: sp, back_path: bp } });
      toast.success("Fotos gespeichert.");
      setFront(null); setSide(null); setBack(null);
      qc.invalidateQueries({ queryKey: ["bulls-photos"] });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const rows = (data as any[]) ?? [];

  return (
    <div className="space-y-6">
      <Link to="/bulls" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-bulls-red">
        <ArrowLeft className="h-3 w-3" /> Zurück zum Hub
      </Link>
      <BullsHero
        eyebrow="Fortschrittsfotos"
        title="Fortschrittsfotos (optional)"
        subtitle="Die Fotos sind nur für dich sichtbar."
      />

      <form onSubmit={submit} className="space-y-4 rounded-2xl border border-border bg-card p-5">
        <div className="space-y-2 max-w-xs">
          <Label>Datum</Label>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <PhotoSlot label="Front" file={front} onChange={setFront} />
          <PhotoSlot label="Seite" file={side} onChange={setSide} />
          <PhotoSlot label="Rücken" file={back} onChange={setBack} />
        </div>
        <Button type="submit" disabled={busy} className="bg-gradient-bulls text-white">
          <Upload className="mr-1 h-4 w-4" /> {busy ? "Lade hoch…" : "Speichern"}
        </Button>
      </form>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Lade…</p>
      ) : rows.length === 0 ? (
        <p className="rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground">
          Noch keine Fotos hochgeladen.
        </p>
      ) : (
        <div className="space-y-4">
          {rows.map((r) => (
            <div key={r.id} className="rounded-2xl border border-border bg-card p-4">
              <div className="mb-2 text-xs uppercase tracking-wider text-bulls-red">{r.photo_date}</div>
              <div className="grid gap-3 sm:grid-cols-3">
                <Thumb url={r.front_url} label="Front" />
                <Thumb url={r.side_url} label="Seite" />
                <Thumb url={r.back_url} label="Rücken" />
              </div>
            </div>
          ))}
        </div>
      )}

      
    </div>
  );
}

function PhotoSlot({ label, file, onChange }: { label: string; file: File | null; onChange: (f: File | null) => void }) {
  return (
    <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-secondary/30 p-5 text-center hover:border-bulls-red/60">
      <ImageIcon className="h-6 w-6 text-bulls-red" />
      <div className="text-sm font-semibold">{label}</div>
      <div className="text-[11px] text-muted-foreground">{file ? file.name : "Foto auswählen"}</div>
      <input
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => onChange(e.target.files?.[0] ?? null)}
      />
    </label>
  );
}

function Thumb({ url, label }: { url: string | null; label: string }) {
  return (
    <div>
      <div className="mb-1 text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
      {url ? (
        <a href={url} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-xl border border-border">
          <img src={url} alt={label} className="aspect-square w-full object-cover" />
        </a>
      ) : (
        <div className="grid aspect-square place-items-center rounded-xl border border-dashed border-border text-xs text-muted-foreground">—</div>
      )}
    </div>
  );
}
