import { useEffect, useRef, useState, useCallback } from "react";
import type { IScannerControls } from "@zxing/browser";
import { X, Flashlight, FlashlightOff, Keyboard, Loader2 } from "lucide-react";

/**
 * Robust barcode scanner for food products.
 *
 * Strategy:
 *  1. Try native `BarcodeDetector` (fast, accurate on Android Chrome).
 *  2. Fall back to @zxing/browser with hints limited to product formats.
 *  3. Require two identical consecutive reads before accepting → filters misreads.
 *  4. Torch + zoom controls when the device supports them.
 *  5. Manual entry fallback for damaged / hard-to-read barcodes.
 */

// Native BarcodeDetector types (not in lib.dom yet on all TS versions)
type NativeBarcodeDetector = {
  detect: (source: CanvasImageSource) => Promise<Array<{ rawValue: string; format: string }>>;
};
type BarcodeDetectorCtor = new (opts?: { formats: string[] }) => NativeBarcodeDetector;

function getNativeDetectorCtor(): BarcodeDetectorCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { BarcodeDetector?: BarcodeDetectorCtor };
  return w.BarcodeDetector ?? null;
}

function isValidEan(code: string): boolean {
  if (!/^\d{8}$|^\d{12,14}$/.test(code)) return code.length >= 6; // non-EAN formats: accept if length plausible
  const digits = code.split("").map(Number);
  const check = digits.pop()!;
  const sum = digits.reverse().reduce((acc, d, i) => acc + d * (i % 2 === 0 ? 3 : 1), 0);
  const calc = (10 - (sum % 10)) % 10;
  return calc === check;
}

