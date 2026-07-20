/**
 * PlayerCardUpgradeOverlay — Vollbild-Celebration bei Tier-Aufstieg.
 * Wird durch `upgrade`-Payload aus recomputePlayerCard getriggert.
 */
import { useEffect, useMemo } from "react";
import { Sparkles, TrendingUp, X } from "lucide-react";

const TIER_META: Record<string, { label: string; gradient: string; glow: string }> = {
  bronze: { label: "Bronze", gradient: "from-amber-800 via-amber-600 to-amber-900", glow: "rgba(217,119,6,0.5)" },
  silver: { label: "Silber", gradient: "from-slate-400 via-slate-200 to-slate-500", glow: "rgba(203,213,225,0.55)" },
  gold: { label: "Gold", gradient: "from-yellow-500 via-yellow-300 to-amber-600", glow: "rgba(234,179,8,0.6)" },
  elite: { label: "Elite", gradient: "from-red-700 via-red-500 to-rose-700", glow: "rgba(239,68,68,0.55)" },
  legendary: { label: "Legendary", gradient: "from-fuchsia-600 via-amber-400 to-orange-600", glow: "rgba(217,70,239,0.65)" },
};

export type UpgradePayload = {
  previous_tier: string;
  new_tier: string;
  previous_bfr: number;
  new_bfr: number;
};

export function PlayerCardUpgradeOverlay({
  upgrade,
  onClose,
}: {
  upgrade: UpgradePayload;
  onClose: () => void;
}) {
  const newMeta = TIER_META[upgrade.new_tier] ?? TIER_META.gold;
  const prevMeta = TIER_META[upgrade.previous_tier] ?? TIER_META.bronze;
  const delta = upgrade.new_bfr - upgrade.previous_bfr;

  // Auto-Close nach 6 s
  useEffect(() => {
    const t = setTimeout(onClose, 6000);
    return () => clearTimeout(t);
  }, [onClose]);

  // Konfetti-Partikel (deterministisch)
  const particles = useMemo(
    () =>
      Array.from({ length: 40 }, (_, i) => ({
        id: i,
        left: (i * 137) % 100,
        delay: (i % 10) * 0.15,
        duration: 2 + ((i * 7) % 20) / 10,
        color: ["#f59e0b", "#ef4444", "#eab308", "#f97316", "#fbbf24"][i % 5],
      })),
    [],
  );

  return (
    <div
      className="fixed inset-0 z-[100] grid place-items-center bg-black/80 p-4 backdrop-blur-sm animate-in fade-in duration-300"
      onClick={onClose}
    >
      {/* Konfetti */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {particles.map((p) => (
          <span
            key={p.id}
            className="absolute top-[-20px] block h-2 w-2 rounded-sm pc-upgrade-confetti"
            style={{
              left: `${p.left}%`,
              backgroundColor: p.color,
              animationDelay: `${p.delay}s`,
              animationDuration: `${p.duration}s`,
            }}
          />
        ))}
      </div>

      <div
        className="relative z-10 w-full max-w-md rounded-3xl border border-white/10 bg-gradient-to-b from-neutral-900 to-neutral-950 p-8 text-center shadow-2xl pc-upgrade-pop"
        style={{ boxShadow: `0 0 80px ${newMeta.glow}` }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-full text-white/60 transition hover:bg-white/10 hover:text-white"
          aria-label="Schließen"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-white/5">
          <Sparkles className="h-8 w-8 text-yellow-300 pc-upgrade-sparkle" />
        </div>

        <div className="mt-4 text-[10px] font-bold uppercase tracking-[0.35em] text-white/60">
          Tier-Upgrade
        </div>

        <div className="mt-2 text-3xl font-black uppercase tracking-tight text-white">
          Willkommen bei
        </div>

        <div
          className={`mt-3 bg-gradient-to-r ${newMeta.gradient} bg-clip-text text-6xl font-black uppercase tracking-tight text-transparent pc-upgrade-tier`}
        >
          {newMeta.label}
        </div>

        <div className="mt-4 flex items-center justify-center gap-3 text-sm">
          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-white/60">
            {prevMeta.label}
          </span>
          <TrendingUp className="h-4 w-4 text-emerald-400" />
          <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1 font-bold text-white">
            {newMeta.label}
          </span>
        </div>

        <div className="mt-6 rounded-2xl border border-white/10 bg-black/40 p-4">
          <div className="text-[10px] font-bold uppercase tracking-[0.3em] text-white/50">
            Dein neues BFR
          </div>
          <div className="mt-1 flex items-baseline justify-center gap-2">
            <span className="text-5xl font-black tabular-nums text-white">{upgrade.new_bfr}</span>
            <span className="text-sm font-bold text-emerald-400">
              +{delta.toFixed(0)}
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="mt-6 w-full rounded-full bg-white px-6 py-3 text-sm font-bold uppercase tracking-wider text-black transition hover:bg-white/90"
        >
          Weiter
        </button>
      </div>
    </div>
  );
}
