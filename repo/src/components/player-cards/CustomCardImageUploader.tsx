/**
 * CustomCardImageUploader — Coach lädt ein fertiges Spielerkarten-Bild
 * für einen Athleten hoch. Bild wird im privaten Bucket
 * "player-card-images" unter Pfad "<user_id>/<file>" abgelegt und der
 * Pfad in player_cards.custom_card_image_url gespeichert.
 *
 * Der Athlet sieht die Karte klein im Home-Header (Klick → Zoom).
 */
import { useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Upload, Trash2, ImageIcon } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { saveCustomPlayerCardImage } from "@/lib/player-cards.functions";

export function CustomCardImageUploader({
  userId,
  currentPath,
  invalidateKey,
}: {
  userId: string;
  currentPath: string | null | undefined;
  invalidateKey: (string | number)[];
}) {
  const qc = useQueryClient();
  const saveFn = useServerFn(saveCustomPlayerCardImage);
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    setPreview(null);
    if (!currentPath) return;
    supabase.storage
      .from("player-card-images")
      .createSignedUrl(currentPath, 3600)
      .then(({ data }) => { if (alive && data?.signedUrl) setPreview(data.signedUrl); });
    return () => { alive = false; };
  }, [currentPath]);

  const save = useMutation({
    mutationFn: (storage_path: string | null) => saveFn({ data: { user_id: userId, storage_path } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: invalidateKey });
    },
  });

  async function handleFile(file: File) {
    if (!file.type.startsWith("image/")) {
      toast.error("Bitte ein Bild auswählen");
      return;
    }
    try {
      setBusy(true);
      const ext = file.name.split(".").pop() || "png";
      const path = `${userId}/card-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("player-card-images")
        .upload(path, file, { upsert: true, contentType: file.type });
      if (upErr) throw upErr;

      // Alte Datei aufräumen (best effort)
      if (currentPath && currentPath !== path) {
        await supabase.storage.from("player-card-images").remove([currentPath]).catch(() => {});
      }
      await save.mutateAsync(path);
      toast.success("Spielerkarte hochgeladen");
    } catch (e: any) {
      toast.error(e?.message ?? "Upload fehlgeschlagen");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function handleRemove() {
    if (!currentPath) return;
    try {
      setBusy(true);
      await supabase.storage.from("player-card-images").remove([currentPath]).catch(() => {});
      await save.mutateAsync(null);
      toast.success("Karten-Bild entfernt");
    } catch (e: any) {
      toast.error(e?.message ?? "Entfernen fehlgeschlagen");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
      <div>
        <div className="text-[10px] font-bold uppercase tracking-[0.3em] text-bulls-red">
          Fertige Spielerkarte hochladen
        </div>
        <div className="text-xs text-muted-foreground">
          Bild ersetzt die generierte Karte im Athleten-Dashboard.
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="grid h-24 w-16 place-items-center overflow-hidden rounded-lg border border-border bg-background">
          {preview ? (
            <img src={preview} alt="Spielerkarte" className="h-full w-full object-cover" />
          ) : (
            <ImageIcon className="h-5 w-5 text-muted-foreground" />
          )}
        </div>
        <div className="flex flex-1 flex-col gap-2">
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
            }}
          />
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={busy}
            className="inline-flex items-center justify-center gap-1.5 rounded-full bg-bulls-red px-4 py-2 text-xs font-bold uppercase tracking-wider text-white transition hover:opacity-90 disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
            {currentPath ? "Neues Bild wählen" : "Bild hochladen"}
          </button>
          {currentPath && (
            <button
              type="button"
              onClick={handleRemove}
              disabled={busy}
              className="inline-flex items-center justify-center gap-1.5 rounded-full border border-border bg-card px-4 py-2 text-xs font-semibold text-muted-foreground transition hover:border-destructive hover:text-destructive disabled:opacity-50"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Bild entfernen
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
