import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { updateExerciseMedia } from "@/lib/training-plan-builder.functions";
import type { LibraryExercise } from "@/lib/training-plan-builder.functions";
import { normalizeExerciseMedia, validateMediaInput } from "@/lib/exercise-media";
import { ExerciseMediaThumb } from "@/components/bodyfuel/ExerciseMediaThumb";

/**
 * Kompakte Coach-Medienpflege für eine Bibliotheksübung:
 * Vorschau, Thumbnail-URL, Animation/Video-URL, Quelle und Technikhinweis.
 * Kund:innen sehen diesen Dialog nicht — er lebt nur im Coach-Builder.
 */
export function ExerciseMediaEditorDialog({
  exercise,
  onClose,
  onSaved,
}: {
  exercise: LibraryExercise | null;
  onClose: () => void;
  onSaved?: () => void;
}) {
  const save = useServerFn(updateExerciseMedia);
  const [thumb, setThumb] = useState("");
  const [anim, setAnim] = useState("");
  const [source, setSource] = useState("");
  const [hint, setHint] = useState("");

  useEffect(() => {
    setThumb(exercise?.thumbnail_url ?? "");
    setAnim(exercise?.animation_url ?? "");
    setSource(exercise?.media_source ?? "");
    setHint(exercise?.technique_hint ?? "");
  }, [exercise?.id]);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!exercise) return;
      const check = validateMediaInput({ thumbnailUrl: thumb, animationUrl: anim });
      if (!check.ok) throw new Error(check.error);
      await save({
        data: {
          exerciseId: exercise.id,
          thumbnailUrl: thumb,
          animationUrl: anim,
          mediaSource: source,
          techniqueHint: hint,
        },
      });
    },
    onSuccess: () => {
      toast.success("Medien gespeichert");
      onSaved?.();
      onClose();
    },
    onError: (error: Error) => toast.error(error.message || "Speichern fehlgeschlagen"),
  });

  const preview = normalizeExerciseMedia({
    thumbnail_url: thumb,
    animation_url: anim,
    technique_hint: hint,
  });

  return (
    <Dialog open={!!exercise} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md gap-3 text-card-foreground">
        <DialogHeader>
          <DialogTitle className="text-left text-base font-black">
            Medien · {exercise?.name}
          </DialogTitle>
        </DialogHeader>

        <div className="flex items-center gap-3">
          <ExerciseMediaThumb
            media={preview}
            name={exercise?.name ?? ""}
            muscle={exercise?.primary_muscle}
            size={64}
          />
          <p className="text-[11px] leading-snug text-muted-foreground">
            Nur eigene oder lizenzierte Medien hinterlegen. Erlaubt: https-URLs oder Storage-Pfade
            (jpg, png, webp, avif, gif, mp4, webm).
          </p>
        </div>

        <Field label="Thumbnail-URL" value={thumb} onChange={setThumb} placeholder="https://…/squat.webp" />
        <Field label="Animation / Video-URL" value={anim} onChange={setAnim} placeholder="https://…/squat.mp4" />
        <Field label="Quelle / Lizenz" value={source} onChange={setSource} placeholder="z. B. BodyFuel Studio" />
        <Field label="Technikhinweis" value={hint} onChange={setHint} placeholder="Kurzer Ausführungshinweis" />

        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-border bg-background px-4 py-2 text-xs font-bold text-foreground"
          >
            Abbrechen
          </button>
          <button
            type="button"
            disabled={mutation.isPending}
            onClick={() => mutation.mutate()}
            className="rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground disabled:opacity-60"
          >
            {mutation.isPending ? "Speichert…" : "Speichern"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus:border-primary"
      />
    </label>
  );
}
