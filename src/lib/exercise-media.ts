/**
 * Übungs-Medienmodell (BodyFuel Training V2).
 *
 * Quelle der Wahrheit ist `coach_exercise_library` mit den Feldern
 * `thumbnail_url`, `animation_url`, `media_type`, `media_source` und
 * `technique_hint`. Alles ist optional und rückwärtskompatibel: Übungen ohne
 * Medien fallen auf ein Muskelgruppen-Icon zurück.
 */

export type ExerciseMediaKind = "image" | "gif" | "video";

export type ExerciseMedia = {
  thumbnailUrl: string | null;
  animationUrl: string | null;
  mediaType: ExerciseMediaKind | null;
  mediaSource: string | null;
  techniqueHint: string | null;
};

export const EMPTY_EXERCISE_MEDIA: ExerciseMedia = {
  thumbnailUrl: null,
  animationUrl: null,
  mediaType: null,
  mediaSource: null,
  techniqueHint: null,
};

const VIDEO_EXT = [".mp4", ".webm", ".mov", ".m4v"];
const GIF_EXT = [".gif"];
const IMAGE_EXT = [".png", ".jpg", ".jpeg", ".webp", ".avif"];

function pathOf(url: string): string {
  const cleaned = url.split("?")[0]!.split("#")[0]!;
  return cleaned.toLowerCase();
}

/** Erlaubt sind https-URLs und projektinterne Storage-/Asset-Pfade. */
export function isSafeMediaUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  const value = url.trim();
  if (!value || value.length > 2048) return false;
  if (value.startsWith("/")) return !value.startsWith("//");
  return /^https:\/\/[^\s]+$/i.test(value);
}

/** Leitet die Medienart aus explizitem Feld oder aus der Dateiendung ab. */
export function resolveMediaKind(
  url: string | null | undefined,
  explicit?: string | null,
): ExerciseMediaKind | null {
  if (explicit === "image" || explicit === "gif" || explicit === "video") return explicit;
  if (!url) return null;
  const path = pathOf(url);
  if (VIDEO_EXT.some((ext) => path.endsWith(ext))) return "video";
  if (GIF_EXT.some((ext) => path.endsWith(ext))) return "gif";
  if (IMAGE_EXT.some((ext) => path.endsWith(ext))) return "image";
  return null;
}

/** Normalisiert beliebige DB-Zeilen (auch alte ohne Medienfelder). */
export function normalizeExerciseMedia(row: unknown): ExerciseMedia {
  const r = (row ?? {}) as Record<string, unknown>;
  const thumb = typeof r["thumbnail_url"] === "string" ? (r["thumbnail_url"] as string) : null;
  const anim = typeof r["animation_url"] === "string" ? (r["animation_url"] as string) : null;
  const explicit = typeof r["media_type"] === "string" ? (r["media_type"] as string) : null;
  const safeThumb = isSafeMediaUrl(thumb) ? thumb!.trim() : null;
  const safeAnim = isSafeMediaUrl(anim) ? anim!.trim() : null;
  return {
    thumbnailUrl: safeThumb,
    animationUrl: safeAnim,
    mediaType: resolveMediaKind(safeAnim ?? safeThumb, explicit),
    mediaSource: typeof r["media_source"] === "string" ? (r["media_source"] as string) : null,
    techniqueHint:
      typeof r["technique_hint"] === "string"
        ? (r["technique_hint"] as string)
        : typeof r["notes"] === "string"
          ? (r["notes"] as string)
          : null,
  };
}

/** Gibt es überhaupt etwas anzuzeigen? */
export function hasExerciseMedia(media: ExerciseMedia): boolean {
  return !!(media.thumbnailUrl || media.animationUrl);
}

/** Nur wenn eine echte Animation/Video hinterlegt ist, zeigen wir das Badge. */
export function hasExerciseAnimation(media: ExerciseMedia): boolean {
  if (!media.animationUrl) return false;
  const kind = resolveMediaKind(media.animationUrl, media.mediaType);
  return kind === "video" || kind === "gif";
}

/** Bildquelle für die Listenvorschau — nie ein Video. */
export function previewImageUrl(media: ExerciseMedia): string | null {
  if (media.thumbnailUrl) return media.thumbnailUrl;
  const kind = resolveMediaKind(media.animationUrl, media.mediaType);
  if (media.animationUrl && (kind === "gif" || kind === "image")) return media.animationUrl;
  return null;
}

export type MuscleIconKey = "legs" | "back" | "chest" | "shoulders" | "arms" | "core" | "general";

const MUSCLE_MAP: Array<[MuscleIconKey, string[]]> = [
  ["legs", ["bein", "quad", "glute", "gesäß", "wade", "hamstring", "squat", "leg"]],
  ["back", ["rücken", "ruecken", "lat", "back", "row", "pull", "trapez"]],
  ["chest", ["brust", "chest", "pec", "press", "bench"]],
  ["shoulders", ["schulter", "shoulder", "delt"]],
  ["arms", ["bizeps", "trizeps", "biceps", "triceps", "arm", "unterarm"]],
  ["core", ["core", "bauch", "rumpf", "abs", "plank"]],
];

/** Fallback-Icon anhand Zielmuskel/Übungsname. */
export function muscleIconKey(...hints: Array<string | null | undefined>): MuscleIconKey {
  const text = hints.filter(Boolean).join(" ").toLowerCase();
  for (const [key, tokens] of MUSCLE_MAP) {
    if (tokens.some((token) => text.includes(token))) return key;
  }
  return "general";
}

/** Validierung für das Coach-Medienformular. */
export function validateMediaInput(input: {
  thumbnailUrl?: string | null;
  animationUrl?: string | null;
}): { ok: true } | { ok: false; error: string } {
  for (const [label, value] of [
    ["Thumbnail", input.thumbnailUrl],
    ["Animation", input.animationUrl],
  ] as const) {
    if (!value || !value.trim()) continue;
    if (!isSafeMediaUrl(value)) {
      return { ok: false, error: `${label}: nur https-URLs oder Storage-Pfade sind erlaubt.` };
    }
    if (!resolveMediaKind(value)) {
      return {
        ok: false,
        error: `${label}: nicht unterstütztes Format (erlaubt: jpg, png, webp, avif, gif, mp4, webm).`,
      };
    }
  }
  return { ok: true };
}
