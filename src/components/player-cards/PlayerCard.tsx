/**
 * Player Card — Fixes Template (100% Referenz).
 * Rein dynamisch: jedes Feld separat aus DB befüllbar. Keine Balken,
 * keine Prozente, keine Placeholder, keine "--". Fehlt ein Wert →
 * nur Icon/Label bleibt sichtbar. Layout ist statisch.
 */
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import bodyfuelLogo from "@/assets/bodyfuel-logo.png.asset.json";

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
    manual_overrides?: Partial<Record<"BFR" | "SPD" | "ACC" | "AGI" | "POW" | "STR" | "END", number | null>>;
    is_published?: boolean;
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
  silver: "SILVER",
  gold: "GOLD",
  elite: "ELITE",
  legendary: "LEGEND",
};

const TIER_COLOR: Record<Tier, string> = {
  bronze: "#CD7F32",
  silver: "#C0C0C0",
  gold: "#F5C518",
  elite: "#E10600",
  legendary: "#9B59FF",
};

const POS_ABBR: Record<string, string> = {
  QUARTERBACK: "QB",
  "RUNNING BACK": "RB",
  "WIDE RECEIVER": "WR",
  "TIGHT END": "TE",
  "OFFENSIVE LINE": "OL",
  "DEFENSIVE LINE": "DL",
  LINEBACKER: "LB",
  CORNERBACK: "CB",
  SAFETY: "S",
  KICKER: "K",
  PUNTER: "P",
};

// Attribut-Icons (rot, stroke)
const STAT_ICONS: Record<AttributeKey, string> = {
  SPD: "M14 4a2 2 0 1 0 0-4 2 2 0 0 0 0 4Zm-4.5 20 3-8 4-2 3 4 3 1.5M6.5 15l-2 3",
  ACC: "M13 2 3 14h7l-1 8 10-12h-7l1-8z",
  AGI: "M3 3l8 8m0 0V6m0 5H6m15-8-8 8m0 0V6m0 5h5M3 21l8-8m0 0v5m0-5H6m15 8-8-8m0 0v5m0-5h5",
  POW: "M12 2v4l3-2 1 4 4-1-2 3 4 1-4 2 2 3-4-1-1 4-3-2-3 2-1-4-4 1 2-3-4-1 4-2-2-3 4 1 1-4 3 2V2z",
  STR: "M4 8v8M2 6v12M20 6v12M22 8v8M4 12h16",
  END: "M20.4 6.6a5.5 5.5 0 0 0-8.4-.6 5.5 5.5 0 0 0-8.4.6c-2.1 2.4-1.5 6.5 4.4 11.4L12 21l4-3c5.9-4.9 6.5-9 4.4-11.4zM4 12h3l2-3 2 5 2-3h6",
};

const ATTR_FILL: Record<AttributeKey, boolean> = {
  SPD: false, ACC: true, AGI: false, POW: true, STR: false, END: true,
};

// Info-Icons (Alter / Größe / Gewicht)
const CAL_ICON = "M7 3v3m10-3v3M4 8h16M5 6h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1z";
const RULER_ICON = "M2 14 14 2l8 8L10 22 2 14z M6 12l2 2 M9 9l3 3 M12 6l2 2 M15 3l3 3";
const SCALE_ICON = "M6 4h12l2 16H4L6 4z M9 4c0-1.5 1.5-3 3-3s3 1.5 3 3 M8 10h8";
const SHIELD_ICON = "M12 2 4 5v6c0 5 3.5 9.5 8 11 4.5-1.5 8-6 8-11V5l-8-3z";
const BOLT_ICON = "M13 2 3 14h7l-1 8 10-12h-7l1-8z";

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

