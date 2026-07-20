/**
 * PlayerCardReveal — EA-FC-artiges Pack-Opening-Overlay.
 *
 * Sequenz (~2.5s):
 *   0.0s  Fade to Black + Partikel + Lichtstrahlen
 *   0.3s  Karte rotiert langsam von der Seite ein, Glow wächst
 *   1.5s  Flash
 *   1.7s  Karte slammt in die Mitte, Camera-Shake
 *   2.0s  Rarity-Badge glüht auf, Karte wird tiltbar (3D auf Zeiger/Finger)
 *   Tap   Dismiss → Overlay verschwindet, Thumbnail bleibt sichtbar
 *
 * Rarity-Glow-Farbe leitet sich vom Karten-`tier` ab (bronze/silver/gold/elite).
 */
import { useEffect, useMemo, useRef, useState } from "react";

type Tier = "bronze" | "silver" | "gold" | "elite" | "legendary" | null | undefined;

const TIER_STYLE: Record<string, { glow: string; ring: string; particle: string; label: string; sub: string }> = {
  bronze:    { glow: "#c88a4a", ring: "#e6a869", particle: "#f0c58a", label: "BRONZE", sub: "Karte" },
  silver:    { glow: "#c0c8d0", ring: "#e6ecf2", particle: "#ffffff", label: "SILVER", sub: "Karte" },
  gold:      { glow: "#f5c341", ring: "#ffd76b", particle: "#fff2b8", label: "GOLD",   sub: "Karte" },
  elite:     { glow: "#ff2d3a", ring: "#ff5b64", particle: "#ffb3b8", label: "ELITE",  sub: "Karte" },
  legendary: { glow: "#b967ff", ring: "#d59bff", particle: "#f0d0ff", label: "LEGEND", sub: "Karte" },
  default:   { glow: "#e11d48", ring: "#ff5b64", particle: "#ffb3b8", label: "NEU",    sub: "Spielerkarte" },
};

