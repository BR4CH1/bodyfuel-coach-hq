/**
 * PlayerCardShareDialog — Vollbild-Preview + Aktionen:
 *  - PNG herunterladen
 *  - Karte teilen (Web Share API, wenn verfügbar)
 *  - Link kopieren
 *
 * Rendert die Karte OFF-SCREEN in exportfreundlicher Grösse und nutzt sie als
 * Snapshot-Source. Bewusst kein 3D-Flip im Export — nur die Vorderseite.
 */
import { useEffect, useRef, useState } from "react";
import { Download, Loader2, Share2, X, Link as LinkIcon, Check } from "lucide-react";
import { toast } from "sonner";
import { PlayerCard, type PlayerCardData } from "./PlayerCard";
import { cardToPngBlob, downloadBlob, slugify } from "@/lib/player-cards/export";

type Props = {
  data: PlayerCardData;
  open: boolean;
  onClose: () => void;
  /** Optionaler Deeplink zur Karte (z.B. Coach-URL). Wenn leer → aktuelle URL. */
  shareUrl?: string;
};

export function PlayerCardShareDialog({ data, open, onClose, shareUrl }: Props) {
  const exportRef = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState<"download" | "share" | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const last =
    data.bullsProfile?.last_name ||
    data.profile?.display_name?.split(" ").slice(-1)[0] ||
    "player";
  const filename = `bfr-${slugify(last)}-${(data.card.bfr ?? 0)}.png`;

  const buildBlob = async () => {
    const node = exportRef.current;
    if (!node) throw new Error("Karte nicht bereit");
    return await cardToPngBlob(node, { pixelRatio: 3 });
  };

  const handleDownload = async () => {
    try {
      setBusy("download");
      const blob = await buildBlob();
      downloadBlob(blob, filename);
      toast.success("Karte heruntergeladen");
    } catch (e: any) {
      toast.error(e?.message ?? "Download fehlgeschlagen");
    } finally {
      setBusy(null);
    }
  };

  const handleShare = async () => {
    try {
      setBusy("share");
      const blob = await buildBlob();
      const file = new File([blob], filename, { type: "image/png" });
      const nav = navigator as any;
      if (nav.canShare?.({ files: [file] })) {
        await nav.share({
          files: [file],
          title: `${last} — BFR ${data.card.bfr ?? "—"}`,
          text: `Meine BodyFuel Player Card — BFR ${data.card.bfr ?? "—"}`,
        });
      } else {
        downloadBlob(blob, filename);
        toast.success("Kein Share verfügbar — Karte gespeichert");
      }
    } catch (e: any) {
      if (e?.name !== "AbortError") toast.error(e?.message ?? "Teilen fehlgeschlagen");
    } finally {
      setBusy(null);
    }
  };

  const handleCopyLink = async () => {
    try {
      const url = shareUrl ?? window.location.href;
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2_000);
    } catch {
      toast.error("Konnte Link nicht kopieren");
    }
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/80 p-4 backdrop-blur-md">
      <button
        type="button"
        onClick={onClose}
        aria-label="Schließen"
        className="absolute right-4 top-4 grid h-9 w-9 place-items-center rounded-full border border-white/20 bg-black/60 text-white/80 hover:text-white"
      >
        <X className="h-4 w-4" />
      </button>

      <div className="flex w-full max-w-md flex-col items-center gap-4">
        <div className="w-full" style={{ maxWidth: 380 }}>
          <div style={{ aspectRatio: "2 / 3" }}>
            <PlayerCard data={data} />
          </div>
        </div>

        <div className="flex w-full gap-2">
          <button
            type="button"
            disabled={busy !== null}
            onClick={handleDownload}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-full bg-white px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-black hover:opacity-90 disabled:opacity-50"
          >
            {busy === "download" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
            PNG
          </button>
          <button
            type="button"
            disabled={busy !== null}
            onClick={handleShare}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-full border border-white/30 bg-white/10 px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-white hover:bg-white/20 disabled:opacity-50"
          >
            {busy === "share" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Share2 className="h-3.5 w-3.5" />}
            Teilen
          </button>
          <button
            type="button"
            onClick={handleCopyLink}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-full border border-white/30 bg-white/10 px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-white hover:bg-white/20"
          >
            {copied ? <Check className="h-3.5 w-3.5" /> : <LinkIcon className="h-3.5 w-3.5" />}
            {copied ? "Kopiert" : "Link"}
          </button>
        </div>
        <p className="text-center text-[10px] uppercase tracking-widest text-white/40">
          Tap außerhalb zum Schließen
        </p>
      </div>

      {/* Offscreen Render zum Export in Exportgrösse (600×900). */}
      <div
        style={{
          position: "fixed",
          left: "-99999px",
          top: 0,
          width: 600,
          height: 900,
          pointerEvents: "none",
        }}
        aria-hidden
      >
        <div ref={exportRef} style={{ width: 600, height: 900 }}>
          <PlayerCard data={data} />
        </div>
      </div>
    </div>
  );
}
