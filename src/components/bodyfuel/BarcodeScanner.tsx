import { useEffect, useRef, useState } from "react";
import { BrowserMultiFormatReader } from "@zxing/browser";
import { X } from "lucide-react";

export function BarcodeScanner({
  onDetected,
  onClose,
}: {
  onDetected: (code: string) => void;
  onClose: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const reader = new BrowserMultiFormatReader();
    let controls: { stop: () => void } | null = null;
    let stopped = false;

    (async () => {
      try {
        if (typeof window === "undefined" || !navigator?.mediaDevices?.getUserMedia) {
          throw new Error("Dein Browser unterstützt keinen Kamerazugriff.");
        }
        if (!window.isSecureContext) {
          throw new Error("Kamera benötigt HTTPS.");
        }
        // Trigger permission prompt explicitly, otherwise device labels stay empty
        // and decodeFromVideoDevice may pick the wrong (or no) camera on iOS.
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
          audio: false,
        });
        // Stop probe stream — zxing will start its own using constraints below.
        stream.getTracks().forEach((t) => t.stop());

        controls = await reader.decodeFromConstraints(
          { video: { facingMode: { ideal: "environment" } }, audio: false },
          videoRef.current!,
          (result) => {
            if (stopped) return;
            if (result) {
              stopped = true;
              onDetected(result.getText());
            }
          },
        );
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Kamera-Fehler";
        setError(
          /denied|NotAllowed/i.test(msg)
            ? "Kamera-Zugriff verweigert. Bitte in den Browser-Einstellungen erlauben."
            : msg,
        );
      }
    })();

    return () => {
      stopped = true;
      controls?.stop();
    };
  }, [onDetected]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background/95 backdrop-blur">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="text-sm font-semibold">Barcode scannen</div>
        <button onClick={onClose} className="rounded-md p-2 hover:bg-secondary" aria-label="Schließen">
          <X className="h-5 w-5" />
        </button>
      </div>
      <div className="relative flex-1 overflow-hidden">
        <video ref={videoRef} className="h-full w-full object-cover" playsInline muted />
        <div className="pointer-events-none absolute inset-0 grid place-items-center">
          <div className="h-32 w-72 rounded-lg border-2 border-gold/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]" />
        </div>
        {error && (
          <div className="absolute inset-x-4 bottom-6 rounded-lg bg-destructive/90 p-3 text-center text-sm text-destructive-foreground">
            {error}
          </div>
        )}
        <p className="absolute inset-x-0 bottom-2 text-center text-xs text-muted-foreground">
          Barcode in den Rahmen halten…
        </p>
      </div>
    </div>
  );
}
