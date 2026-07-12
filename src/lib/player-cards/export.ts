/**
 * Player Card Export — HTMLElement → PNG-Blob/DataURL via html-to-image.
 * Wird sowohl im Share-Dialog (Einzelkarte) als auch beim Coach-Bulk-Export
 * (mehrere Karten in ZIP) verwendet.
 */
import { toPng, toBlob } from "html-to-image";

export type ExportOptions = {
  /** Skalierungsfaktor für höhere Auflösung. 2 = Retina-Qualität, 3 = Print. */
  pixelRatio?: number;
  backgroundColor?: string;
};

export async function cardToPngDataUrl(node: HTMLElement, opts: ExportOptions = {}): Promise<string> {
  return await toPng(node, {
    pixelRatio: opts.pixelRatio ?? 2,
    backgroundColor: opts.backgroundColor ?? "#000000",
    cacheBust: true,
    skipFonts: false,
  });
}

export async function cardToPngBlob(node: HTMLElement, opts: ExportOptions = {}): Promise<Blob> {
  const blob = await toBlob(node, {
    pixelRatio: opts.pixelRatio ?? 2,
    backgroundColor: opts.backgroundColor ?? "#000000",
    cacheBust: true,
    skipFonts: false,
  });
  if (!blob) throw new Error("PNG-Export fehlgeschlagen");
  return blob;
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5_000);
}

export function slugify(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase() || "player-card";
}
