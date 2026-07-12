/**
 * PlayerCardFlip — 3D-Wrapper, klickbar zum Umdrehen.
 */
import { useState, type ReactNode } from "react";

export function PlayerCardFlip({
  front,
  back,
  aspectRatio = "2 / 3",
  maxWidth = 480,
}: {
  front: ReactNode;
  back: ReactNode;
  aspectRatio?: string;
  maxWidth?: number;
}) {
  const [flipped, setFlipped] = useState(false);
  return (
    <div
      className="pc-flip-3d mx-auto w-full"
      style={{ maxWidth, aspectRatio }}
    >
      <button
        type="button"
        onClick={() => setFlipped((f) => !f)}
        aria-label={flipped ? "Karte zurückdrehen" : "Karte umdrehen"}
        className={`pc-flip-inner block h-full w-full cursor-pointer border-0 bg-transparent p-0 text-left ${flipped ? "pc-flip-active" : ""}`}
      >
        <div className="pc-flip-face">{front}</div>
        <div className="pc-flip-face pc-flip-back">{back}</div>
      </button>
    </div>
  );
}
