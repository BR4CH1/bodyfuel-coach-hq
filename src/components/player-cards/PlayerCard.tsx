/**
 * Player Card — Ultimate-Team-Style, SVG-basiert.
 * Feste 820×1300 Designfläche, skaliert proportional.
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

const ICON_PATHS: Record<AttributeKey, string> = {
  SPD: "M13 4a2 2 0 1 1-4 0 2 2 0 0 1 4 0zM4 22l3-8 5-3 4 4 4 1M7 14l-2 3",
  ACC: "M13 2 3 14h7l-1 8 10-12h-7l1-8z",
  AGI: "M4 20 20 4M4 4l6 6M20 20l-6-6",
  POW: "M12 2v4l3-2 1 4 4-1-2 3 4 1-4 2 2 3-4-1-1 4-3-2v4l-3-3-3 3v-4l-3 2-1-4-4 1 2-3-4-1 4-2-2-3 4 1 1-4 3 2V2z",
  STR: "M6 8v8M4 6v12M18 6v12M20 8v8M6 12h12",
  END: "M20 6c0-2-2-3-4-3s-3 1-4 2c-1-1-2-2-4-2S4 4 4 6c0 5 8 12 8 12s8-7 8-12zM4 12h3l2-3 2 5 2-3h6",
};

function AttrIcon({ attr, color, size = 34 }: { attr: AttributeKey; color: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d={ICON_PATHS[attr]} />
    </svg>
  );
}

function StatCol({ cx, attr, value, accent, animated }: {
  cx: number; attr: AttributeKey; value: number | null; accent: string; animated: number | null;
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

function TrendLine({ points, color, width, height }: { points: number[]; color: string; width: number; height: number }) {
  if (points.length < 2) return null;
  const min = Math.min(...points) - 2;
  const max = Math.max(...points) + 2;
  const range = Math.max(1, max - min);
  const padX = 20;
  const padTop = 20;
  const padBottom = 16;
  const step = (width - padX * 2) / (points.length - 1);
  const coords = points.map((p, i) => {
    const x = padX + i * step;
    const y = padTop + (height - padTop - padBottom) * (1 - (p - min) / range);
    return { x, y };
  });
  const path = coords.map((c, i) => (i === 0 ? `M${c.x},${c.y}` : `L${c.x},${c.y}`)).join(" ");
  return (
    <g>
      {[0, 0.5, 1].map((t) => (
        <line key={t} x1={padX} x2={width - padX}
              y1={padTop + (height - padTop - padBottom) * t}
              y2={padTop + (height - padTop - padBottom) * t}
              stroke="#ffffff" strokeOpacity="0.06" strokeWidth="1" />
      ))}
      <path d={path} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      {coords.map((c, i) => (
        <g key={i}>
          <circle cx={c.x} cy={c.y} r="4" fill="#0a0a0a" stroke={color} strokeWidth="2" />
          <text x={c.x} y={c.y - 8} textAnchor="middle" fontSize="11" fontFamily="Oswald, sans-serif" fontWeight="700" fill="#fff">
            {points[i]}
          </text>
        </g>
      ))}
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

  const ovr = useCountUp(card.bfr);
  const spd = useCountUp(card.spd);
  const acc = useCountUp(card.acc);
  const agi = useCountUp(card.agi);
  const pow = useCountUp(card.pow);
  const str = useCountUp(card.str);
  const end = useCountUp(card.end_score);

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

  // Kartenform: Shield mit sanfter Top-Einbuchtung
  const framePath = `
    M 60 20
    L 380 20
    Q 410 20 410 40
    Q 410 20 440 20
    L 760 20
    Q 800 20 800 60
    L 800 1240
    Q 800 1280 760 1280
    L 60 1280
    Q 20 1280 20 1240
    L 20 60
    Q 20 20 60 20 Z
  `;

  return (
    <div className="relative h-full w-full pc-fadein">
      <svg
        viewBox="0 0 820 1300"
        preserveAspectRatio="xMidYMid meet"
        xmlns="http://www.w3.org/2000/svg"
        className="h-full w-full"
        style={{ filter: "drop-shadow(0 40px 80px rgba(0,0,0,0.85))" }}
      >
        <defs>
          {/* METAL RAHMEN — mehrschichtig für echten Metallic-Look */}
          <linearGradient id="pc-frame-metal" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"  stopColor="#f4f6f9" />
            <stop offset="12%" stopColor="#c9ccd2" />
            <stop offset="30%" stopColor="#6a6d73" />
            <stop offset="50%" stopColor="#1f2126" />
            <stop offset="70%" stopColor="#5a5d63" />
            <stop offset="88%" stopColor="#b8bcc2" />
            <stop offset="100%" stopColor="#0f1013" />
          </linearGradient>
          <linearGradient id="pc-frame-shine" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%"  stopColor="#ffffff" stopOpacity="0" />
            <stop offset="35%" stopColor="#ffffff" stopOpacity="0.55" />
            <stop offset="55%" stopColor="#ffffff" stopOpacity="0.9" />
            <stop offset="75%" stopColor="#ffffff" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="pc-frame-red" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%"  stopColor={primary} stopOpacity="0.95" />
            <stop offset="50%" stopColor="#6a0000" stopOpacity="0.55" />
            <stop offset="100%" stopColor={primary} stopOpacity="0.95" />
          </linearGradient>

          {/* HINTERGRUND */}
          <radialGradient id="pc-bg-glow" cx="50%" cy="34%" r="60%">
            <stop offset="0%"  stopColor={primary} stopOpacity="0.7" />
            <stop offset="35%" stopColor="#5a0000" stopOpacity="0.45" />
            <stop offset="100%" stopColor="#000" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="pc-bg-smoke" cx="50%" cy="60%" r="70%">
            <stop offset="0%"  stopColor="#1a1a1a" stopOpacity="0.6" />
            <stop offset="60%" stopColor="#0a0a0a" stopOpacity="0.2" />
            <stop offset="100%" stopColor="#000" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="pc-bg-base" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"  stopColor="#26090a" />
            <stop offset="30%" stopColor="#120404" />
            <stop offset="70%" stopColor="#050505" />
            <stop offset="100%" stopColor="#000000" />
          </linearGradient>

          {/* CARBON */}
          <pattern id="pc-carbon" x="0" y="0" width="12" height="12" patternUnits="userSpaceOnUse">
            <rect width="12" height="12" fill="#050505" />
            <path d="M0 6 L6 0 L12 6 L6 12 Z" fill="#131316" />
            <path d="M0 6 L6 0 L6 6 Z" fill="#1c1c20" />
            <circle cx="6" cy="6" r="0.4" fill="#242428" />
          </pattern>

          {/* LICHTSTRAHLEN von oben */}
          <linearGradient id="pc-rays" x1="0.5" y1="0" x2="0.5" y2="1">
            <stop offset="0%"  stopColor="#ffffff" stopOpacity="0.35" />
            <stop offset="60%" stopColor="#ffffff" stopOpacity="0.05" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="pc-rays-red" x1="0.5" y1="0" x2="0.5" y2="1">
            <stop offset="0%"  stopColor={primary} stopOpacity="0.4" />
            <stop offset="100%" stopColor={primary} stopOpacity="0" />
          </linearGradient>

          {/* NOISE + DISTRESS */}
          <filter id="pc-noise">
            <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="7" />
            <feColorMatrix values="0 0 0 0 0.55  0 0 0 0 0.5  0 0 0 0 0.5  0 0 0 0.18 0" />
          </filter>
          <filter id="pc-grain">
            <feTurbulence type="fractalNoise" baseFrequency="0.7" numOctaves="1" seed="3" />
            <feColorMatrix values="0 0 0 0 0.9  0 0 0 0 0.85  0 0 0 0 0.85  0 0 0 0.07 0" />
          </filter>
          <filter id="pc-distress" x="-5%" y="-8%" width="110%" height="116%">
            <feTurbulence type="fractalNoise" baseFrequency="0.014 0.045" numOctaves="2" seed="4" result="t" />
            <feDisplacementMap in="SourceGraphic" in2="t" scale="6" />
          </filter>

          {/* GLOWS */}
          <filter id="pc-glow-red" x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="5" result="b" />
            <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <filter id="pc-glow-white" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="2.5" result="b" />
            <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <filter id="pc-glow-strong" x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="26" />
          </filter>
          <filter id="pc-glow-logo" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="6" result="b" />
            <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>

          {/* KANTEN-WEICHZEICHNER für Freistellung */}
          <filter id="pc-cutout-feather" x="-2%" y="-2%" width="104%" height="104%">
            <feGaussianBlur stdDeviation="0.7" />
          </filter>

          {/* NAME METAL */}
          <linearGradient id="pc-name-metal" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"  stopColor="#ffffff" />
            <stop offset="30%" stopColor="#f6f7f9" />
            <stop offset="50%" stopColor="#cccfd4" />
            <stop offset="72%" stopColor="#6d7076" />
            <stop offset="92%" stopColor="#3a3c40" />
            <stop offset="100%" stopColor="#1a1b1e" />
          </linearGradient>

          {/* PANEL — mit innerem Tiefeneffekt */}
          <linearGradient id="pc-panel" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"  stopColor="#1c1c1f" stopOpacity="0.92" />
            <stop offset="50%" stopColor="#0d0d10" stopOpacity="0.96" />
            <stop offset="100%" stopColor="#040405" stopOpacity="0.98" />
          </linearGradient>
          <linearGradient id="pc-panel-top" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"  stopColor="#ffffff" stopOpacity="0.14" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
          </linearGradient>
          <filter id="pc-inner-shadow" x="-10%" y="-10%" width="120%" height="120%">
            <feGaussianBlur in="SourceAlpha" stdDeviation="4" />
            <feOffset dx="0" dy="2" result="off" />
            <feComposite in="off" in2="SourceAlpha" operator="arithmetic" k2="-1" k3="1" result="inner" />
            <feColorMatrix in="inner" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.6 0" result="colored" />
            <feMerge><feMergeNode in="SourceGraphic" /><feMergeNode in="colored" /></feMerge>
          </filter>

          {/* VIGNETTE */}
          <radialGradient id="pc-vignette" cx="50%" cy="55%" r="72%">
            <stop offset="45%" stopColor="#000" stopOpacity="0" />
            <stop offset="80%" stopColor="#000" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#000" stopOpacity="0.95" />
          </radialGradient>

          <clipPath id="pc-clip">
            <path d={framePath} />
          </clipPath>
          <clipPath id="pc-feet-clip">
            <rect x="20" y="940" width="780" height="340" />
          </clipPath>
        </defs>

        {/* HINTERGRUND */}
        <g clipPath="url(#pc-clip)">
          <rect x="20" y="20" width="780" height="1260" fill="url(#pc-bg-base)" />
          <rect x="20" y="20" width="780" height="1260" fill="url(#pc-carbon)" opacity="0.55" />

          {/* Lichtstrahlen von oben */}
          <g opacity="0.6" style={{ mixBlendMode: "screen" }}>
            <polygon points="180,20 240,20 340,780 220,780" fill="url(#pc-rays)" opacity="0.55" />
            <polygon points="380,20 440,20 480,900 360,900" fill="url(#pc-rays)" opacity="0.4" />
            <polygon points="560,20 620,20 620,820 500,820" fill="url(#pc-rays-red)" opacity="0.55" />
            <polygon points="80,20 130,20 260,700 160,700" fill="url(#pc-rays-red)" opacity="0.35" />
          </g>

          {/* Roter Hintergrund-Glow */}
          <ellipse cx="410" cy="470" rx="380" ry="500" fill="url(#pc-bg-glow)" />

          {/* Smoke / Rauch */}
          <g style={{ mixBlendMode: "screen" }} opacity="0.7">
            <ellipse cx="230" cy="720" rx="220" ry="130" fill="url(#pc-bg-smoke)" />
            <ellipse cx="600" cy="640" rx="240" ry="160" fill="url(#pc-bg-smoke)" />
            <ellipse cx="410" cy="880" rx="360" ry="120" fill="url(#pc-bg-smoke)" />
          </g>

          {/* Rote Partikel — mehr Dichte, variabel */}
          {Array.from({ length: 90 }).map((_, i) => {
            const seed = (i * 9301 + 49297) % 233280;
            const x = 30 + (seed % 760);
            const y = 30 + ((seed * 3) % 1220);
            const r = 0.4 + ((seed * 7) % 30) / 12;
            const o = 0.12 + ((seed * 11) % 40) / 100;
            return <circle key={i} cx={x} cy={y} r={r} fill={primary} opacity={o} filter={r > 1.6 ? "url(#pc-glow-red)" : undefined} />;
          })}

          {/* Noise + Grain overlay */}
          <rect x="20" y="20" width="780" height="1260" filter="url(#pc-noise)" opacity="0.42" />
          <rect x="20" y="20" width="780" height="1260" filter="url(#pc-grain)" opacity="0.5" style={{ mixBlendMode: "overlay" }} />

          {/* SPIELERBILD — dominant, füllt fast die gesamte Kartenhöhe */}
          {avatarUrl && (
            <>
              {/* Weicher radialer Glow direkt hinter dem Spieler (kein harter Kreis) */}
              <ellipse cx="410" cy="470" rx="360" ry="470" fill="url(#pc-bg-glow)"
                       style={{ mixBlendMode: "screen" }} opacity="0.95" />
              <ellipse cx="410" cy="620" rx="240" ry="200" fill={primary}
                       opacity="0.32" filter="url(#pc-glow-strong)" style={{ mixBlendMode: "screen" }} />
              {/* Boden-Schatten */}
              <ellipse cx="410" cy="1055" rx="270" ry="26" fill="#000" opacity="0.8" filter="url(#pc-glow-strong)" />
              <image
                href={avatarUrl}
                x="-70"
                y="-30"
                width="960"
                height="1180"
                preserveAspectRatio="xMidYMax meet"
                filter="url(#pc-cutout-feather)"
                style={{ filter: "drop-shadow(0 50px 40px rgba(0,0,0,0.85))" }}
                onError={() => { if (rawAvatar) AVATAR_CACHE.delete(rawAvatar); setAvatarUrl(null); }}
              />
            </>
          )}

          {/* Vignette on top of everything inside clip */}
          <rect x="20" y="20" width="780" height="1260" fill="url(#pc-vignette)" pointerEvents="none" />
        </g>

        {/* OVR LINKS — deutlich größer, dominanter */}
        <g>
          {/* soft red backdrop halo */}
          <circle cx="150" cy="200" r="130" fill={primary} opacity="0.28" filter="url(#pc-glow-strong)" />
          <text x="60" y="260"
                fontFamily="Anton, Bebas Neue, sans-serif"
                fontWeight="900"
                fontSize="280"
                fill="url(#pc-name-metal)"
                style={{ letterSpacing: "-10px", paintOrder: "stroke", stroke: "rgba(0,0,0,0.65)", strokeWidth: 3 } as any}
                filter="url(#pc-glow-red)">
            {ovr ?? "—"}
          </text>
          <text x="72" y="308" fontFamily="Oswald, sans-serif" fontWeight="900" fontSize="38" fill={primary}
                letterSpacing="6" filter="url(#pc-glow-red)">OVR</text>
          {position && (
            <>
              <text x="70" y="410" fontFamily="Bebas Neue, Anton, sans-serif" fontSize="94" fill="#ffffff"
                    style={{ letterSpacing: "-2px", paintOrder: "stroke", stroke: "rgba(0,0,0,0.6)", strokeWidth: 2 } as any}>
                {position}
              </text>
              <line x1="74" y1="428" x2="180" y2="428" stroke={primary} strokeWidth="4" />
              {jerseyNumber && (
                <text x="74" y="466" fontFamily="Oswald, sans-serif" fontWeight="700" fontSize="30" fill="#fff"
                      letterSpacing="2" opacity="0.85">#{jerseyNumber}</text>
              )}
            </>
          )}
        </g>

        {/* VEREINSLOGO — transparent, mit Glow, ohne Kasten */}
        {organization?.logo_url ? (
          <g filter="url(#pc-glow-logo)">
            {/* subtle radial spotlight behind */}
            <circle cx="700" cy="170" r="105" fill={primary} opacity="0.18" filter="url(#pc-glow-strong)" />
            <image
              href={organization.logo_url}
              x="600" y="70"
              width="200" height="200"
              preserveAspectRatio="xMidYMid meet"
              style={{ filter: "drop-shadow(0 4px 14px rgba(0,0,0,0.6))" }}
            />
          </g>
        ) : (
          <g filter="url(#pc-glow-red)">
            <circle cx="700" cy="170" r="80" fill="none" stroke={primary} strokeWidth="4" />
            <text x="700" y="188" textAnchor="middle" fontFamily="Oswald, sans-serif" fontWeight="800" fontSize="34" fill={primary}>
              {organization?.short_name ?? "BF"}
            </text>
          </g>
        )}
        {organization?.short_name && organization?.logo_url && (
          <text x="700" y="298" textAnchor="middle" fontFamily="Oswald, sans-serif" fontWeight="800" fontSize="22"
                fill="#ffffff" opacity="0.7" letterSpacing="4">{organization.short_name.toUpperCase()}</text>
        )}

        {/* BODY-STATS LINKS */}
        <g fontFamily="Oswald, sans-serif" fontWeight="600" fontSize="20" fill="#ffffff">
          {age != null && (
            <g transform="translate(70, 560)">
              <rect x="0" y="-16" width="22" height="22" rx="3" fill="none" stroke={primary} strokeWidth="1.8" />
              <line x1="0" y1="-8" x2="22" y2="-8" stroke={primary} strokeWidth="1.5" />
              <text x="34" y="2" style={{ textShadow: "0 1px 3px rgba(0,0,0,0.9)" }}>{age} JAHRE</text>
            </g>
          )}
          {height != null && (
            <g transform="translate(70, 605)">
              <rect x="0" y="-16" width="22" height="14" rx="2" fill="none" stroke={primary} strokeWidth="1.8" />
              <line x1="5" y1="-16" x2="5" y2="-8" stroke={primary} strokeWidth="1" />
              <line x1="11" y1="-16" x2="11" y2="-11" stroke={primary} strokeWidth="1" />
              <line x1="17" y1="-16" x2="17" y2="-8" stroke={primary} strokeWidth="1" />
              <text x="34" y="0">{height} CM</text>
            </g>
          )}
          {weight != null && (
            <g transform="translate(70, 650)">
              <circle cx="11" cy="-6" r="10" fill="none" stroke={primary} strokeWidth="1.8" />
              <path d="M11 -12 L11 -6 L15 -3" stroke={primary} strokeWidth="1.8" fill="none" strokeLinecap="round" />
              <text x="34" y="0">{weight} KG</text>
            </g>
          )}
          {card.is_provisional && (
            <g transform="translate(70, 700)">
              <rect x="0" y="-16" width="130" height="24" rx="3" fill="#f59e0b" />
              <text x="65" y="1" textAnchor="middle" fontSize="14" fontWeight="800" fill="#000" letterSpacing="2">VORLÄUFIG</text>
            </g>
          )}
        </g>

        {/* NAME — Vorname deutlich sichtbar, Nachname massiv & tiefer */}
        <g textAnchor="middle">
          {first && (
            <>
              {/* Underlay für Lesbarkeit */}
              <text x="410" y="890"
                    fontFamily="Bebas Neue, Anton, sans-serif"
                    fontSize="58"
                    fill="#000" opacity="0.55"
                    fontStyle="italic" letterSpacing="8"
                    style={{ paintOrder: "stroke", stroke: "rgba(0,0,0,0.8)", strokeWidth: 6 } as any}>
                {first}
              </text>
              <text x="410" y="890"
                    fontFamily="Bebas Neue, Anton, sans-serif"
                    fontSize="58"
                    fill={primary}
                    fontStyle="italic" letterSpacing="8"
                    filter="url(#pc-glow-red)"
                    style={{ paintOrder: "stroke", stroke: "rgba(0,0,0,0.55)", strokeWidth: 2 } as any}>
                {first}
              </text>
            </>
          )}
          {/* Nachname Underlay (Distress-Schatten) */}
          <text
            x="410" y="1000"
            fontFamily="Anton, Bebas Neue, sans-serif"
            fontSize={last.length > 9 ? 128 : last.length > 7 ? 148 : 172}
            fill="#000"
            letterSpacing="2"
            opacity="0.7"
            style={{ paintOrder: "stroke", stroke: "#000", strokeWidth: 10 } as any}
          >
            {last || "—"}
          </text>
          <text
            x="410" y="1000"
            fontFamily="Anton, Bebas Neue, sans-serif"
            fontSize={last.length > 9 ? 128 : last.length > 7 ? 148 : 172}
            fill="url(#pc-name-metal)"
            letterSpacing="2"
            filter="url(#pc-distress)"
            style={{ paintOrder: "stroke", stroke: "rgba(0,0,0,0.7)", strokeWidth: 2.5 } as any}
          >
            {last || "—"}
          </text>
          {/* Highlight-Sheen auf Namen */}
          <text
            x="410" y="1000"
            fontFamily="Anton, Bebas Neue, sans-serif"
            fontSize={last.length > 9 ? 128 : last.length > 7 ? 148 : 172}
            fill="url(#pc-frame-shine)"
            letterSpacing="2"
            opacity="0.4"
            pointerEvents="none"
          >
            {last || "—"}
          </text>
          <text x="410" y="1032" fontFamily="Oswald, sans-serif" fontWeight="700" fontSize="16"
                fill="#ffffff" opacity="0.7" letterSpacing="8">
            {[teamLabel, position, jerseyNumber ? `#${jerseyNumber}` : null].filter(Boolean).join("   •   ").toUpperCase()}
          </text>
        </g>

        {/* STAT-PANEL — ein Fläche mit dünnen Trennlinien */}
        <g transform="translate(50, 1055)">
          {/* Outer glow */}
          <rect x="-2" y="-2" width="724" height="129" rx="14" fill={primary} opacity="0.12" filter="url(#pc-glow-strong)" />
          {/* Base plate */}
          <rect x="0" y="0" width="720" height="125" rx="12" fill="url(#pc-panel)" />
          {/* Metal top highlight */}
          <rect x="0" y="0" width="720" height="125" rx="12" fill="url(#pc-panel-top)" />
          {/* Inner stroke */}
          <rect x="0.75" y="0.75" width="718.5" height="123.5" rx="11.25" fill="none" stroke="#ffffff" strokeOpacity="0.16" strokeWidth="1.5" />
          <rect x="3" y="3" width="714" height="119" rx="9" fill="none" stroke="#000" strokeOpacity="0.6" strokeWidth="1" />
          {/* nur dünne Trennlinien */}
          {[0, 1, 2, 3, 4].map((i) => (
            <line key={i} x1={120 + i * 120} y1="18" x2={120 + i * 120} y2="107" stroke="#ffffff" strokeOpacity="0.09" strokeWidth="1" />
          ))}
          {/* Kompakte Stat-Reihe (nummer + label) */}
          {([
            { attr: "SPD" as const, value: card.spd,       animated: spd },
            { attr: "ACC" as const, value: card.acc,       animated: acc },
            { attr: "AGI" as const, value: card.agi,       animated: agi },
            { attr: "POW" as const, value: card.pow,       animated: pow },
            { attr: "STR" as const, value: card.str,       animated: str },
            { attr: "END" as const, value: card.end_score, animated: end },
          ]).map((s, i) => {
            const cx = 60 + i * 120;
            return (
              <g key={s.attr}>
                <text x={cx} y="62" textAnchor="middle" fontFamily="Anton, Bebas Neue, sans-serif" fontSize="50" fill="#ffffff"
                      style={{ paintOrder: "stroke", stroke: "rgba(0,0,0,0.55)", strokeWidth: 2 } as any}>
                  {s.animated ?? "—"}
                </text>
                <text x={cx} y="85" textAnchor="middle" fontFamily="Oswald, sans-serif" fontWeight="800" fontSize="14"
                      fill={primary} letterSpacing="3">{ATTR_LABELS[s.attr]}</text>
                {/* thin percentile bar */}
                <rect x={cx - 30} y="97" width="60" height="3" rx="1.5" fill="#ffffff" opacity="0.1" />
                <rect x={cx - 30} y="97" width={s.value == null ? 0 : Math.max(2, (s.value / 99) * 60)}
                      height="3" rx="1.5" fill={primary} />
              </g>
            );
          })}
        </g>

        {/* INFO-PANEL */}
        <g transform="translate(50, 1195)">
          <rect x="-2" y="-2" width="724" height="72" rx="12" fill={primary} opacity="0.08" filter="url(#pc-glow-strong)" />
          <rect x="0" y="0" width="720" height="68" rx="10" fill="url(#pc-panel)" />
          <rect x="0" y="0" width="720" height="68" rx="10" fill="url(#pc-panel-top)" />
          <rect x="0.75" y="0.75" width="718.5" height="66.5" rx="9.25" fill="none" stroke="#ffffff" strokeOpacity="0.14" strokeWidth="1.2" />
          <line x1="240" y1="14" x2="240" y2="54" stroke="#ffffff" strokeOpacity="0.1" />
          <line x1="480" y1="14" x2="480" y2="54" stroke="#ffffff" strokeOpacity="0.1" />

          <g transform="translate(120, 24)">
            <text x="0" y="0" textAnchor="middle" fontFamily="Oswald, sans-serif" fontWeight="800" fontSize="11" fill="#fff" opacity="0.55" letterSpacing="3">KARTENSTUFE</text>
            <text x="0" y="28" textAnchor="middle" fontFamily="Anton, Bebas Neue, sans-serif" fontSize="24" fill={primary} letterSpacing="4"
                  filter="url(#pc-glow-red)">
              {card.tier ? TIER_LABELS[card.tier] : "—"}
            </text>
          </g>
          <g transform="translate(360, 24)">
            <text x="0" y="0" textAnchor="middle" fontFamily="Oswald, sans-serif" fontWeight="800" fontSize="11" fill="#fff" opacity="0.55" letterSpacing="3">LETZTES UPDATE</text>
            <text x="0" y="28" textAnchor="middle" fontFamily="Anton, Bebas Neue, sans-serif" fontSize="24" fill="#fff" letterSpacing="2">
              {updateDate}
            </text>
          </g>
          <g transform="translate(600, 24)">
            <text x="0" y="0" textAnchor="middle" fontFamily="Oswald, sans-serif" fontWeight="800" fontSize="11" fill="#fff" opacity="0.55" letterSpacing="3">GRÖSSTE STÄRKE</text>
            <text x="0" y="28" textAnchor="middle" fontFamily="Anton, Bebas Neue, sans-serif" fontSize="24" fill={primary} letterSpacing="4"
                  filter="url(#pc-glow-red)">
              {strongestLabel}
            </text>
          </g>
        </g>

        {/* Vertikaler Claim rechts — heller, hochwertiger */}
        <g transform="translate(796, 700) rotate(-90)">
          <text textAnchor="middle" fontFamily="Oswald, sans-serif" fontWeight="700" fontSize="13"
                fill="url(#pc-name-metal)" opacity="0.7" letterSpacing="10"
                style={{ paintOrder: "stroke", stroke: "rgba(0,0,0,0.6)", strokeWidth: 0.6 } as any}>
            {claim}
          </text>
        </g>

        {/* RAHMEN — echter Metallic-Look */}
        {/* Aussenschatten */}
        <path d={framePath} fill="none" stroke="#000" strokeOpacity="0.9" strokeWidth="14" transform="translate(0,2)" style={{ filter: "blur(4px)" }} />
        {/* Haupt-Metallschicht */}
        <path d={framePath} fill="none" stroke="url(#pc-frame-metal)" strokeWidth="12" />
        {/* Rote Akzentader */}
        <path d={framePath} fill="none" stroke="url(#pc-frame-red)" strokeWidth="3" opacity="0.9" />
        {/* Silber-Highlight oben */}
        <path d={framePath} fill="none" stroke="#ffffff" strokeWidth="1.4" strokeOpacity="0.9" transform="translate(0,-1.5)" />
        {/* Silber-Highlight seitlich (Lichtreflex) */}
        <path d={framePath} fill="none" stroke="url(#pc-frame-shine)" strokeWidth="6" opacity="0.5" />
        {/* Tiefer Innenrand */}
        <path d={framePath} fill="none" stroke="#000" strokeWidth="1.5" strokeOpacity="0.85" transform="translate(0,2)" />
        {/* Innenlinie */}
        <path
          d="M 42 50 L 380 50 Q 410 50 410 66 Q 410 50 440 50 L 778 50 L 778 1258 L 42 1258 Z"
          fill="none"
          stroke={primary}
          strokeWidth="1"
          strokeOpacity="0.55"
        />
        <path
          d="M 50 58 L 380 58 Q 410 58 410 72 Q 410 58 440 58 L 770 58 L 770 1250 L 50 1250 Z"
          fill="none"
          stroke="#ffffff"
          strokeWidth="0.5"
          strokeOpacity="0.15"
        />
      </svg>
    </div>
  );
}

