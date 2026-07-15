/**
 * AthletePlayerCardThumb — Kleines Spielerkarten-Thumbnail für den
 * Athleten-Home-Header. Zeigt das vom Coach hochgeladene Karten-Bild.
 *
 * Beim ersten Login nach Erhalt einer neuen Karte startet automatisch
 * das Pack-Opening-Reveal (siehe PlayerCardReveal). Danach nur noch
 * kleines Thumbnail → Klick = Vollbild-Zoom.
 *
 * "Neu" ist definiert über card.updated_at pro user in localStorage.
 */
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getMyPlayerCard } from "@/lib/player-cards.functions";
import { PlayerCardReveal } from "./PlayerCardReveal";

function seenKey(userId: string, cardKey: string) {
  return `bf:card-revealed:${userId}:${cardKey}`;
}

export function AthletePlayerCardThumb({ userId }: { userId: string | undefined }) {
  const fetchFn = useServerFn(getMyPlayerCard);
  const q = useQuery({
    queryKey: ["athlete-player-card-thumb", userId ?? "anon"],
    enabled: !!userId,
    queryFn: () => fetchFn(),
    staleTime: 60_000,
  });

  const card = (q.data?.card as any) ?? null;
  const path = card?.custom_card_image_url ?? null;
  const cardKey: string | null = path ? String(card?.updated_at ?? path) : null;
  const tier = card?.tier ?? null;
  const playerName =
    (q.data?.bullsProfile as any)?.first_name
      ? `${(q.data?.bullsProfile as any).first_name} ${(q.data?.bullsProfile as any).last_name ?? ""}`.trim()
      : (q.data?.profile as any)?.display_name ?? null;

  const [url, setUrl] = useState<string | null>(null);
  const [zoomOpen, setZoomOpen] = useState(false);
  const [revealOpen, setRevealOpen] = useState(false);

  // Signed URL laden
  useEffect(() => {
    let alive = true;
    setUrl(null);
    if (!path) return;
    supabase.storage
      .from("player-card-images")
      .createSignedUrl(path, 3600)
      .then(({ data }) => { if (alive && data?.signedUrl) setUrl(data.signedUrl); });
    return () => { alive = false; };
  }, [path]);

  // Auto-Reveal beim ersten Login nach Karten-Update
  useEffect(() => {
    if (!url || !userId || !cardKey) return;
    if (typeof window === "undefined") return;
    const key = seenKey(userId, cardKey);
    if (window.localStorage.getItem(key) === "1") return;
    // Kleine Verzögerung, damit Home fertig gemountet ist
    const t = setTimeout(() => setRevealOpen(true), 350);
    return () => clearTimeout(t);
  }, [url, userId, cardKey]);

  // Escape schließt Zoom
  useEffect(() => {
    if (!zoomOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setZoomOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [zoomOpen]);

  function dismissReveal() {
    setRevealOpen(false);
    if (userId && cardKey && typeof window !== "undefined") {
      window.localStorage.setItem(seenKey(userId, cardKey), "1");
    }
  }

  if (!url) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setZoomOpen(true)}
        aria-label="Spielerkarte anzeigen"
        className="shrink-0 overflow-hidden rounded-lg border border-white/30 shadow-lg transition hover:scale-105"
        style={{ width: 56, height: 84 }}
      >
        <img src={url} alt="Spielerkarte" className="h-full w-full object-cover" />
      </button>

      {revealOpen && (
        <PlayerCardReveal
          imageUrl={url}
          tier={tier}
          playerName={playerName}
          onClose={dismissReveal}
        />
      )}

      {zoomOpen && !revealOpen && (
        <div
          className="fixed inset-0 z-[90] flex items-center justify-center bg-black/85 p-4 backdrop-blur-md"
          onClick={() => setZoomOpen(false)}
        >
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setZoomOpen(false); }}
            aria-label="Schließen"
            className="absolute right-4 top-4 grid h-10 w-10 place-items-center rounded-full border border-white/20 bg-black/60 text-white/80 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
          <img
            src={url}
            alt="Spielerkarte"
            className="max-h-[90vh] max-w-full rounded-xl object-contain shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </>
  );
}
