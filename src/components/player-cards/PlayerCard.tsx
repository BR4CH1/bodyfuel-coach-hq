/**
 * Player Card — Ultimate-Team-Style, SVG-basiert.
 * Feste 820×1180 Designfläche, skaliert proportional.
 */
import { useEffect, useMemo, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { supabase } from "@/integrations/supabase/client";
import type { AttributeKey, Tier } from "@/lib/player-cards/engine";

const AVATAR_CACHE = new Map<string, { url: string; expires: number }>();
const AVATAR_TTL_MS = 45 * 60 * 1000;

async function resolvePlayerAvatar(raw: string | null | undefined): Promise<string | null> {
  if (!raw) return null;
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
  profile: {
    display_name: string | null;
    nickname: string | null;
    avatar_url: string | null;
    avatar_cutout_url?: string | null;
    avatar_cutout_source?: string | null;
    birthdate: string | null;
    height_cm: number | null;
    sport_position: string | null;
  } | null;
  bullsProfile: {
    first_name: string | null;
    last_name: string | null;
    weight_kg: number | null;
    height_cm: number | null;
    position: string | null;
  } | null;
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
  history?: Array<{ bfr: number | null; computed_at: string }>;
  shareUrl?: string | null;
};

const TIER_LABELS: Record<Tier, string> = {
  bronze: "BRONZE",
  silver: "SILBER",
  gold: "GOLD",
  elite: "ELITE",
  legendary: "LEGENDARY",
};

const ATTR_LABELS: Record<AttributeKey, string> = {
  SPD: "SPD", ACC: "ACC", AGI: "AGI", POW: "POW", STR: "STR", END: "END",
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

/** Count-up hook — sanfte Animation von 0 auf `target`. */
function useCountUp(target: number | null, duration = 900): number | null {
  const [val, setVal] = useState<number | null>(target == null ? null : 0);
  useEffect(() => {
    if (target == null) { setVal(null); return; }
    let raf = 0;
    const start = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setVal(Math.round(target * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return val;
}

// ─── Icons als SVG-Paths (24×24 viewBox) ───────────────────────────
const ICON_PATHS: Record<AttributeKey, string> = {
  // Sprint / Runner
  SPD: "M13 4a2 2 0 1 1-4 0 2 2 0 0 1 4 0zM4 22l3-8 5-3 4 4 4 1M7 14l-2 3M12 11l1-3-3-2-3 3v3l3 2",
  // Lightning
  ACC: "M13 2 3 14h7l-1 8 10-12h-7l1-8z",
  // Agility (arrow zigzag)
  AGI: "M4 20 20 4M4 4l6 6M20 20l-6-6",
  // Explosion / Power
  POW: "M12 2v4l3-2 1 4 4-1-2 3 4 1-4 2 2 3-4-1-1 4-3-2v4l-3-3-3 3v-4l-3 2-1-4-4 1 2-3-4-1 4-2-2-3 4 1 1-4 3 2V2z",
  // Dumbbell
  STR: "M6 8v8M4 6v12M18 6v12M20 8v8M6 12h12",
  // Heart pulse
  END: "M20 6c0-2-2-3-4-3s-3 1-4 2c-1-1-2-2-4-2S4 4 4 6c0 5 8 12 8 12s8-7 8-12zM4 12h3l2-3 2 5 2-3h6",
};

function AttrIcon({ attr, color, size = 34 }: { attr: AttributeKey; color: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d={ICON_PATHS[attr]} />
    </svg>
  );
}

// ─── Trend Line ──────────────────────────────────────────────────
function TrendLine({ points, color, width, height }: { points: number[]; color: string; width: number; height: number }) {
  if (points.length < 2) return null;
  const min = Math.min(...points) - 2;
  const max = Math.max(...points) + 2;
  const range = Math.max(1, max - min);
  const pad = 12;
  const step = (width - pad * 2) / (points.length - 1);
  const coords = points.map((p, i) => {
    const x = pad + i * step;
    const y = pad + (height - pad * 2) * (1 - (p - min) / range);
    return { x, y };
  });
  const path = coords.map((c, i) => (i === 0 ? `M${c.x},${c.y}` : `L${c.x},${c.y}`)).join(" ");
  return (
    <g>
      {/* grid */}
      {[0, 0.5, 1].map((t) => (
        <line key={t} x1={pad} x2={width - pad} y1={pad + (height - pad * 2) * t} y2={pad + (height - pad * 2) * t}
              stroke="#ffffff" strokeOpacity="0.06" strokeWidth="1" />
      ))}
      <path d={path} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
            filter="url(#pc-glow-red)" />
      {coords.map((c, i) => (
        <g key={i}>
          <circle cx={c.x} cy={c.y} r="4" fill="#0a0a0a" stroke={color} strokeWidth="2" />
          <text x={c.x} y={c.y - 8} textAnchor="middle" fontSize="12" fontFamily="Oswald, sans-serif" fontWeight="700" fill="#fff">
            {points[i]}
          </text>
        </g>
      ))}
    </g>
  );
}

// ─── Stat-Column ─────────────────────────────────────────────────
function StatCol({ x, cx, attr, value, accent, animated }: {
  x: number; cx: number; attr: AttributeKey; value: number | null; accent: string; animated: number | null;
}) {
  const display = animated ?? "—";
  const segs = 6;
  const filled = value == null ? 0 : Math.round((value / 99) * segs);
  return (
    <g>
      <text x={cx} y={30} textAnchor="middle" fontFamily="Oswald, sans-serif" fontWeight="700"
            fontSize="20" fill="#ffffff" opacity="0.75" letterSpacing="2">{ATTR_LABELS[attr]}</text>
      <text x={cx} y={82} textAnchor="middle" fontFamily="Bebas Neue, Oswald, sans-serif"
            fontSize="60" fill="#ffffff">{display}</text>
      <g transform={`translate(${cx - 17}, 96)`}>
        <AttrIcon attr={attr} color={accent} size={34} />
      </g>
      <g transform={`translate(${cx - 42}, 148)`}>
        {Array.from({ length: segs }).map((_, i) => (
          <rect key={i} x={i * 15} y={0} width="12" height="5" rx="1.5"
                fill={i < filled ? accent : "#ffffff"} opacity={i < filled ? 1 : 0.14} />
        ))}
      </g>
      <text x={cx} y={175} textAnchor="middle" fontFamily="Oswald, sans-serif" fontWeight="600"
            fontSize="14" fill="#ffffff" opacity="0.6" letterSpacing="1">
        {value ?? "—"} PCTL
      </text>
    </g>
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

  const { card, profile, bullsProfile, organization, jerseyNumber, teamLabel, history, shareUrl } = data;

  const primary = organization?.primary_color ?? "#E10600";
  const accent = organization?.accent_color ?? primary;
  const claim = organization?.claim ?? "BUILT FOR TEAMS. DRIVEN BY PERFORMANCE.";

  const first = (bullsProfile?.first_name || profile?.display_name?.split(" ")[0] || profile?.nickname || "").toUpperCase();
  const last = (
    bullsProfile?.last_name ||
    (profile?.display_name?.includes(" ") ? profile?.display_name?.split(" ").slice(1).join(" ") : "") ||
    ""
  ).toUpperCase();
  const age = computeAge(profile?.birthdate);
  const height = bullsProfile?.height_cm ?? profile?.height_cm ?? null;
  const weight = bullsProfile?.weight_kg ?? null;
  const position = (card.position_key ?? bullsProfile?.position ?? profile?.sport_position ?? "").toUpperCase();
  const strongestLabel = card.strongest_attribute ? ATTR_LABELS[card.strongest_attribute] : "—";

  // Count-ups
  const ovr = useCountUp(card.bfr);
  const spd = useCountUp(card.spd);
  const acc = useCountUp(card.acc);
  const agi = useCountUp(card.agi);
  const pow = useCountUp(card.pow);
  const str = useCountUp(card.str);
  const end = useCountUp(card.end_score);

  // Trendlinie (max letzten 4 Werte + aktuellen)
  const trendPoints = useMemo(() => {
    const raw = (history ?? []).map((h) => h.bfr).filter((v): v is number => typeof v === "number");
    const pts = raw.slice(-4);
    if (card.bfr != null && (pts[pts.length - 1] !== card.bfr)) pts.push(card.bfr);
    return pts.length >= 2 ? pts : (card.bfr != null ? [Math.max(0, card.bfr - 3), card.bfr] : []);
  }, [history, card.bfr]);

  const delta = trendPoints.length >= 2 ? trendPoints[trendPoints.length - 1] - trendPoints[0] : 0;
  const deltaStr = delta > 0 ? `+${delta}` : `${delta}`;

  const updateDate = new Date(card.computed_at).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
  const qrValue = shareUrl || (typeof window !== "undefined" ? window.location.href : "https://bodyfuel-coaching.com");

  // Kartenpfad — Shield mit sanften Ecken und subtiler Top-Einbuchtung
  const framePath = `
    M 60 20
    L 380 20
    Q 410 20 410 40
    Q 410 20 440 20
    L 760 20
    Q 800 20 800 60
    L 800 1120
    Q 800 1160 760 1160
    L 60 1160
    Q 20 1160 20 1120
    L 20 60
    Q 20 20 60 20 Z
  `;

  return (
    <div className="relative h-full w-full pc-fadein">
      <svg
        viewBox="0 0 820 1180"
        preserveAspectRatio="xMidYMid meet"
        xmlns="http://www.w3.org/2000/svg"
        className="h-full w-full"
        style={{ filter: "drop-shadow(0 30px 60px rgba(0,0,0,0.7))" }}
      >
        <defs>
          {/* Metallic Frame Gradient */}
          <linearGradient id="pc-frame-metal" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#d0d3d8" />
            <stop offset="25%" stopColor="#6a6d73" />
            <stop offset="50%" stopColor="#2a2c30" />
            <stop offset="75%" stopColor="#5a5d63" />
            <stop offset="100%" stopColor="#0f1013" />
          </linearGradient>
          <linearGradient id="pc-frame-red" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={primary} stopOpacity="0.9" />
            <stop offset="50%" stopColor="#8b0000" stopOpacity="0.6" />
            <stop offset="100%" stopColor={primary} stopOpacity="0.9" />
          </linearGradient>

          {/* Hintergrund-Ebenen */}
          <radialGradient id="pc-bg-glow" cx="50%" cy="42%" r="55%">
            <stop offset="0%" stopColor={primary} stopOpacity="0.55" />
            <stop offset="40%" stopColor="#4a0000" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#000" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="pc-bg-base" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#1a0a0a" />
            <stop offset="45%" stopColor="#0a0a0a" />
            <stop offset="100%" stopColor="#000000" />
          </linearGradient>

          {/* Carbon-Muster */}
          <pattern id="pc-carbon" x="0" y="0" width="14" height="14" patternUnits="userSpaceOnUse">
            <rect width="14" height="14" fill="#000" />
            <path d="M0 7 L7 0 L14 7 L7 14 Z" fill="#141414" />
            <circle cx="7" cy="7" r="0.5" fill="#1e1e1e" />
          </pattern>

          {/* Diagonale rote Linien */}
          <pattern id="pc-streaks" x="0" y="0" width="180" height="180" patternUnits="userSpaceOnUse" patternTransform="rotate(-20)">
            <line x1="0" y1="30" x2="180" y2="30" stroke={primary} strokeWidth="1" strokeOpacity="0.08" />
            <line x1="0" y1="70" x2="180" y2="70" stroke={primary} strokeWidth="0.5" strokeOpacity="0.05" />
            <line x1="0" y1="120" x2="180" y2="120" stroke={primary} strokeWidth="1.5" strokeOpacity="0.06" />
          </pattern>

          {/* Noise */}
          <filter id="pc-noise">
            <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="7" />
            <feColorMatrix values="0 0 0 0 0.6  0 0 0 0 0.6  0 0 0 0 0.6  0 0 0 0.15 0" />
          </filter>

          {/* Distressed für Nachname */}
          <filter id="pc-distress" x="-5%" y="-5%" width="110%" height="110%">
            <feTurbulence type="fractalNoise" baseFrequency="0.02 0.06" numOctaves="2" seed="3" result="t" />
            <feDisplacementMap in="SourceGraphic" in2="t" scale="4" />
          </filter>

          {/* Glows */}
          <filter id="pc-glow-red" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="4" result="b" />
            <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <filter id="pc-glow-strong" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="12" result="b" />
            <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>

          {/* Metallic-Text-Gradient */}
          <linearGradient id="pc-name-metal" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="35%" stopColor="#f4f5f7" />
            <stop offset="55%" stopColor="#c8ccd2" />
            <stop offset="80%" stopColor="#7a7e85" />
            <stop offset="100%" stopColor="#4a4d52" />
          </linearGradient>

          {/* Stat-Panel Verlauf */}
          <linearGradient id="pc-panel" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#181818" stopOpacity="0.95" />
            <stop offset="100%" stopColor="#050505" stopOpacity="0.98" />
          </linearGradient>

          {/* Clip auf Kartenfläche */}
          <clipPath id="pc-clip">
            <path d={framePath} />
          </clipPath>
        </defs>

        {/* ─────────── HINTERGRUND ─────────── */}
        <g clipPath="url(#pc-clip)">
          <rect x="20" y="20" width="780" height="1140" fill="url(#pc-bg-base)" />
          <rect x="20" y="20" width="780" height="1140" fill="url(#pc-carbon)" opacity="0.6" />
          <rect x="20" y="20" width="780" height="1140" fill="url(#pc-streaks)" />
          <ellipse cx="410" cy="480" rx="360" ry="440" fill="url(#pc-bg-glow)" />
          {/* rote Partikel */}
          {Array.from({ length: 40 }).map((_, i) => {
            const seed = (i * 9301 + 49297) % 233280;
            const x = 40 + (seed % 740);
            const y = 40 + ((seed * 3) % 1080);
            const r = 0.5 + ((seed * 7) % 20) / 20;
            return <circle key={i} cx={x} cy={y} r={r} fill={primary} opacity={0.15 + (r * 0.15)} />;
          })}
          {/* Noise-Overlay */}
          <rect x="20" y="20" width="780" height="1140" filter="url(#pc-noise)" opacity="0.5" />
          {/* Vignette */}
          <radialGradient id="pc-vignette" cx="50%" cy="50%" r="70%">
            <stop offset="60%" stopColor="#000" stopOpacity="0" />
            <stop offset="100%" stopColor="#000" stopOpacity="0.85" />
          </radialGradient>
          <rect x="20" y="20" width="780" height="1140" fill="url(#pc-vignette)" />
        </g>

        {/* ─────────── SPIELERBILD ─────────── */}
        {avatarUrl && (
          <g clipPath="url(#pc-clip)">
            {/* Glow hinter Spieler */}
            <ellipse cx="440" cy="420" rx="240" ry="300" fill={primary} opacity="0.35" filter="url(#pc-glow-strong)" />
            <image
              href={avatarUrl}
              x="120"
              y="60"
              width="640"
              height="820"
              preserveAspectRatio="xMidYMax meet"
              style={{ filter: `drop-shadow(0 40px 30px rgba(0,0,0,0.7))` }}
              onError={() => { if (rawAvatar) AVATAR_CACHE.delete(rawAvatar); setAvatarUrl(null); }}
            />
          </g>
        )}

        {/* ─────────── OVR LINKS ─────────── */}
        <g>
          <text x="90" y="180" fontFamily="Bebas Neue, Anton, sans-serif" fontSize="160" fill="#ffffff"
                style={{ letterSpacing: "-4px" }} filter="url(#pc-glow-red)">
            {ovr ?? "—"}
          </text>
          <text x="94" y="220" fontFamily="Oswald, sans-serif" fontWeight="800" fontSize="30" fill={primary}
                letterSpacing="4">OVR</text>
          {position && (
            <>
              <text x="90" y="320" fontFamily="Bebas Neue, Anton, sans-serif" fontSize="88" fill={primary}
                    style={{ letterSpacing: "-2px" }}>{position}</text>
              <line x1="94" y1="336" x2="170" y2="336" stroke={primary} strokeWidth="3" />
              {jerseyNumber && (
                <text x="94" y="376" fontFamily="Oswald, sans-serif" fontWeight="700" fontSize="28" fill="#fff"
                      letterSpacing="2">#{jerseyNumber}</text>
              )}
            </>
          )}
        </g>

        {/* ─────────── VEREINSLOGO ─────────── */}
        {organization?.logo_url ? (
          <image href={organization.logo_url} x="620" y="70" width="160" height="160" preserveAspectRatio="xMidYMid meet" />
        ) : (
          <g>
            <circle cx="700" cy="150" r="70" fill="none" stroke={primary} strokeWidth="4" />
            <text x="700" y="165" textAnchor="middle" fontFamily="Oswald, sans-serif" fontWeight="800" fontSize="30" fill={primary}>
              {organization?.short_name ?? "BF"}
            </text>
          </g>
        )}
        {organization?.short_name && organization?.logo_url && (
          <text x="700" y="255" textAnchor="middle" fontFamily="Oswald, sans-serif" fontWeight="800" fontSize="22"
                fill={primary} letterSpacing="3">{organization.short_name.toUpperCase()}</text>
        )}

        {/* ─────────── BODY-STATS LINKS ─────────── */}
        <g fontFamily="Oswald, sans-serif" fontWeight="600" fontSize="20" fill="#ffffff">
          {age != null && (
            <g transform="translate(90, 500)">
              <rect x="0" y="-16" width="22" height="22" rx="3" fill="none" stroke={primary} strokeWidth="1.5" />
              <line x1="0" y1="-8" x2="22" y2="-8" stroke={primary} strokeWidth="1.5" />
              <text x="34" y="2">{age} JAHRE</text>
            </g>
          )}
          {height != null && (
            <g transform="translate(90, 540)">
              <rect x="0" y="-16" width="22" height="14" rx="2" fill="none" stroke={primary} strokeWidth="1.5" />
              <line x1="5" y1="-16" x2="5" y2="-8" stroke={primary} strokeWidth="1" />
              <line x1="11" y1="-16" x2="11" y2="-11" stroke={primary} strokeWidth="1" />
              <line x1="17" y1="-16" x2="17" y2="-8" stroke={primary} strokeWidth="1" />
              <text x="34" y="0">{height} CM</text>
            </g>
          )}
          {weight != null && (
            <g transform="translate(90, 580)">
              <circle cx="11" cy="-6" r="10" fill="none" stroke={primary} strokeWidth="1.5" />
              <path d="M11 -12 L11 -6 L15 -3" stroke={primary} strokeWidth="1.5" fill="none" strokeLinecap="round" />
              <text x="34" y="0">{weight} KG</text>
            </g>
          )}
          {card.is_provisional && (
            <g transform="translate(90, 620)">
              <rect x="0" y="-16" width="130" height="24" rx="3" fill="#f59e0b" />
              <text x="65" y="1" textAnchor="middle" fontSize="14" fontWeight="800" fill="#000" letterSpacing="2">VORLÄUFIG</text>
            </g>
          )}
        </g>

        {/* ─────────── NAME ─────────── */}
        <g textAnchor="middle">
          {first && (
            <text x="410" y="770" fontFamily="Bebas Neue, Anton, sans-serif" fontSize="42" fill={primary}
                  fontStyle="italic" letterSpacing="6" filter="url(#pc-glow-red)">{first}</text>
          )}
          <text x="410" y="880" fontFamily="Anton, Bebas Neue, sans-serif"
                fontSize={last.length > 8 ? 108 : last.length > 6 ? 128 : 148}
                fill="url(#pc-name-metal)" letterSpacing="2"
                filter="url(#pc-distress)"
                style={{ paintOrder: "stroke", stroke: "rgba(0,0,0,0.6)", strokeWidth: 2 }}>
            {last || "—"}
          </text>
          <text x="410" y="920" fontFamily="Oswald, sans-serif" fontWeight="600" fontSize="18"
                fill="#ffffff" opacity="0.75" letterSpacing="6">
            {[teamLabel, position, jerseyNumber ? `#${jerseyNumber}` : null].filter(Boolean).join("   •   ").toUpperCase()}
          </text>
        </g>

        {/* ─────────── STAT-PANEL ─────────── */}
        <g transform="translate(50, 940)">
          <rect x="0" y="0" width="720" height="185" rx="14" fill="url(#pc-panel)" stroke="#ffffff" strokeOpacity="0.12" />
          {[0, 1, 2, 3, 4].map((i) => (
            <line key={i} x1={120 + i * 120} y1="20" x2={120 + i * 120} y2="165" stroke="#ffffff" strokeOpacity="0.08" />
          ))}
          <StatCol x={0} cx={60}  attr="SPD" value={card.spd}       accent={primary} animated={spd} />
          <StatCol x={0} cx={180} attr="ACC" value={card.acc}       accent={primary} animated={acc} />
          <StatCol x={0} cx={300} attr="AGI" value={card.agi}       accent={primary} animated={agi} />
          <StatCol x={0} cx={420} attr="POW" value={card.pow}       accent={primary} animated={pow} />
          <StatCol x={0} cx={540} attr="STR" value={card.str}       accent={primary} animated={str} />
          <StatCol x={0} cx={660} attr="END" value={card.end_score} accent={primary} animated={end} />
        </g>

        {/* ─────────── INFO-PANEL ─────────── */}
        <g transform="translate(50, 1145)">
          <rect x="0" y="0" width="720" height="80" rx="12" fill="url(#pc-panel)" stroke="#ffffff" strokeOpacity="0.12" />
          <line x1="240" y1="15" x2="240" y2="65" stroke="#ffffff" strokeOpacity="0.1" />
          <line x1="480" y1="15" x2="480" y2="65" stroke="#ffffff" strokeOpacity="0.1" />

          {/* Kartenstufe */}
          <g transform="translate(120, 25)">
            <path d="M-8 -6 L0 -10 L8 -6 L8 4 Q0 12 -8 4 Z" fill="none" stroke={primary} strokeWidth="1.8" />
            <text x="22" y="0" fontFamily="Oswald, sans-serif" fontWeight="700" fontSize="13" fill="#fff" opacity="0.65" letterSpacing="2">KARTENSTUFE</text>
            <text x="0" y="34" textAnchor="middle" fontFamily="Anton, Bebas Neue, sans-serif" fontSize="26" fill={primary} letterSpacing="3">
              {card.tier ? TIER_LABELS[card.tier] : "—"}
            </text>
          </g>
          {/* Letztes Update */}
          <g transform="translate(360, 25)">
            <rect x="-10" y="-10" width="20" height="16" rx="2" fill="none" stroke={primary} strokeWidth="1.8" />
            <line x1="-10" y1="-4" x2="10" y2="-4" stroke={primary} strokeWidth="1.5" />
            <text x="22" y="0" fontFamily="Oswald, sans-serif" fontWeight="700" fontSize="13" fill="#fff" opacity="0.65" letterSpacing="2">LETZTES UPDATE</text>
            <text x="0" y="34" textAnchor="middle" fontFamily="Anton, Bebas Neue, sans-serif" fontSize="26" fill="#fff" letterSpacing="2">
              {updateDate}
            </text>
          </g>
          {/* Grösste Stärke */}
          <g transform="translate(600, 25)">
            <path d="M-4 -10 L-8 0 L-2 0 L-4 8 L6 -4 L0 -4 L4 -10 Z" fill={primary} />
            <text x="22" y="0" fontFamily="Oswald, sans-serif" fontWeight="700" fontSize="13" fill="#fff" opacity="0.65" letterSpacing="2">GRÖSSTE STÄRKE</text>
            <text x="0" y="34" textAnchor="middle" fontFamily="Anton, Bebas Neue, sans-serif" fontSize="26" fill={primary} letterSpacing="3">
              {strongestLabel}
            </text>
          </g>
        </g>

        {/* ─────────── ENTWICKLUNG + TREND + QR ─────────── */}
        <g transform="translate(50, 1250)">
          <rect x="0" y="-15" width="720" height="0.5" fill="#ffffff" opacity="0.08" />
        </g>

        {/* ─── Untere Zeile innerhalb Framehöhe (verschoben in Frame) ─── */}

        {/* Right-side vertical claim */}
        <g transform="translate(795, 590) rotate(-90)">
          <text textAnchor="middle" fontFamily="Oswald, sans-serif" fontWeight="700" fontSize="14"
                fill="#ffffff" opacity="0.35" letterSpacing="8">
            {claim}
          </text>
        </g>

        {/* ─────────── RAHMEN (über allem) ─────────── */}
        <path d={framePath} fill="none" stroke="url(#pc-frame-metal)" strokeWidth="10" />
        <path d={framePath} fill="none" stroke="url(#pc-frame-red)" strokeWidth="2" opacity="0.9" />
        <path d={framePath} fill="none" stroke="#ffffff" strokeWidth="0.6" strokeOpacity="0.35" transform="translate(0,-1)" />
        {/* Innerer feiner Rand */}
        <path
          d="M 35 45 L 380 45 Q 410 45 410 62 Q 410 45 440 45 L 785 45 L 785 1145 L 35 1145 Z"
          fill="none"
          stroke={primary}
          strokeWidth="1"
          strokeOpacity="0.5"
          strokeDasharray="0"
        />
      </svg>

      {/* Untere Zeile: OVR-Entwicklung + Trend + QR — als absolut positionierte Foreign-Content
          direkt auf der SVG-Fläche (weil QR sonst via CANVAS/SVG hier eingebettet). */}
      <div className="pointer-events-none absolute inset-0">
        <div
          className="absolute"
          style={{
            left: "6%", right: "6%", bottom: "3%",
            display: "grid",
            gridTemplateColumns: "1fr 1.2fr 1fr",
            gap: "2%",
            alignItems: "center",
          }}
        >
          {/* OVR Entwicklung */}
          <div className="text-center">
            <div style={{ fontFamily: "Oswald, sans-serif", fontWeight: 700, fontSize: "clamp(10px, 1.6cqw, 14px)", color: "#ffffffb0", letterSpacing: 2 }}>
              OVR ENTWICKLUNG
            </div>
            <div style={{ fontFamily: "Anton, Bebas Neue, sans-serif", fontSize: "clamp(28px, 6cqw, 54px)", color: primary, lineHeight: 1, textShadow: `0 0 20px ${primary}80` }}>
              {deltaStr}
            </div>
            <div style={{ fontFamily: "Oswald, sans-serif", fontSize: "clamp(9px, 1.4cqw, 12px)", color: "#ffffff80", letterSpacing: 1 }}>
              SEIT LETZTEM TEST
            </div>
          </div>

          {/* Trendlinie inline SVG */}
          <div style={{ height: "100%", minHeight: 70 }}>
            <svg viewBox="0 0 240 90" preserveAspectRatio="xMidYMid meet" style={{ width: "100%", height: "100%" }}>
              <defs>
                <filter id="pc-trend-glow"><feGaussianBlur stdDeviation="2" /></filter>
              </defs>
              <TrendLine points={trendPoints} color={primary} width={240} height={90} />
            </svg>
          </div>

          {/* QR */}
          <div className="pointer-events-auto flex flex-col items-center gap-1">
            <div
              style={{
                padding: 6,
                background: "#fff",
                borderRadius: 4,
                boxShadow: `0 0 0 2px ${primary}, 0 0 12px ${primary}80`,
              }}
            >
              <QRCodeSVG value={qrValue} size={72} level="M" bgColor="#ffffff" fgColor="#000000" />
            </div>
            <div style={{ fontFamily: "Oswald, sans-serif", fontWeight: 700, fontSize: "clamp(8px, 1.2cqw, 11px)", color: "#ffffff90", letterSpacing: 2 }}>
              #BUILTTOPERFORM
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
