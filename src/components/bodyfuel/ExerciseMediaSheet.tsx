import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { ExerciseMedia } from "@/lib/exercise-media";
import { previewImageUrl, resolveMediaKind } from "@/lib/exercise-media";

/**
 * Bottom-Sheet-artiger Dialog mit der großen Medienfläche.
 * Medien werden erst geladen, wenn der Dialog offen ist.
 */
export function ExerciseMediaSheet({
  open,
  onOpenChange,
  name,
  media,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  name: string;
  media: ExerciseMedia;
}) {
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (open) setFailed(false);
  }, [open, media.animationUrl]);

  const source = media.animationUrl ?? previewImageUrl(media);
  const kind = resolveMediaKind(source, media.mediaType);
  const poster = previewImageUrl(media) ?? undefined;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg gap-3 p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle className="text-left text-base font-black">{name}</DialogTitle>
        </DialogHeader>

        <div className="aspect-video w-full overflow-hidden rounded-xl border border-border bg-muted">
          {open && source && !failed ? (
            kind === "video" ? (
              <video
                key={source}
                src={source}
                poster={poster}
                controls
                loop
                muted
                playsInline
                preload="metadata"
                aria-label={`Übungsausführung: ${name}`}
                onError={() => setFailed(true)}
                className="h-full w-full object-contain"
              />
            ) : (
              <img
                key={source}
                src={source}
                alt={`Übungsausführung: ${name}`}
                loading="lazy"
                decoding="async"
                onError={() => setFailed(true)}
                className="h-full w-full object-contain"
              />
            )
          ) : (
            <div className="grid h-full w-full place-items-center px-6 text-center text-xs text-muted-foreground">
              {failed
                ? "Medium konnte nicht geladen werden."
                : "Für diese Übung ist noch keine Animation hinterlegt."}
            </div>
          )}
        </div>

        {media.techniqueHint && (
          <p className="text-xs leading-relaxed text-muted-foreground">{media.techniqueHint}</p>
        )}
        {media.mediaSource && (
          <p className="text-[10px] text-muted-foreground">Quelle: {media.mediaSource}</p>
        )}
      </DialogContent>
    </Dialog>
  );
}
