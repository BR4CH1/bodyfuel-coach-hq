/**
 * Player Card — Vorderseite.
 * Übernimmt Vereinsfarben automatisch aus organization.primary_color etc.
 */
import { Rocket, Zap, Activity, Flame, Dumbbell, HeartPulse, Shield, Calendar, Ruler, Scale } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { AttributeKey, Tier } from "@/lib/player-cards/engine";

const AVATAR_CACHE = new Map<string, { url: string; expires: number }>();
const AVATAR_TTL_MS = 45 * 60 * 1000;

async function resolvePlayerAvatar(raw: string | null | undefined): Promise<string | null> {
  if (!raw) return null;
  // Already a full URL (http/https/data)? Use as-is.
  if (/^(https?:|data:|blob:)/i.test(raw)) return raw;
  const cached = AVATAR_CACHE.get(raw);
  if (cached && cached.expires > Date.now()) return cached.url;
  const { data, error } = await supabase.storage.from("avatars").createSignedUrl(raw, 3600);
  if (error || !data?.signedUrl) return null;
  AVATAR_CACHE.set(raw, { url: data.signedUrl, expires: Date.now() + AVATAR_TTL_MS });
  return data.signedUrl;
}

export type PlayerCardData = {
  card: {
    bfr: number | null;
    spd: number | null;
    acc: number | null;
    agi: number | null;
    pow: number | null;
    str: number | null;
    end_score: number | null;
    tier: Tier | null;
    is_provisional: boolean;
    position_key: string | null;
    strongest_attribute: AttributeKey | null;
    computed_at: string;
  };
  profile: { display_name: string | null; nickname: string | null; avatar_url: string | null; avatar_cutout_url?: string | null; avatar_cutout_source?: string | null; birthdate: string | null; height_cm: number | null; sport_position: string | null } | null;
  bullsProfile: { first_name: string | null; last_name: string | null; weight_kg: number | null; height_cm: number | null; position: string | null } | null;
  organization: {
    id: string;
    name: string;
    logo_url: string | null;
    primary_color: string | null;
    secondary_color: string | null;
    accent_color: string | null;
    background_color: string | null;
    text_color: string | null;
    claim: string | null;
    short_name: string | null;
  } | null;
  jerseyNumber?: string | null;
  teamLabel?: string | null;
};

const TIER_LABELS: Record<Tier, string> = {
  bronze: "BRONZE",
  silver: "SILBER",
  gold: "GOLD",
  elite: "ELITE",
  legendary: "LEGENDARY",
};

const ATTR_META: Record<AttributeKey, { label: string; Icon: typeof Rocket }> = {
  SPD: { label: "SPD", Icon: Rocket },
  ACC: { label: "ACC", Icon: Zap },
  AGI: { label: "AGI", Icon: Activity },
  POW: { label: "POW", Icon: Flame },
  STR: { label: "STR", Icon: Dumbbell },
  END: { label: "END", Icon: HeartPulse },
};

