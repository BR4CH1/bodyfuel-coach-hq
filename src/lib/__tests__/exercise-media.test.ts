import { describe, expect, it } from "vitest";
import {
  hasExerciseAnimation,
  hasExerciseMedia,
  isSafeMediaUrl,
  muscleIconKey,
  normalizeExerciseMedia,
  previewImageUrl,
  resolveMediaKind,
  validateMediaInput,
} from "../exercise-media";

describe("isSafeMediaUrl", () => {
  it("erlaubt https und interne Pfade", () => {
    expect(isSafeMediaUrl("https://cdn.example.com/a.mp4")).toBe(true);
    expect(isSafeMediaUrl("/storage/exercise-media/squat.webm")).toBe(true);
  });
  it("blockt unsichere Schemata", () => {
    expect(isSafeMediaUrl("http://x.de/a.gif")).toBe(false);
    expect(isSafeMediaUrl("javascript:alert(1)")).toBe(false);
    expect(isSafeMediaUrl("//evil.com/a.mp4")).toBe(false);
    expect(isSafeMediaUrl("")).toBe(false);
    expect(isSafeMediaUrl(null)).toBe(false);
  });
});

describe("resolveMediaKind", () => {
  it("erkennt Endungen inkl. Query-String", () => {
    expect(resolveMediaKind("https://a.de/x.mp4?token=1")).toBe("video");
    expect(resolveMediaKind("https://a.de/x.GIF")).toBe("gif");
    expect(resolveMediaKind("https://a.de/x.webp#f")).toBe("image");
    expect(resolveMediaKind("https://a.de/x.txt")).toBe(null);
  });
  it("bevorzugt das explizite Feld", () => {
    expect(resolveMediaKind("https://a.de/x.txt", "video")).toBe("video");
  });
});

describe("normalizeExerciseMedia", () => {
  it("ist rückwärtskompatibel zu Zeilen ohne Medienfelder", () => {
    const media = normalizeExerciseMedia({ name: "Kniebeuge", notes: "Rücken gerade" });
    expect(media.thumbnailUrl).toBeNull();
    expect(media.animationUrl).toBeNull();
    expect(media.techniqueHint).toBe("Rücken gerade");
    expect(hasExerciseMedia(media)).toBe(false);
  });
  it("verwirft unsichere URLs", () => {
    const media = normalizeExerciseMedia({ thumbnail_url: "http://x/a.png" });
    expect(media.thumbnailUrl).toBeNull();
  });
  it("liefert Vorschau und Animationsflag", () => {
    const media = normalizeExerciseMedia({
      thumbnail_url: "https://a.de/t.jpg",
      animation_url: "https://a.de/a.mp4",
      media_type: "video",
      technique_hint: "Tempo 3-0-1",
    });
    expect(previewImageUrl(media)).toBe("https://a.de/t.jpg");
    expect(hasExerciseAnimation(media)).toBe(true);
    expect(media.techniqueHint).toBe("Tempo 3-0-1");
  });
  it("nutzt GIF als Vorschau, wenn kein Thumbnail existiert", () => {
    const media = normalizeExerciseMedia({ animation_url: "https://a.de/a.gif" });
    expect(previewImageUrl(media)).toBe("https://a.de/a.gif");
    expect(hasExerciseAnimation(media)).toBe(true);
  });
  it("liefert kein Standbild für Videos", () => {
    const media = normalizeExerciseMedia({ animation_url: "https://a.de/a.webm" });
    expect(previewImageUrl(media)).toBeNull();
  });
});

describe("muscleIconKey", () => {
  it("mappt deutsche Muskelnamen", () => {
    expect(muscleIconKey("Beinbeuger")).toBe("legs");
    expect(muscleIconKey("Rücken")).toBe("back");
    expect(muscleIconKey("Brust")).toBe("chest");
    expect(muscleIconKey("Schulter")).toBe("shoulders");
    expect(muscleIconKey("Bizeps")).toBe("arms");
    expect(muscleIconKey("Rumpf")).toBe("core");
    expect(muscleIconKey(null, undefined)).toBe("general");
  });
});

describe("validateMediaInput", () => {
  it("akzeptiert leere Eingaben", () => {
    expect(validateMediaInput({}).ok).toBe(true);
  });
  it("lehnt unsichere und unbekannte Formate ab", () => {
    expect(validateMediaInput({ animationUrl: "http://x/a.mp4" }).ok).toBe(false);
    expect(validateMediaInput({ thumbnailUrl: "https://x/a.exe" }).ok).toBe(false);
    expect(validateMediaInput({ thumbnailUrl: "https://x/a.png" }).ok).toBe(true);
  });
});
