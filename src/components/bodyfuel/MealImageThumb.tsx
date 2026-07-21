import { useEffect, useState } from "react";
import { ChefHat, Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";
import type { MealImageStatus } from "@/lib/meal-images.functions";

export function MealImageThumb({
  name,
  imageUrl,
  status = "none",
  className,
}: {
  name: string;
  imageUrl?: string | null;
  status?: MealImageStatus | null;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);

  useEffect(() => setFailed(false), [imageUrl]);

  const loading = status === "pending" || status === "generating";
  const showImage = Boolean(imageUrl && !failed);

  return (
    <div
      className={cn(
        "relative flex shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border bg-secondary",
        className ?? "h-16 w-20",
      )}
    >
      {showImage ? (
        <img
          src={imageUrl ?? undefined}
          alt={`${name} – Serviervorschlag`}
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          className="h-full w-full object-cover"
          onError={() => setFailed(true)}
        />
      ) : loading ? (
        <Loader2 className="h-5 w-5 animate-spin text-gold" aria-label="Bild wird erstellt" />
      ) : (
        <ChefHat className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
      )}
      {status === "fallback" && showImage && (
        <span className="absolute bottom-1 right-1 rounded bg-black/70 px-1 py-0.5 text-[8px] font-semibold text-white">
          Zutat
        </span>
      )}
    </div>
  );
}