export function PlayerCardReveal({
  imageUrl,
  tier,
  playerName,
  onClose,
}: {
  imageUrl: string;
  tier: Tier;
  playerName?: string | null;
  onClose: () => void;
}) {
  const style = TIER_STYLE[(tier ?? "default") as string] ?? TIER_STYLE.default;
  const [phase, setPhase] = useState<"intro" | "flash" | "land" | "settled">("intro");
  const [tilt, setTilt] = useState<{ rx: number; ry: number }>({ rx: 0, ry: 0 });
  const cardRef = useRef<HTMLDivElement>(null);

  // Sequenz-Timer
  useEffect(() => {
    const t1 = setTimeout(() => setPhase("flash"), 1500);
    const t2 = setTimeout(() => setPhase("land"), 1700);
    const t3 = setTimeout(() => setPhase("settled"), 2100);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, []);

  // Escape schließt
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // 3D-Tilt basierend auf Zeiger/Finger — nur nach Landung
  function handlePointer(e: React.PointerEvent) {
    if (phase !== "settled") return;
    const el = cardRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = (e.clientX - cx) / (rect.width / 2);
    const dy = (e.clientY - cy) / (rect.height / 2);
    setTilt({ rx: -dy * 14, ry: dx * 14 });
  }
  function resetTilt() { setTilt({ rx: 0, ry: 0 }); }

  const particles = useMemo(
    () => Array.from({ length: 28 }).map((_, i) => ({
      id: i,
      x: Math.random() * 100,
      delay: Math.random() * 1.8,
      duration: 3 + Math.random() * 3,
      size: 2 + Math.random() * 4,
    })),
    [],
  );

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center overflow-hidden bg-black"
      style={{ perspective: "1400px" }}
      onClick={() => phase === "settled" && onClose()}
    >
      {/* Radialer Tier-Glow */}
      <div
        className="pointer-events-none absolute inset-0 pcr-radial"
        style={{
          background: `radial-gradient(closest-side at 50% 50%, ${style.glow}55 0%, ${style.glow}22 30%, transparent 65%)`,
        }}
      />

      {/* Lichtstrahlen (rotierender Conic-Gradient) */}
      <div
        className="pointer-events-none absolute left-1/2 top-1/2 h-[180vmax] w-[180vmax] pcr-rays"
        style={{
          transform: "translate(-50%, -50%)",
          background: `conic-gradient(from 0deg, transparent 0deg, ${style.glow}22 6deg, transparent 12deg, transparent 40deg, ${style.glow}18 46deg, transparent 52deg, transparent 90deg, ${style.glow}22 96deg, transparent 102deg, transparent 140deg, ${style.glow}18 146deg, transparent 152deg, transparent 190deg, ${style.glow}22 196deg, transparent 202deg, transparent 240deg, ${style.glow}18 246deg, transparent 252deg, transparent 290deg, ${style.glow}22 296deg, transparent 302deg, transparent 340deg, ${style.glow}18 346deg, transparent 352deg)`,
          filter: "blur(2px)",
        }}
      />

      {/* Partikel */}
      <div className="pointer-events-none absolute inset-0">
        {particles.map((p) => (
          <span
            key={p.id}
            className="pcr-particle"
            style={{
              left: `${p.x}%`,
              width: p.size,
              height: p.size,
              background: style.particle,
              boxShadow: `0 0 ${p.size * 3}px ${style.particle}`,
              animationDelay: `${p.delay}s`,
              animationDuration: `${p.duration}s`,
            }}
          />
        ))}
      </div>

      {/* Flash */}
      {phase === "flash" && <div className="pointer-events-none absolute inset-0 bg-white pcr-flash" />}

      {/* Karten-Wrapper (Slam-In + Camera-Shake nach Landing) */}
      <div
        className={
          "relative flex flex-col items-center gap-4 " +
          (phase === "land" || phase === "settled" ? "pcr-shake" : "")
        }
      >
        <div
          ref={cardRef}
          onPointerMove={handlePointer}
          onPointerLeave={resetTilt}
          onPointerUp={resetTilt}
          className={
            "pcr-card relative overflow-hidden rounded-2xl border-2 " +
            (phase === "intro" ? "pcr-card-intro" : "pcr-card-land")
          }
          style={{
            width: "min(78vw, 340px)",
            aspectRatio: "2 / 3",
            borderColor: style.ring,
            boxShadow: `0 0 60px ${style.glow}, 0 0 120px ${style.glow}80, 0 30px 80px rgba(0,0,0,0.6)`,
            transform: `perspective(1000px) rotateX(${tilt.rx}deg) rotateY(${tilt.ry}deg)`,
            transformStyle: "preserve-3d",
            transition: phase === "settled" ? "transform 0.15s ease-out" : undefined,
          }}
        >
          <img
            src={imageUrl}
            alt="Spielerkarte"
            className="h-full w-full select-none object-cover"
            draggable={false}
          />
          {/* Metallic Shine sweep */}
          <div className="pointer-events-none absolute inset-0 pcr-shine" />
          {/* Border-Glow-Pulse */}
          <div
            className="pointer-events-none absolute inset-0 rounded-2xl pcr-border-pulse"
            style={{ boxShadow: `inset 0 0 40px ${style.glow}` }}
          />
        </div>

        {/* Rarity-Badge */}
        {phase === "settled" && (
          <div className="pcr-badge flex flex-col items-center gap-1">
            <div
              className="rounded-full border px-4 py-1.5 text-[10px] font-black uppercase tracking-[0.4em] text-white"
              style={{
                borderColor: style.ring,
                background: `linear-gradient(135deg, ${style.glow}40, transparent)`,
                textShadow: `0 0 12px ${style.glow}`,
                boxShadow: `0 0 24px ${style.glow}80`,
              }}
            >
              {style.label} · {style.sub}
            </div>
            {playerName && (
              <div className="pcr-name text-xl font-bold text-white" style={{ textShadow: `0 0 12px ${style.glow}` }}>
                {playerName}
              </div>
            )}
            <div className="mt-3 text-[10px] uppercase tracking-[0.3em] text-white/50">
              Tap zum Schließen
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
