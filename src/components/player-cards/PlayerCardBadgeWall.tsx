/**
 * PlayerCardBadgeWall — Grid aller Badges eines Sports.
 * Freigeschaltete werden farbig, gesperrte gedimmt & mit Beschreibung als
 * Hint angezeigt. Neue (seen_at == null) bekommen einen Pulse-Glow.
 */
import {
  Sparkles, Award, Crown, Rocket, Zap, Activity, Flame, Dumbbell,
  HeartPulse, Shield, TrendingUp, CalendarCheck, Lock,
  type LucideIcon,
} from "lucide-react";

export type BadgeDefinitionRow = {
  key: string;
  category: string;
  label: string;
  description: string;
  icon_key: string;
  tier: string;
  sort_order: number;
};

export type BadgeUnlockRow = {
  badge_key: string;
  unlocked_at: string;
  seen_at: string | null;
  snapshot_bfr: number | null;
};

const ICONS: Record<string, LucideIcon> = {
  sparkles: Sparkles,
  award: Award,
  crown: Crown,
  rocket: Rocket,
  zap: Zap,
  activity: Activity,
  flame: Flame,
  dumbbell: Dumbbell,
  "heart-pulse": HeartPulse,
  shield: Shield,
  "trending-up": TrendingUp,
  "calendar-check": CalendarCheck,
};

const TIER_COLORS: Record<string, string> = {
  bronze: "#cd7f32",
  silver: "#c0c0c0",
  gold: "#facc15",
  elite: "#a78bfa",
  legendary: "#f472b6",
};

export function PlayerCardBadgeWall({
  definitions,
  unlocks,
  accent = "#dc2626",
  compact = false,
}: {
  definitions: BadgeDefinitionRow[];
  unlocks: BadgeUnlockRow[];
  accent?: string;
  compact?: boolean;
}) {
  const unlockMap = new Map<string, BadgeUnlockRow>();
  for (const u of unlocks) unlockMap.set(u.badge_key, u);

  const sorted = [...definitions].sort((a, b) => a.sort_order - b.sort_order);

  return (
    <div className={`grid ${compact ? "grid-cols-4" : "grid-cols-5"} gap-1.5`}>
      {sorted.map((def) => {
        const Icon = ICONS[def.icon_key] ?? Shield;
        const unlock = unlockMap.get(def.key);
        const isUnlocked = !!unlock;
        const isNew = unlock && !unlock.seen_at;
        const tierColor = TIER_COLORS[def.tier] ?? accent;

        return (
          <div
            key={def.key}
            title={`${def.label} — ${def.description}${isUnlocked ? "" : "\n(noch nicht freigeschaltet)"}`}
            className={`group relative flex flex-col items-center gap-0.5 rounded-lg border p-1.5 text-center transition ${
              isUnlocked
                ? "border-white/20 bg-black/40"
                : "border-white/5 bg-black/20 opacity-40"
            } ${isNew ? "pc-badge-new" : ""}`}
            style={{
              boxShadow: isUnlocked
                ? `inset 0 0 12px color-mix(in oklab, ${tierColor} 25%, transparent)`
                : undefined,
            }}
          >
            {isNew && (
              <span className="absolute -right-1 -top-1 rounded-full bg-red-500 px-1 text-[7px] font-black uppercase text-white shadow">
                Neu
              </span>
            )}
            <div
              className="grid h-7 w-7 place-items-center rounded-full"
              style={{
                background: isUnlocked
                  ? `radial-gradient(circle, color-mix(in oklab, ${tierColor} 40%, transparent) 0%, transparent 70%)`
                  : "transparent",
              }}
            >
              {isUnlocked ? (
                <Icon className="h-4 w-4" style={{ color: tierColor }} />
              ) : (
                <Lock className="h-3 w-3 text-white/40" />
              )}
            </div>
            <div
              className="text-[7px] font-bold uppercase leading-tight tracking-wider"
              style={{ color: isUnlocked ? "#ffffff" : "#ffffff70" }}
            >
              {def.label}
            </div>
          </div>
        );
      })}
    </div>
  );
}
