import { Activity, Dumbbell, Play } from "lucide-react";
import type { ExerciseMedia, MuscleIconKey } from "@/lib/exercise-media";
import {
  hasExerciseAnimation,
  muscleIconKey,
  previewImageUrl,
} from "@/lib/exercise-media";

const ICONS: Record<MuscleIconKey, typeof Dumbbell> = {
  legs: Dumbbell,
  back: Activity,
  chest: Dumbbell,
  shoulders: Activity,
  arms: Dumbbell,
  core: Activity,
  general: Dumbbell,
};

/**
 * Kompakte Übungsvorschau. Zeigt ein Standbild (nie ein automatisch laufendes
 * Video) oder ein Muskelgruppen-Fallback-Icon. Feste Größe = keine Layoutsprünge.
 */
export function ExerciseMediaThumb({
  media,
  name,
  muscle,
  size = 56,
  className = "",
}: {
  media: ExerciseMedia;
  name: string;
  muscle?: string | null;
  size?: number;
  className?: string;
}) {
  const preview = previewImageUrl(media);
  const Icon = ICONS[muscleIconKey(muscle, name)];
  const animated = hasExerciseAnimation(media);

  return (
    <div
      style={{ width: size, height: size }}
      className={`relative shrink-0 overflow-hidden rounded-xl border border-border bg-muted ${className}`}
    >
      {preview ? (
        <img
          src={preview}
          alt={`Übungsausführung: ${name}`}
          loading="lazy"
          decoding="async"
          width={size}
          height={size}
          className="h-full w-full object-cover"
        />
      ) : (
        <div className="grid h-full w-full place-items-center bg-primary/10 text-primary">
          <Icon className="h-1/2 w-1/2" aria-hidden />
        </div>
      )}
      {animated && (
        <span
          className="absolute bottom-0.5 right-0.5 grid h-4 w-4 place-items-center rounded-full bg-foreground/70 text-background"
          title="Animation verfügbar"
        >
          <Play className="h-2.5 w-2.5" aria-hidden />
          <span className="sr-only">Animation verfügbar</span>
        </span>
      )}
    </div>
  );
}
