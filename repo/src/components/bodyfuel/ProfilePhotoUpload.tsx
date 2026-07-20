import { lazy, Suspense, useCallback, useRef, useState } from "react";
import type { Area } from "react-easy-crop";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Camera, Trash2, ZoomIn, ZoomOut, Loader2 } from "lucide-react";
import { UserAvatar, invalidateAvatarCache } from "./UserAvatar";

const ClientCropper = import.meta.env.SSR
  ? null
  : lazy(async () => {
      const module = await import("react-easy-crop");
      return { default: module.default };
    });

/**
 * Profilbild-Upload für BodyFuel Performance.
 *
 * - Speichert quadratischen Crop (400x400 JPEG) in `avatars` bucket unter
 *   "<user_id>/avatar.jpg".
 * - Aktualisiert `profiles.avatar_url` mit dem Pfad (NICHT der signed URL).
 * - Keine biometrische Erkennung — visuelles Face-Center ist rein UI-Vorschlag
 *   durch mittigen Default-Crop; der User verschiebt/zoomt selbst.
 */

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

async function getCroppedBlob(imageSrc: string, area: Area): Promise<Blob> {
  const img = new Image();
  img.crossOrigin = "anonymous";
  img.src = imageSrc;
  await new Promise<void>((res, rej) => {
    img.onload = () => res();
    img.onerror = () => rej(new Error("image load failed"));
  });
  const canvas = document.createElement("canvas");
  const size = 400;
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas ctx");
  ctx.drawImage(img, area.x, area.y, area.width, area.height, 0, 0, size, size);
  return await new Promise<Blob>((res, rej) =>
    canvas.toBlob((b) => (b ? res(b) : rej(new Error("blob failed"))), "image/jpeg", 0.9),
  );
}

export function ProfilePhotoUpload({
  userId,
  currentPath,
  displayName,
  onChange,
}: {
  userId: string;
  currentPath: string | null;
  displayName: string | null;
  onChange: (newPath: string | null) => void;
}) {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [imgSrc, setImgSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [area, setArea] = useState<Area | null>(null);
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);

  const onFile = (f: File | null) => {
    if (!f) return;
    if (!f.type.startsWith("image/")) {
      toast.error("Bitte ein Bild auswählen");
      return;
    }
    if (f.size > 8 * 1024 * 1024) {
      toast.error("Bild ist zu groß (max. 8 MB)");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setImgSrc(String(reader.result));
      setCrop({ x: 0, y: 0 });
      setZoom(1);
    };
    reader.readAsDataURL(f);
  };

  const onComplete = useCallback((_: Area, pixels: Area) => setArea(pixels), []);

  const save = async () => {
    if (!imgSrc || !area) return;
    setSaving(true);
    try {
      const blob = await getCroppedBlob(imgSrc, area);
      const path = `${userId}/avatar.jpg`;
      const { error: upErr } = await supabase.storage
        .from("avatars")
        .upload(path, blob, { upsert: true, contentType: "image/jpeg", cacheControl: "0" });
      if (upErr) throw upErr;
      const { error: pErr } = await supabase
        .from("profiles")
        .update({ avatar_url: path })
        .eq("id", userId);
      if (pErr) throw pErr;
      invalidateAvatarCache(path);
      onChange(path);
      setImgSrc(null);
      toast.success("Profilbild aktualisiert");
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, "Upload fehlgeschlagen"));
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    setRemoving(true);
    try {
      if (currentPath) {
        await supabase.storage.from("avatars").remove([currentPath]);
        invalidateAvatarCache(currentPath);
      }
      const { error } = await supabase
        .from("profiles")
        .update({ avatar_url: null })
        .eq("id", userId);
      if (error) throw error;
      onChange(null);
      toast.success("Profilbild entfernt");
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, "Entfernen fehlgeschlagen"));
    } finally {
      setRemoving(false);
    }
  };

  return (
    <section className="rounded-2xl border border-border bg-card p-6">
      <h2 className="font-display text-lg font-bold">Profilbild</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        Nutze am besten ein Foto, auf dem dein Gesicht gut erkennbar ist. So können Coaches und
        Medical dich schneller zuordnen. Kein Passfoto-Zwang.
      </p>

      {!imgSrc && (
        <div className="mt-4 flex items-center gap-4">
          <UserAvatar path={currentPath} name={displayName} size={80} />
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium hover:bg-muted"
            >
              <Camera className="h-3.5 w-3.5" />
              {currentPath ? "Foto ändern" : "Foto hinzufügen"}
            </button>
            {currentPath && (
              <button
                type="button"
                onClick={remove}
                disabled={removing}
                className="inline-flex items-center gap-1.5 rounded-lg border border-destructive/30 bg-background px-3 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/10 disabled:opacity-50"
              >
                {removing ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Trash2 className="h-3.5 w-3.5" />
                )}
                Foto entfernen
              </button>
            )}
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => onFile(e.target.files?.[0] ?? null)}
          />
        </div>
      )}

      {imgSrc && (
        <div className="mt-4 space-y-3">
          <div className="relative h-72 w-full overflow-hidden rounded-xl bg-black">
            {ClientCropper ? (
              <Suspense fallback={<div className="h-full w-full animate-pulse bg-muted" />}>
                <ClientCropper
                  image={imgSrc}
                  crop={crop}
                  zoom={zoom}
                  aspect={1}
                  cropShape="round"
                  showGrid={false}
                  onCropChange={setCrop}
                  onZoomChange={setZoom}
                  onCropComplete={onComplete}
                />
              </Suspense>
            ) : (
              <div className="h-full w-full bg-black" />
            )}
          </div>
          <div className="flex items-center gap-2">
            <ZoomOut className="h-4 w-4 text-muted-foreground" />
            <input
              type="range"
              min={1}
              max={3}
              step={0.05}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              className="flex-1"
              aria-label="Zoom"
            />
            <ZoomIn className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setImgSrc(null)}
              className="rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium hover:bg-muted"
            >
              Abbrechen
            </button>
            <button
              type="button"
              onClick={save}
              disabled={saving}
              className="inline-flex items-center gap-1.5 rounded-lg bg-gold px-3 py-1.5 text-xs font-semibold text-black hover:opacity-90 disabled:opacity-50"
            >
              {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Speichern
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
