/**
 * AthletePlayerCardThumb — Kleines Spielerkarten-Thumbnail für den
 * Athleten-Home-Header. Zeigt das vom Coach hochgeladene Karten-Bild.
 * Klick öffnet ein Vollbild-Zoom-Overlay.
 *
 * Rendert nichts, wenn kein Bild hinterlegt ist.
 */
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getMyPlayerCard } from "@/lib/player-cards.functions";

export function AthletePlayerCardThumb({ userId }: { userId: string | undefined }) {
  const fetchFn = useServerFn(getMyPlayerCard);
  const q = useQuery({
    queryKey: ["athlete-player-card-thumb", userId ?? "anon"],
    enabled: !!userId,
    queryFn: () => fetchFn(),
    staleTime: 60_000,
  });

  const path = (q.data?.card as any)?.custom_card_image_url ?? null;
  const [url, setUrl] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

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

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  if (!url) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Spielerkarte anzeigen"
        className="shrink-0 overflow-hidden rounded-lg border border-white/30 shadow-lg transition hover:scale-105"
        style={{ width: 56, height: 84 }}
      >
        <img src={url} alt="Spielerkarte" className="h-full w-full object-cover" />
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[90] flex items-center justify-center bg-black/85 p-4 backdrop-blur-md"
          onClick={() => setOpen(false)}
        >
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setOpen(false); }}
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