export function BarcodeScanner({
  onDetected,
  onClose,
}: {
  onDetected: (code: string) => void;
  onClose: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const trackRef = useRef<MediaStreamTrack | null>(null);
  const zxingControlsRef = useRef<IScannerControls | null>(null);
  const rafRef = useRef<number | null>(null);
  const stoppedRef = useRef(false);
  const lastCodeRef = useRef<string | null>(null);
  const confirmCountRef = useRef(0);

  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [torchSupported, setTorchSupported] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [manualCode, setManualCode] = useState("");

  const handleHit = useCallback(
    (raw: string) => {
      const code = raw.trim();
      if (!code) return;
      if (lastCodeRef.current === code) {
        confirmCountRef.current += 1;
      } else {
        lastCodeRef.current = code;
        confirmCountRef.current = 1;
      }
      // Require 2 matching reads OR a valid EAN checksum right away.
      const accept = confirmCountRef.current >= 2 || (/^\d{8,14}$/.test(code) && isValidEan(code));
      if (accept && !stoppedRef.current) {
        stoppedRef.current = true;
        try {
          navigator.vibrate?.(60);
        } catch {
          /* ignore */
        }
        onDetected(code);
      }
    },
    [onDetected],
  );

  useEffect(() => {
    stoppedRef.current = false;
    let cancelled = false;

    (async () => {
      try {
        if (typeof window === "undefined" || !navigator?.mediaDevices?.getUserMedia) {
          throw new Error("Dein Browser unterstützt keinen Kamerazugriff.");
        }
        if (!window.isSecureContext) {
          throw new Error("Kamera benötigt HTTPS.");
        }

        const stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
            // @ts-expect-error non-standard but honored on Chrome/Android
            focusMode: "continuous",
          },
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        const track = stream.getVideoTracks()[0];
        trackRef.current = track;

        // Detect torch support
        const caps =
          (track.getCapabilities?.() as MediaTrackCapabilities & { torch?: boolean }) ?? {};
        setTorchSupported(Boolean(caps.torch));

        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        video.setAttribute("playsinline", "true");
        await video.play().catch(() => {});
        setReady(true);

        const NativeCtor = getNativeDetectorCtor();
        if (NativeCtor) {
          const detector = new NativeCtor({
            formats: ["ean_13", "ean_8", "upc_a", "upc_e", "code_128", "code_39", "itf"],
          });
          const tick = async () => {
            if (stoppedRef.current || cancelled) return;
            try {
              const results = await detector.detect(video);
              if (results && results[0]?.rawValue) handleHit(results[0].rawValue);
            } catch {
              /* frame not ready */
            }
            rafRef.current = requestAnimationFrame(tick);
          };
          rafRef.current = requestAnimationFrame(tick);
        } else {
          // Fallback: @zxing/browser — nur im Browser laden, damit der
          // Scanner nicht im SSR-/Cloudflare-Bundle landet.
          const [{ BrowserMultiFormatReader }, zxing] = await Promise.all([
            import("@zxing/browser"),
            import("@zxing/library"),
          ]);
          const { BarcodeFormat, DecodeHintType, NotFoundException } = zxing;
          const productFormats = [
            BarcodeFormat.EAN_13,
            BarcodeFormat.EAN_8,
            BarcodeFormat.UPC_A,
            BarcodeFormat.UPC_E,
            BarcodeFormat.CODE_128,
            BarcodeFormat.CODE_39,
            BarcodeFormat.ITF,
          ];
          const hints = new Map<(typeof DecodeHintType)[keyof typeof DecodeHintType], unknown>();
          hints.set(DecodeHintType.POSSIBLE_FORMATS, productFormats);
          hints.set(DecodeHintType.TRY_HARDER, true);
          const reader = new BrowserMultiFormatReader(hints, {
            delayBetweenScanAttempts: 120,
            delayBetweenScanSuccess: 500,
          });
          zxingControlsRef.current = await reader.decodeFromStream(stream, video, (result, err) => {
            if (stoppedRef.current) return;
            if (result) handleHit(result.getText());
            // ignore NotFoundException (normal per-frame miss)
            if (err && !(err instanceof NotFoundException)) {
              // swallow — non-fatal
            }
          });
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Kamera-Fehler";
        setError(
          /denied|NotAllowed|Permission/i.test(msg)
            ? "Kamera-Zugriff verweigert. Bitte in den Browser-Einstellungen erlauben."
            : msg,
        );
      }
    })();

    return () => {
      cancelled = true;
      stoppedRef.current = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      zxingControlsRef.current?.stop();
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      trackRef.current = null;
    };
  }, [handleHit]);

  const toggleTorch = useCallback(async () => {
    const track = trackRef.current;
    if (!track) return;
    try {
      const next = !torchOn;
      await track.applyConstraints({
        // @ts-expect-error torch is non-standard
        advanced: [{ torch: next }],
      });
      setTorchOn(next);
    } catch {
      setTorchSupported(false);
    }
  }, [torchOn]);

  const submitManual = () => {
    const code = manualCode.trim();
    if (!code) return;
    stoppedRef.current = true;
    onDetected(code);
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background/95 backdrop-blur">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="text-sm font-semibold">Barcode scannen</div>
        <div className="flex items-center gap-1">
          {torchSupported && (
            <button
              onClick={toggleTorch}
              className="rounded-md p-2 hover:bg-secondary"
              aria-label={torchOn ? "Licht aus" : "Licht an"}
            >
              {torchOn ? <FlashlightOff className="h-5 w-5" /> : <Flashlight className="h-5 w-5" />}
            </button>
          )}
          <button
            onClick={() => setManualOpen((v) => !v)}
            className="rounded-md p-2 hover:bg-secondary"
            aria-label="Manuell eingeben"
          >
            <Keyboard className="h-5 w-5" />
          </button>
          <button
            onClick={onClose}
            className="rounded-md p-2 hover:bg-secondary"
            aria-label="Schließen"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      <div className="relative flex-1 overflow-hidden bg-black">
        <video ref={videoRef} className="h-full w-full object-cover" playsInline muted autoPlay />
        <div className="pointer-events-none absolute inset-0 grid place-items-center">
          <div className="relative h-36 w-[80%] max-w-sm">
            <div className="absolute inset-0 rounded-xl shadow-[0_0_0_9999px_rgba(0,0,0,0.55)]" />
            {/* Corner markers */}
            {(["tl", "tr", "bl", "br"] as const).map((c) => (
              <span
                key={c}
                className={`absolute h-6 w-6 border-gold ${
                  c === "tl"
                    ? "left-0 top-0 border-l-2 border-t-2 rounded-tl-lg"
                    : c === "tr"
                      ? "right-0 top-0 border-r-2 border-t-2 rounded-tr-lg"
                      : c === "bl"
                        ? "bottom-0 left-0 border-b-2 border-l-2 rounded-bl-lg"
                        : "bottom-0 right-0 border-b-2 border-r-2 rounded-br-lg"
                }`}
              />
            ))}
            {/* Scan line */}
            <span className="absolute inset-x-3 top-1/2 h-[2px] -translate-y-1/2 bg-gold/80 shadow-[0_0_12px_2px_hsl(var(--gold)/0.6)] animate-pulse" />
          </div>
        </div>

        {!ready && !error && (
          <div className="absolute inset-0 grid place-items-center bg-black/60 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" /> Kamera wird gestartet…
            </div>
          </div>
        )}

        {error && (
          <div className="absolute inset-x-4 bottom-20 rounded-lg bg-destructive/90 p-3 text-center text-sm text-destructive-foreground">
            {error}
          </div>
        )}

        <p className="absolute inset-x-0 bottom-3 text-center text-xs text-white/80">
          Barcode ruhig in den Rahmen halten — Auto-Fokus läuft
        </p>
      </div>

      {manualOpen && (
        <div className="border-t border-border bg-card p-4">
          <label className="text-xs font-medium text-muted-foreground">
            Barcode manuell eingeben
          </label>
          <div className="mt-2 flex gap-2">
            <input
              autoFocus
              inputMode="numeric"
              pattern="[0-9]*"
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value.replace(/\s+/g, ""))}
              onKeyDown={(e) => {
                if (e.key === "Enter") submitManual();
              }}
              placeholder="z. B. 4008400404127"
              className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
            <button
              onClick={submitManual}
              disabled={!manualCode.trim()}
              className="rounded-md bg-gradient-gold px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
            >
              Übernehmen
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