function computeAge(birthdate: string | null | undefined): number | null {
  if (!birthdate) return null;
  const d = new Date(birthdate);
  if (Number.isNaN(d.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
  return age;
}

function AttrPill({ attr, value }: { attr: AttributeKey; value: number | null }) {
  const { label, Icon } = ATTR_META[attr];
  const segs = 6;
  const filled = value == null ? 0 : Math.round((value / 99) * segs);
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="text-[9px] font-semibold uppercase tracking-[0.2em] text-white/70">{label}</div>
      <div className="font-display text-2xl font-black tabular-nums text-white leading-none">
        {value ?? "—"}
      </div>
      <Icon className="h-3.5 w-3.5" style={{ color: "var(--pc-accent)" }} />
      <div className="flex gap-0.5">
        {Array.from({ length: segs }).map((_, i) => (
          <span
            key={i}
            className="h-1 w-1.5 rounded-sm"
            style={{
              background: i < filled ? "var(--pc-accent)" : "rgba(255,255,255,0.15)",
            }}
          />
        ))}
      </div>
      <div className="text-[8px] font-medium tracking-wide text-white/50">{value ?? "—"} PCTL</div>
    </div>
  );
}



export function PlayerCard({ data }: { data: PlayerCardData }) {
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const rawAvatar = data.profile?.avatar_cutout_url ?? data.profile?.avatar_url ?? null;
  useEffect(() => {
    let alive = true;
    if (!rawAvatar) { setAvatarUrl(null); return; }
    resolvePlayerAvatar(rawAvatar).then((u) => { if (alive) setAvatarUrl(u); });
    return () => { alive = false; };
  }, [rawAvatar]);
  const { card, profile, bullsProfile, organization, jerseyNumber, teamLabel } = data;

  const primary = organization?.primary_color ?? "#dc2626"; // bulls red default
  const bg = organization?.background_color ?? "#0a0a0a";
  const accent = organization?.accent_color ?? primary;
  const text = organization?.text_color ?? "#ffffff";
  const claim = organization?.claim ?? "BUILT FOR TEAMS. DRIVEN BY PERFORMANCE.";

  const first = bullsProfile?.first_name || profile?.display_name?.split(" ")[0] || profile?.nickname || "";
  const last =
    bullsProfile?.last_name ||
    (profile?.display_name?.includes(" ") ? profile?.display_name?.split(" ").slice(1).join(" ") : "") ||
    "";
  const age = computeAge(profile?.birthdate);
  const height = bullsProfile?.height_cm ?? profile?.height_cm ?? null;
  const weight = bullsProfile?.weight_kg ?? null;
  const position = card.position_key ?? bullsProfile?.position ?? profile?.sport_position ?? "";

  const tierClass = card.tier ? `pc-tier-glow-${card.tier}` : "";
  const strongestLabel = card.strongest_attribute ? ATTR_META[card.strongest_attribute].label : "—";

  return (
    <div
      className={`relative w-full h-full rounded-[28px] pc-metal-frame p-[3px] ${tierClass}`}
      style={{
        ["--pc-accent" as any]: accent,
        ["--pc-primary" as any]: primary,
      }}
    >
      <div
        className="relative h-full w-full overflow-hidden rounded-[26px]"
        style={{
          background: `radial-gradient(120% 90% at 50% 0%, color-mix(in oklab, ${primary} 25%, ${bg}) 0%, ${bg} 55%, #000 100%)`,
          color: text,
        }}
      >
        {/* Corner accents */}
        <div className="pointer-events-none absolute inset-0" style={{
          background: `linear-gradient(180deg, transparent 0%, transparent 85%, color-mix(in oklab, ${primary} 30%, transparent) 100%)`,
        }} />
        <div className="pointer-events-none absolute inset-x-6 top-3 h-px" style={{ background: `linear-gradient(90deg, transparent, ${accent}, transparent)` }} />

        {/* Vertical claim on the right */}
        <div className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 rotate-180 text-[7px] font-semibold uppercase tracking-[0.4em] text-white/40" style={{ writingMode: "vertical-rl" }}>
          {claim}
        </div>

        {/* Player image — full body, dominant, behind everything */}
        <div className="pointer-events-none absolute inset-x-0 top-2 bottom-[52%] overflow-visible">
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={first}
              className="h-full w-full object-contain object-bottom"
              style={{ filter: `drop-shadow(0 12px 24px ${accent}66)` }}
              onError={() => {
                if (rawAvatar) AVATAR_CACHE.delete(rawAvatar);
                setAvatarUrl(null);
              }}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-white/20">
              <Shield className="h-20 w-20" />
            </div>
          )}
        </div>

        {/* Header row */}
        <div className="relative flex items-start justify-between px-5 pt-5">
          <div className="relative z-10">
            <div className="font-display text-[68px] font-black leading-[0.85] tabular-nums text-white" style={{ textShadow: "0 2px 12px rgba(0,0,0,0.7)" }}>
              {card.bfr ?? "—"}
            </div>
            <div className="mt-0.5 text-[11px] font-black uppercase tracking-[0.25em]" style={{ color: accent }}>
              OVR
            </div>
            {position && (
              <div className="mt-4">
                <div className="font-display text-3xl font-black leading-none" style={{ color: accent, textShadow: "0 2px 8px rgba(0,0,0,0.6)" }}>
                  {position}
                </div>
                <div className="mt-1 h-px w-8" style={{ background: accent }} />
                {jerseyNumber && (
                  <div className="mt-1 text-xs font-semibold tracking-widest text-white/90">#{jerseyNumber}</div>
                )}
              </div>
            )}
          </div>
          {organization?.logo_url ? (
            <img src={organization.logo_url} alt={organization.name} className="relative z-10 h-16 w-16 object-contain drop-shadow-[0_2px_8px_rgba(0,0,0,0.6)]" />
          ) : (
            <div className="relative z-10 grid h-16 w-16 place-items-center rounded-full border-2 text-[10px] font-bold" style={{ borderColor: accent, color: accent }}>
              {organization?.short_name ?? "BF"}
            </div>
          )}
        </div>

        {/* Stats sidebar left */}
        <div className="absolute left-3 top-[220px] z-10 flex flex-col gap-1.5 text-[10px] text-white/90" style={{ textShadow: "0 1px 4px rgba(0,0,0,0.8)" }}>
          {age != null && (
            <div className="flex items-center gap-1"><Calendar className="h-3 w-3" style={{ color: accent }} /> {age} J.</div>
          )}
          {height != null && (
            <div className="flex items-center gap-1"><Ruler className="h-3 w-3" style={{ color: accent }} /> {height} cm</div>
          )}
          {weight != null && (
            <div className="flex items-center gap-1"><Scale className="h-3 w-3" style={{ color: accent }} /> {weight} kg</div>
          )}
          {card.is_provisional && (
            <div className="pointer-events-auto mt-1 rounded-md bg-amber-500/90 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider text-black">
              Vorläufig
            </div>
          )}
        </div>

        {/* Name — huge metallic */}
        <div className="relative z-10 px-4 pt-[46%] text-center">
          {first && (
            <div className="text-[12px] font-bold uppercase tracking-[0.3em] italic" style={{ color: accent, textShadow: "0 2px 6px rgba(0,0,0,0.7)" }}>
              {first}
            </div>
          )}
          <div
            className="font-display font-black uppercase leading-[0.85] tracking-tight"
            style={{
              fontSize: "clamp(36px, 12cqw, 56px)",
              background: "linear-gradient(180deg, #ffffff 0%, #e5e7eb 45%, #6b7280 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              filter: "drop-shadow(0 2px 8px rgba(0,0,0,0.85))",
              letterSpacing: "-0.02em",
            }}
          >
            {last || "—"}
          </div>
          <div className="mt-1 flex items-center justify-center gap-1.5 text-[9px] font-semibold uppercase tracking-[0.25em] text-white/70">
            {teamLabel && <><span>{teamLabel}</span><span style={{ color: accent }}>•</span></>}
            {position && <><span>{position}</span><span style={{ color: accent }}>•</span></>}
            {jerseyNumber && <span>#{jerseyNumber}</span>}
          </div>
        </div>

        {/* 6 attributes */}
        <div className="relative z-10 mx-3 mt-3 grid grid-cols-6 gap-0.5 rounded-xl border border-white/10 bg-black/70 px-1 py-2 backdrop-blur-md">
          <AttrPill attr="SPD" value={card.spd} />
          <AttrPill attr="ACC" value={card.acc} />
          <AttrPill attr="AGI" value={card.agi} />
          <AttrPill attr="POW" value={card.pow} />
          <AttrPill attr="STR" value={card.str} />
          <AttrPill attr="END" value={card.end_score} />
        </div>

        {/* Footer row */}
        <div className="relative z-10 mx-3 mt-2 grid grid-cols-3 gap-1 rounded-xl border border-white/10 bg-black/70 px-2 py-2 text-[8px] backdrop-blur-md">
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 text-white/60">
              <Shield className="h-3 w-3" style={{ color: accent }} />
              <span className="font-semibold uppercase tracking-widest">Kartenstufe</span>
            </div>
            <div className="mt-0.5 text-xs font-black uppercase tracking-wider" style={{ color: accent }}>
              {card.tier ? TIER_LABELS[card.tier] : "—"}
            </div>
          </div>
          <div className="text-center border-x border-white/10">
            <div className="flex items-center justify-center gap-1 text-white/60">
              <Calendar className="h-3 w-3" style={{ color: accent }} />
              <span className="font-semibold uppercase tracking-widest">Letztes Update</span>
            </div>
            <div className="mt-0.5 text-xs font-black tabular-nums text-white">
              {new Date(card.computed_at).toLocaleDateString("de-DE")}
            </div>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 text-white/60">
              <Zap className="h-3 w-3" style={{ color: accent }} />
              <span className="font-semibold uppercase tracking-widest">Grösste Stärke</span>
            </div>
            <div className="mt-0.5 text-xs font-black uppercase tracking-wider" style={{ color: accent }}>
              {strongestLabel}
            </div>
          </div>
        </div>

        {/* Brand footer */}
        <div className="relative z-10 mt-2 mb-2 flex items-center justify-center gap-1.5 text-[8px] font-bold uppercase tracking-[0.35em] text-white/50">
          <Shield className="h-2.5 w-2.5" style={{ color: accent }} />
          BodyFuel Performance
        </div>
      </div>
    </div>
  );
}
