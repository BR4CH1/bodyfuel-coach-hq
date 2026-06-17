import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Camera, Loader2, Trash2, Upload, Info } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  listProgressPhotos,
  registerProgressPhoto,
  deleteProgressPhoto,
  type ProgressPose,
} from "@/lib/progress-photos.functions";

const POSE_LABEL: Record<ProgressPose, string> = {
  front: "Vorne",
  side_left: "Seite links",
  side_right: "Seite rechts",
  back: "Hinten",
};

const POSE_RULES: Record<ProgressPose, string[]> = {
  front: [
    "Gerade stehen",
    "Füße schulterbreit",
    "Arme locker neben dem Körper",
    "Blick geradeaus",
    "Bauch nicht einziehen",
    "Normale Haltung",
  ],
  side_left: [
    "Körper 90° zur Kamera",
    "Arme locker hängen lassen",
    "Normale Haltung",
    "Brust nicht rausdrücken",
  ],
  side_right: [
    "Körper 90° zur Kamera",
    "Arme locker hängen lassen",
    "Normale Haltung",
    "Brust nicht rausdrücken",
  ],
  back: [
    "Rücken zur Kamera",
    "Füße schulterbreit",
    "Arme locker",
    "Schulterblätter entspannt",
  ],
};

const GENERAL_RULES = [
  "Immer gleiche Uhrzeit (morgens nach dem Toilettengang)",
  "Nüchtern",
  "Gleiches Licht",
  "Gleicher Abstand zur Kamera",
  "Gleiche Kleidung (Männer: kurze Sporthose · Frauen: Sport-BH + kurze Sporthose)",
  "Gleicher Hintergrund",
  "Alle 4 Wochen",
];

export function ProgressPhotosCard({
  userId,
  readOnly = false,
}: {
  userId: string;
  readOnly?: boolean;
}) {
  const qc = useQueryClient();
  const listFn = useServerFn(listProgressPhotos);
  const regFn = useServerFn(registerProgressPhoto);
  const delFn = useServerFn(deleteProgressPhoto);

  const queryKey = ["progress-photos", userId];
  const { data: photos = [], isLoading } = useQuery({
    queryKey,
    queryFn: () => listFn({ data: { userId } }),
    enabled: !!userId,
  });

  const [showRules, setShowRules] = useState(false);

  const handleUpload = async (pose: ProgressPose, file: File) => {
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${userId}/${Date.now()}-${pose}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("progress-photos")
        .upload(path, file, { upsert: false, contentType: file.type });
      if (upErr) throw upErr;
      await regFn({ data: { file_path: path, pose } });
      qc.invalidateQueries({ queryKey });
      toast.success(`${POSE_LABEL[pose]} hochgeladen`);
    } catch (e: any) {
      toast.error(e?.message ?? "Upload fehlgeschlagen");
    }
  };

  const del = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey }),
  });

  // Group by taken_on
  const byDate: Record<string, typeof photos> = {};
  for (const p of photos) {
    (byDate[p.taken_on] ??= []).push(p);
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Camera className="h-5 w-5 text-gold" />
          <h2 className="font-display text-lg font-bold">Fortschrittsfotos</h2>
        </div>
        <button
          onClick={() => setShowRules((s) => !s)}
          className="inline-flex items-center gap-1 rounded-md border border-border bg-background/60 px-2 py-1 text-[11px] text-muted-foreground hover:border-gold/50 hover:text-gold"
        >
          <Info className="h-3 w-3" /> Regeln
        </button>
      </div>

      {showRules && (
        <div className="mb-4 space-y-2 rounded-xl border border-border bg-background/40 p-3 text-xs">
          <div className="font-bold text-gold">Allgemein</div>
          <ul className="ml-4 list-disc text-muted-foreground">
            {GENERAL_RULES.map((r) => <li key={r}>{r}</li>)}
          </ul>
        </div>
      )}

      {!readOnly && (
        <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {(Object.keys(POSE_LABEL) as ProgressPose[]).map((pose) => (
            <PoseUpload key={pose} pose={pose} onPick={(f) => handleUpload(pose, f)} />
          ))}
        </div>
      )}

      {isLoading ? (
        <div className="text-sm text-muted-foreground">Lade…</div>
      ) : photos.length === 0 ? (
        <div className="rounded-xl bg-background/40 p-4 text-sm text-muted-foreground">
          Noch keine Fotos. Lade alle 4 Wochen ein Set hoch (Vorne, Seite L+R, Hinten).
        </div>
      ) : (
        <div className="space-y-4">
          {Object.entries(byDate).map(([date, set]) => (
            <div key={date}>
              <div className="mb-2 text-[11px] uppercase tracking-wider text-muted-foreground">
                {new Date(date).toLocaleDateString("de-DE")}
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {set.map((p) => (
                  <div key={p.id} className="relative overflow-hidden rounded-lg border border-border bg-background/40">
                    {p.url ? (
                      <img src={p.url} alt={POSE_LABEL[p.pose]} className="aspect-[3/4] w-full object-cover" />
                    ) : (
                      <div className="aspect-[3/4] w-full bg-secondary" />
                    )}
                    <div className="absolute left-1 top-1 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-bold text-white">
                      {POSE_LABEL[p.pose]}
                    </div>
                    {!readOnly && (
                      <button
                        onClick={() => del.mutate(p.id)}
                        className="absolute right-1 top-1 rounded bg-black/60 p-1 text-white hover:text-warning"
                        aria-label="Löschen"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function PoseUpload({ pose, onPick }: { pose: ProgressPose; onPick: (f: File) => void | Promise<void> }) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [showRules, setShowRules] = useState(false);

  const handle = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setBusy(true);
    try {
      await onPick(f);
    } finally {
      setBusy(false);
      if (ref.current) ref.current.value = "";
    }
  };

  return (
    <div className="rounded-xl border border-border bg-background/40 p-2">
      <div className="mb-1 flex items-center justify-between">
        <div className="text-xs font-semibold">{POSE_LABEL[pose]}</div>
        <button
          onClick={() => setShowRules((s) => !s)}
          className="text-[10px] text-muted-foreground hover:text-gold"
        >
          Regeln
        </button>
      </div>
      {showRules && (
        <ul className="mb-2 ml-3 list-disc text-[10px] text-muted-foreground">
          {POSE_RULES[pose].map((r) => <li key={r}>{r}</li>)}
        </ul>
      )}
      <input
        ref={ref}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handle}
        className="hidden"
      />
      <button
        onClick={() => ref.current?.click()}
        disabled={busy}
        className="inline-flex w-full items-center justify-center gap-1 rounded-md border border-dashed border-border bg-background/60 px-2 py-2 text-[11px] text-muted-foreground hover:border-gold/50 hover:text-gold disabled:opacity-60"
      >
        {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
        Hochladen
      </button>
    </div>
  );
}