export function PlayerCard({ data }: { data: PlayerCardData }) {
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const rawAvatar = data.profile?.avatar_cutout_url ?? data.profile?.avatar_url ?? null;
  useEffect(() => {
    let alive = true;
    if (!rawAvatar) { setAvatarUrl(null); return; }
    resolvePlayerAvatar(rawAvatar).then((u) => { if (alive) setAvatarUrl(u); });
    return () => { alive = false; };
  }, [rawAvatar]);

  const { card, profile, bullsProfile, organization, jerseyNumber } = data;

  const primary = organization?.primary_color ?? "#E10600";
  const claim = (organization?.claim ?? "BUILT FOR TEAMS. DRIVEN BY PERFORMANCE.").toUpperCase();
  const clubName = (organization?.name ?? "").toUpperCase();

  const ageVal = computeAge(profile?.birthdate);
  const heightCm = bullsProfile?.height_cm ?? profile?.height_cm ?? null;
  const weightKg = bullsProfile?.weight_kg ?? null;

  const positionFull = (card.position_key ?? bullsProfile?.position ?? profile?.sport_position ?? "").toUpperCase();
  const positionAbbr = POS_ABBR[positionFull] ?? positionFull.slice(0, 3);

  const ov = card.manual_overrides ?? {};
  const bfrDisplay = ov.BFR ?? card.bfr;
  const stats: Array<{ attr: AttributeKey; value: number | null }> = [
    { attr: "SPD", value: ov.SPD ?? card.spd },
    { attr: "ACC", value: ov.ACC ?? card.acc },
    { attr: "AGI", value: ov.AGI ?? card.agi },
    { attr: "POW", value: ov.POW ?? card.pow },
    { attr: "STR", value: ov.STR ?? card.str },
    { attr: "END", value: ov.END ?? card.end_score },
  ];

  const updateDate = card.bfr != null
    ? new Date(card.computed_at).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" })
    : "";

  const tierLabel = card.tier ? TIER_LABELS[card.tier] : "";
  const tierColor = card.tier ? TIER_COLOR[card.tier] : primary;
  const strongest = card.strongest_attribute ?? "";

  // Frame path — shield mit Notch oben mittig
  const FW = 800;
  const FH = 1200;
  const framePath = `
    M 40 70
    L 70 40
    L 360 40
    L 380 20
    L 400 40
    L 420 20
    L 440 40
    L 730 40
    L 760 70
    L 760 1130
    L 730 1160
    L 70 1160
    L 40 1130
    Z
  `;

  return (
    <div className="relative h-full w-full">
      <svg
        viewBox={`0 0 ${FW} ${FH}`}
        preserveAspectRatio="xMidYMid meet"
        xmlns="http://www.w3.org/2000/svg"
        className="h-full w-full"
        style={{ filter: "drop-shadow(0 30px 60px rgba(0,0,0,0.85))" }}
      >
        <defs>
          <linearGradient id="pc-frame-metal" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#f6f7f9" />
            <stop offset="18%" stopColor="#b8bcc2" />
            <stop offset="40%" stopColor="#4a4c50" />
            <stop offset="55%" stopColor="#1a1b1e" />
            <stop offset="72%" stopColor="#5a5d63" />
            <stop offset="90%" stopColor="#c9ccd2" />
            <stop offset="100%" stopColor="#0f1013" />
          </linearGradient>
          <linearGradient id="pc-bg-base" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#0e0203" />
            <stop offset="45%" stopColor="#080102" />
            <stop offset="100%" stopColor="#050506" />
          </linearGradient>
          <radialGradient id="pc-bg-glow" cx="50%" cy="42%" r="55%">
            <stop offset="0%" stopColor={primary} stopOpacity="0.35" />
            <stop offset="55%" stopColor="#3a0a0c" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#000" stopOpacity="0" />
          </radialGradient>
          <pattern id="pc-shards" x="0" y="0" width="140" height="140" patternUnits="userSpaceOnUse">
            <path d="M0 40 L60 10 L120 50 L90 90 L30 110 Z" fill="none" stroke="#3a1214" strokeOpacity="0.45" strokeWidth="1" />
            <path d="M20 0 L80 20 L110 70" fill="none" stroke="#4a1517" strokeOpacity="0.3" strokeWidth="1" />
            <path d="M0 90 L40 70 L70 100" fill="none" stroke="#2a0a0b" strokeOpacity="0.5" strokeWidth="1" />
          </pattern>
          <linearGradient id="pc-panel" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#141416" stopOpacity="0.95" />
            <stop offset="100%" stopColor="#050506" stopOpacity="0.95" />
          </linearGradient>
          <filter id="pc-noise">
            <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="7" />
            <feColorMatrix values="0 0 0 0 0.5  0 0 0 0 0.45  0 0 0 0 0.45  0 0 0 0.14 0" />
          </filter>
          <clipPath id="pc-clip"><path d={framePath} /></clipPath>
        </defs>

        {/* ================ HINTERGRUND ================ */}
        <g clipPath="url(#pc-clip)">
          <rect x="0" y="0" width={FW} height={FH} fill="url(#pc-bg-base)" />
          <rect x="0" y="0" width={FW} height={FH} fill="url(#pc-shards)" opacity="0.7" />
          <ellipse cx="400" cy="500" rx="360" ry="440" fill="url(#pc-bg-glow)" />
          {Array.from({ length: 80 }).map((_, i) => {
            const s = (i * 9301 + 49297) % 233280;
            const x = 60 + (s % 680);
            const y = 60 + ((s * 3) % 1080);
            const r = 0.4 + ((s * 7) % 26) / 14;
            return <circle key={i} cx={x} cy={y} r={r} fill={primary} opacity={0.12 + ((s * 11) % 40) / 160} />;
          })}
          <rect x="0" y="0" width={FW} height={FH} filter="url(#pc-noise)" opacity="0.3" />

          {/* SPIELERBILD (nur wenn vorhanden) */}
          {avatarUrl && (
            <image
              href={avatarUrl}
              x="120"
              y="80"
              width="560"
              height="820"
              preserveAspectRatio="xMidYMax meet"
              onError={() => { if (rawAvatar) AVATAR_CACHE.delete(rawAvatar); setAvatarUrl(null); }}
              style={{ filter: "drop-shadow(0 30px 30px rgba(0,0,0,0.7))" } as any}
            />
          )}
        </g>

        {/* ================ TOP LEFT: OVR / POSITION / # ================ */}
        <g>
          {/* OVR Wert */}
          <text x="130" y="180" textAnchor="middle"
                fontFamily="Anton, Bebas Neue, sans-serif" fontWeight="900" fontSize="120"
                fill={primary}>
            {bfrDisplay ?? ""}
          </text>
          <line x1="90" y1="205" x2="170" y2="205" stroke={primary} strokeWidth="6" />
          <text x="130" y="245" textAnchor="middle"
                fontFamily="Oswald, sans-serif" fontWeight="800" fontSize="28"
                fill={primary} letterSpacing="4">OVR</text>

          {/* Position */}
          <text x="130" y="345" textAnchor="middle"
                fontFamily="Anton, Bebas Neue, sans-serif" fontWeight="900" fontSize="72"
                fill={primary} letterSpacing="1">
            {positionAbbr || ""}
          </text>
          <line x1="98" y1="360" x2="162" y2="360" stroke={primary} strokeWidth="4" />
          <text x="130" y="395" textAnchor="middle"
                fontFamily="Oswald, sans-serif" fontWeight="800" fontSize="20"
                fill={primary} letterSpacing="4">POSITION</text>

          {/* Jersey # */}
          <text x="130" y="475" textAnchor="middle"
                fontFamily="Anton, Bebas Neue, sans-serif" fontWeight="800" fontSize="48"
                fill="#ffffff" opacity="0.9">
            {jerseyNumber ? `#${jerseyNumber}` : "#"}
          </text>
        </g>

        {/* ================ TOP RIGHT: LOGO + CLUBNAME ================ */}
        <g>
          {organization?.logo_url && (
            <image href={organization.logo_url} x="580" y="80" width="170" height="170"
                   preserveAspectRatio="xMidYMid meet"
                   style={{ filter: "drop-shadow(0 6px 12px rgba(0,0,0,0.6))" } as any} />
          )}
          {clubName && (
            <text x="665" y="280" textAnchor="middle"
                  fontFamily="Anton, Bebas Neue, sans-serif" fontSize="26"
                  fill={primary} letterSpacing="3">
              {clubName}
            </text>
          )}
        </g>

        {/* ================ LEFT INFO: Alter / Größe / Gewicht ================ */}
        <g fontFamily="Oswald, sans-serif" fontWeight="700" fontSize="20" fill="#ffffff" letterSpacing="3">
          {/* Alter */}
          <g transform="translate(80, 590)">
            <path d={CAL_ICON} fill="none" stroke="#ffffff" strokeOpacity="0.85" strokeWidth="1.6"
                  strokeLinecap="round" strokeLinejoin="round" transform="scale(1.2)" />
            <text x="42" y="20" opacity="0.85">ALTER</text>
            {ageVal != null && (
              <text x="42" y="20" opacity="0" />
            )}
            {ageVal != null && (
              <text x="180" y="20" textAnchor="end"
                    fontFamily="Anton, Bebas Neue, sans-serif" fontSize="26"
                    fill={primary} letterSpacing="1">{ageVal}</text>
            )}
          </g>
          {/* Größe */}
          <g transform="translate(80, 650)">
            <path d={RULER_ICON} fill="none" stroke="#ffffff" strokeOpacity="0.85" strokeWidth="1.6"
                  strokeLinecap="round" strokeLinejoin="round" transform="scale(1.2)" />
            <text x="42" y="20" opacity="0.85">GRÖSSE</text>
            {heightCm != null && (
              <text x="180" y="20" textAnchor="end"
                    fontFamily="Anton, Bebas Neue, sans-serif" fontSize="24"
                    fill={primary} letterSpacing="1">{heightCm}</text>
            )}
          </g>
          {/* Gewicht */}
          <g transform="translate(80, 710)">
            <path d={SCALE_ICON} fill="none" stroke="#ffffff" strokeOpacity="0.85" strokeWidth="1.6"
                  strokeLinecap="round" strokeLinejoin="round" transform="scale(1.2)" />
            <text x="42" y="20" opacity="0.85">GEWICHT</text>
            {weightKg != null && (
              <text x="180" y="20" textAnchor="end"
                    fontFamily="Anton, Bebas Neue, sans-serif" fontSize="24"
                    fill={primary} letterSpacing="1">{weightKg}</text>
            )}
          </g>
        </g>

        {/* ================ VERTIKALE SEITENTEXTE RECHTS ================ */}
        <g transform="translate(738, 620) rotate(-90)">
          <text textAnchor="middle" fontFamily="Oswald, sans-serif" fontWeight="700" fontSize="14"
                fill="#ffffff" opacity="0.7" letterSpacing="8">
            {claim}
          </text>
        </g>

        {/* ================ ATTRIBUTE PANEL ================ */}
        <g transform="translate(60, 900)">
          <rect x="0" y="0" width="680" height="160" rx="14" fill="url(#pc-panel)" stroke="#ffffff" strokeOpacity="0.14" strokeWidth="1.2" />
          {[1, 2, 3, 4, 5].map((i) => (
            <line key={i} x1={(680 / 6) * i} y1="24" x2={(680 / 6) * i} y2="136" stroke="#ffffff" strokeOpacity="0.08" />
          ))}
          {stats.map((s, i) => {
            const cx = (680 / 6) * i + 680 / 12;
            return (
              <g key={s.attr}>
                <text x={cx} y="38" textAnchor="middle"
                      fontFamily="Oswald, sans-serif" fontWeight="800" fontSize="17"
                      fill="#ffffff" letterSpacing="3">{s.attr}</text>
                {s.value != null ? (
                  <text x={cx} y="92" textAnchor="middle"
                        fontFamily="Anton, Bebas Neue, sans-serif" fontSize="42"
                        fill="#ffffff">
                    {s.value}
                  </text>
                ) : (
                  <g transform={`translate(${cx - 16}, 68)`}>
                    <path d={STAT_ICONS[s.attr]}
                          fill={ATTR_FILL[s.attr] ? primary : "none"}
                          stroke={primary}
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          transform="scale(1.35)" />
                  </g>
                )}
                {s.value != null && (
                  <g transform={`translate(${cx - 12}, 108)`}>
                    <path d={STAT_ICONS[s.attr]}
                          fill={ATTR_FILL[s.attr] ? primary : "none"}
                          stroke={primary}
                          strokeWidth="1.8"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          transform="scale(1)" />
                  </g>
                )}
              </g>
            );
          })}
        </g>

        {/* ================ INFO ROW: Kartenstufe / Update / Stärke ================ */}
        <g transform="translate(60, 1085)">
          <rect x="0" y="0" width="680" height="70" rx="12" fill="url(#pc-panel)" stroke="#ffffff" strokeOpacity="0.14" strokeWidth="1.2" />
          {/* Kartenstufe */}
          <g transform="translate(24, 22)">
            <path d={SHIELD_ICON} fill={tierColor} transform="scale(1.3)" />
            <path d="M9 14 l3 3 l6 -6" fill="none" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" transform="scale(1.3)" />
            <text x="44" y="10" fontFamily="Oswald, sans-serif" fontWeight="700" fontSize="10"
                  fill="#ffffff" opacity="0.65" letterSpacing="3">KARTENSTUFE</text>
            <text x="44" y="30" fontFamily="Anton, Bebas Neue, sans-serif" fontSize="20"
                  fill={tierColor} letterSpacing="2">
              {tierLabel}
            </text>
          </g>
          <line x1="228" y1="14" x2="228" y2="56" stroke="#ffffff" strokeOpacity="0.1" />
          {/* Letztes Update */}
          <g transform="translate(252, 22)">
            <path d={CAL_ICON} fill="none" stroke={primary} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" transform="scale(1.3)" />
            <text x="44" y="10" fontFamily="Oswald, sans-serif" fontWeight="700" fontSize="10"
                  fill="#ffffff" opacity="0.65" letterSpacing="3">LETZTES UPDATE</text>
            <text x="44" y="30" fontFamily="Anton, Bebas Neue, sans-serif" fontSize="20"
                  fill="#ffffff" letterSpacing="1">
              {updateDate}
            </text>
          </g>
          <line x1="456" y1="14" x2="456" y2="56" stroke="#ffffff" strokeOpacity="0.1" />
          {/* Größte Stärke */}
          <g transform="translate(480, 22)">
            <path d={BOLT_ICON} fill={primary} transform="scale(1.3)" />
            <text x="44" y="10" fontFamily="Oswald, sans-serif" fontWeight="700" fontSize="10"
                  fill="#ffffff" opacity="0.65" letterSpacing="3">GRÖSSTE STÄRKE</text>
            <text x="44" y="30" fontFamily="Anton, Bebas Neue, sans-serif" fontSize="20"
                  fill={primary} letterSpacing="2">
              {strongest}
            </text>
          </g>
        </g>

        {/* ================ FOOTER: OVR ENTWICKLUNG + LOGO ================ */}
        <g transform="translate(60, 1175)">
          <text x="0" y="0" fontFamily="Oswald, sans-serif" fontWeight="700" fontSize="12"
                fill="#ffffff" opacity="0.7" letterSpacing="3">OVR ENTWICKLUNG</text>
          {/* Empty axes grid */}
          <g transform="translate(140, -30)">
            <line x1="0" y1="40" x2="380" y2="40" stroke="#ffffff" strokeOpacity="0.2" />
            {[0, 1, 2, 3].map((i) => (
              <line key={i} x1="0" y1={i * 13} x2="380" y2={i * 13} stroke="#ffffff" strokeOpacity="0.08" />
            ))}
            <line x1="0" y1="0" x2="0" y2="40" stroke="#ffffff" strokeOpacity="0.2" />
          </g>
          <text x="0" y="30" fontFamily="Oswald, sans-serif" fontWeight="700" fontSize="10"
                fill="#ffffff" opacity="0.55" letterSpacing="3">SEIT LETZTEM TEST</text>

          {/* BodyFuel Apfel-Logo rechts */}
          <image href={bodyfuelLogo.url} x="580" y="-40" width="90" height="90"
                 preserveAspectRatio="xMidYMid meet" />
        </g>

        {/* ================ BOTTOM CENTER: BODYFUEL PERFORMANCE ================ */}
        <g transform="translate(400, 1230)">
          <g transform="translate(-90, -12)">
            <path d={SHIELD_ICON} fill="none" stroke="#ffffff" strokeOpacity="0.65" strokeWidth="1.4" transform="scale(0.9)" />
          </g>
          <text x="0" y="0" textAnchor="middle" fontFamily="Oswald, sans-serif" fontWeight="700" fontSize="12"
                fill="#ffffff" opacity="0.7" letterSpacing="6">BODYFUEL PERFORMANCE</text>
        </g>

        {/* ================ RAHMEN ================ */}
        <path d={framePath} fill="none" stroke="#000" strokeOpacity="0.85" strokeWidth="14" transform="translate(0,2)" style={{ filter: "blur(4px)" } as any} />
        <path d={framePath} fill="none" stroke="url(#pc-frame-metal)" strokeWidth="8" />
        <path d={framePath} fill="none" stroke={primary} strokeOpacity="0.8" strokeWidth="2.5" transform="translate(0,0) scale(0.985) translate(6,9)" />
      </svg>
    </div>
  );
}
