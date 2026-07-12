/**
 * Player Card — Ultimate-Team-Style, SVG-basiert.
 * 1:1 nach Referenz (FUT/Madden-Optik).
 * Werte werden als "—" gerendert, echte Daten kommen später aus Tests.
 */
import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { supabase } from "@/integrations/supabase/client";
import bekimCardAsset from "@/assets/bekim-player-card.png.asset.json";
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
  silver: "SILBER",
  gold: "GOLD",
  elite: "ELITE",
  legendary: "LEGENDARY",
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

// Kleine, klare Icons für die Stats (rot)
const STAT_ICONS: Record<AttributeKey, string> = {
  // running man
  SPD: "M14 4a2 2 0 1 0 0-4 2 2 0 0 0 0 4Zm-4.5 20 3-8 4-2 3 4 3 1.5M6.5 15l-2 3",
  // lightning
  ACC: "M13 2 3 14h7l-1 8 10-12h-7l1-8z",
  // arrows crossing
  AGI: "M3 3l8 8m0 0V6m0 5H6m15-8-8 8m0 0V6m0 5h5M3 21l8-8m0 0v5m0-5H6m15 8-8-8m0 0v5m0-5h5",
  // explosion / star burst
  POW: "M12 2v4l3-2 1 4 4-1-2 3 4 1-4 2 2 3-4-1-1 4-3-2-3 2-1-4-4 1 2-3-4-1 4-2-2-3 4 1 1-4 3 2V2z",
  // dumbbell
  STR: "M4 8v8M2 6v12M20 6v12M22 8v8M4 12h16",
  // heart pulse
  END: "M20.4 6.6a5.5 5.5 0 0 0-8.4-.6 5.5 5.5 0 0 0-8.4.6c-2.1 2.4-1.5 6.5 4.4 11.4L12 21l4-3c5.9-4.9 6.5-9 4.4-11.4zM4 12h3l2-3 2 5 2-3h6",
};

// Icons Info-Zeile
const SHIELD_ICON =
  "M12 2 4 5v6c0 5 3.5 9.5 8 11 4.5-1.5 8-6 8-11V5l-8-3z";
const CAL_ICON =
  "M7 3v3m10-3v3M4 8h16M5 6h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1z";
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

  const { card, profile, bullsProfile, organization, jerseyNumber, teamLabel, shareUrl } = data;

  // Bekim bekommt exakt die Referenz-Karte als Bild.
  const fullName = `${bullsProfile?.first_name ?? ""} ${bullsProfile?.last_name ?? ""} ${profile?.display_name ?? ""}`.toLowerCase();
  const isBekim = /bekim/.test(fullName) && /loshaj/.test(fullName);
  if (isBekim) {
    return (
      <div className="relative h-full w-full">
        <img
          src={bekimCardAsset.url}
          alt="Bekim Loshaj — Player Card"
          className="h-full w-full object-contain"
          style={{ filter: "drop-shadow(0 30px 60px rgba(0,0,0,0.85))" }}
        />
      </div>
    );
  }

  const primary = organization?.primary_color ?? "#E10600";
  const claim = organization?.claim ?? "BUILT FOR TEAMS. DRIVEN BY PERFORMANCE.";
  const clubName = (organization?.name ?? "").toUpperCase();

  const first = (bullsProfile?.first_name || profile?.display_name?.split(" ")[0] || profile?.nickname || "").toUpperCase();
  const last = (
    bullsProfile?.last_name ||
    (profile?.display_name?.includes(" ") ? profile?.display_name?.split(" ").slice(1).join(" ") : profile?.display_name ?? "") ||
    ""
  ).toUpperCase();
  const ageVal = computeAge(profile?.birthdate);
  const positionFull = (card.position_key ?? bullsProfile?.position ?? profile?.sport_position ?? "").toUpperCase();
  const positionAbbr = POS_ABBR[positionFull] ?? positionFull.slice(0, 3);

  const secondaryPos = ""; // reserved: falls später Zweitposition kommt
  const jersey = jerseyNumber ? `#${jerseyNumber}` : "";

  const metaParts = [teamLabel?.toUpperCase(), positionFull, secondaryPos, jersey].filter(Boolean) as string[];

  const updateDate = card.bfr != null
    ? new Date(card.computed_at).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" })
    : "—";
  const qrValue = shareUrl || (typeof window !== "undefined" ? window.location.href : "https://bodyfuel-coaching.com");

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

  // Frame path — abgeschrägte Ecken + Namen-Notch oben
  const FW = 800;
  const FH = 1200;
  const framePath = `
    M 26 62
    L 62 26
    L 360 26
    L 380 46
    L 400 26
    L 420 46
    L 440 26
    L 738 26
    L 774 62
    L 774 1138
    L 738 1174
    L 440 1174
    L 420 1154
    L 400 1174
    L 380 1154
    L 360 1174
    L 62 1174
    L 26 1138
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
          {/* METAL RAHMEN */}
          <linearGradient id="pc-frame-metal" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"  stopColor="#f6f7f9" />
            <stop offset="18%" stopColor="#b8bcc2" />
            <stop offset="40%" stopColor="#4a4c50" />
            <stop offset="55%" stopColor="#1a1b1e" />
            <stop offset="72%" stopColor="#5a5d63" />
            <stop offset="90%" stopColor="#c9ccd2" />
            <stop offset="100%" stopColor="#0f1013" />
          </linearGradient>
          <linearGradient id="pc-frame-hi" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"  stopColor="#ffffff" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
          </linearGradient>

          {/* HINTERGRUND */}
          <linearGradient id="pc-bg-base" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"  stopColor="#1a0405" />
            <stop offset="45%" stopColor="#0a0203" />
            <stop offset="100%" stopColor="#050506" />
          </linearGradient>
          <radialGradient id="pc-bg-glow" cx="50%" cy="35%" r="65%">
            <stop offset="0%"  stopColor={primary} stopOpacity="0.55" />
            <stop offset="45%" stopColor="#5a0000" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#000" stopOpacity="0" />
          </radialGradient>
          <pattern id="pc-shards" x="0" y="0" width="120" height="120" patternUnits="userSpaceOnUse">
            <path d="M0 40 L60 10 L120 50 L90 90 L30 110 Z" fill="none" stroke="#3a1214" strokeOpacity="0.5" strokeWidth="1" />
            <path d="M20 0 L80 20 L110 70" fill="none" stroke="#4a1517" strokeOpacity="0.35" strokeWidth="1" />
            <path d="M0 90 L40 70 L70 100" fill="none" stroke="#2a0a0b" strokeOpacity="0.6" strokeWidth="1" />
          </pattern>

          {/* NAME METAL */}
          <linearGradient id="pc-name-metal" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"  stopColor="#ffffff" />
            <stop offset="35%" stopColor="#e6e8ec" />
            <stop offset="55%" stopColor="#9ea1a7" />
            <stop offset="80%" stopColor="#4a4c50" />
            <stop offset="100%" stopColor="#232427" />
          </linearGradient>

          {/* PANEL */}
          <linearGradient id="pc-panel" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"  stopColor="#161618" stopOpacity="0.98" />
            <stop offset="100%" stopColor="#050506" stopOpacity="0.98" />
          </linearGradient>
          <linearGradient id="pc-panel-hi" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"  stopColor="#ffffff" stopOpacity="0.16" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
          </linearGradient>

          {/* GLOW */}
          <filter id="pc-glow-red" x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="4" />
          </filter>
          <filter id="pc-noise">
            <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="7" />
            <feColorMatrix values="0 0 0 0 0.5  0 0 0 0 0.45  0 0 0 0 0.45  0 0 0 0.14 0" />
          </filter>

          <clipPath id="pc-clip">
            <path d={framePath} />
          </clipPath>
          <clipPath id="pc-feet">
            <rect x="26" y="820" width="748" height="360" />
          </clipPath>
        </defs>

        {/* ================ HINTERGRUND ================ */}
        <g clipPath="url(#pc-clip)">
          <rect x="0" y="0" width={FW} height={FH} fill="url(#pc-bg-base)" />
          <rect x="0" y="0" width={FW} height={FH} fill="url(#pc-shards)" opacity="0.9" />
          <ellipse cx="400" cy="440" rx="420" ry="520" fill="url(#pc-bg-glow)" />
          {/* Rote Splitter/Partikel */}
          {Array.from({ length: 60 }).map((_, i) => {
            const s = (i * 9301 + 49297) % 233280;
            const x = 40 + (s % 720);
            const y = 40 + ((s * 3) % 1120);
            const r = 0.5 + ((s * 7) % 28) / 14;
            return <circle key={i} cx={x} cy={y} r={r} fill={primary} opacity={0.15 + ((s * 11) % 40) / 140} />;
          })}
          <rect x="0" y="0" width={FW} height={FH} filter="url(#pc-noise)" opacity="0.35" />

          {/* SPIELERBILD */}
          {avatarUrl && (
            <>
              <ellipse cx="400" cy="470" rx="280" ry="220" fill={primary} opacity="0.25" style={{ mixBlendMode: "screen", filter: "blur(40px)" } as any} />
              <image
                href={avatarUrl}
                x="80"
                y="40"
                width="640"
                height="900"
                preserveAspectRatio="xMidYMax meet"
                onError={() => { if (rawAvatar) AVATAR_CACHE.delete(rawAvatar); setAvatarUrl(null); }}
                style={{ filter: "drop-shadow(0 30px 30px rgba(0,0,0,0.7))" } as any}
              />
            </>
          )}
        </g>

        {/* ================ TOP LEFT: OVR / POS / # ================ */}
        <g>
          <text x="130" y="180" textAnchor="middle"
                fontFamily="Anton, Bebas Neue, sans-serif" fontWeight="900" fontSize="130"
                fill="#ffffff" style={{ paintOrder: "stroke", stroke: "rgba(0,0,0,0.6)", strokeWidth: 2 } as any}>
            {bfrDisplay ?? "—"}
          </text>
          <text x="130" y="220" textAnchor="middle"
                fontFamily="Oswald, sans-serif" fontWeight="800" fontSize="28"
                fill={primary} letterSpacing="6">OVR</text>

          <text x="130" y="340" textAnchor="middle"
                fontFamily="Anton, Bebas Neue, sans-serif" fontWeight="900" fontSize="72"
                fill={primary} letterSpacing="1"
                style={{ paintOrder: "stroke", stroke: "rgba(0,0,0,0.5)", strokeWidth: 2 } as any}>
            {positionAbbr || "—"}
          </text>
          <line x1="98" y1="360" x2="162" y2="360" stroke={primary} strokeWidth="3" />
          <text x="130" y="410" textAnchor="middle"
                fontFamily="Oswald, sans-serif" fontWeight="700" fontSize="30"
                fill="#ffffff" opacity="0.95">
            {jersey || "—"}
          </text>
        </g>

        {/* ================ TOP RIGHT: LOGO + CLUBNAME ================ */}
        <g>
          {organization?.logo_url ? (
            <image href={organization.logo_url} x="590" y="70" width="170" height="170"
                   preserveAspectRatio="xMidYMid meet"
                   style={{ filter: "drop-shadow(0 6px 12px rgba(0,0,0,0.6))" } as any} />
          ) : (
            <g>
              <circle cx="675" cy="150" r="70" fill="none" stroke={primary} strokeWidth="4" />
              <text x="675" y="165" textAnchor="middle" fontFamily="Oswald, sans-serif" fontWeight="800" fontSize="30" fill={primary}>
                {organization?.short_name ?? "BF"}
              </text>
            </g>
          )}
          {clubName && (
            <text x="675" y="270" textAnchor="middle"
                  fontFamily="Anton, Bebas Neue, sans-serif" fontSize="22"
                  fill="#ffffff" opacity="0.92" letterSpacing="4">
              {clubName}
            </text>
          )}
        </g>

        {/* ================ FÜSSE VOR NAMEN ================ */}
        {avatarUrl && (
          <g clipPath="url(#pc-clip)">
            <g clipPath="url(#pc-feet)">
              <image href={avatarUrl} x="80" y="40" width="640" height="900"
                     preserveAspectRatio="xMidYMax meet"
                     style={{ filter: "drop-shadow(0 20px 20px rgba(0,0,0,0.7))" } as any} />
            </g>
          </g>
        )}

        {/* ================ NAME ================ */}
        <g textAnchor="middle">
          <text x="400" y="820"
                fontFamily="Anton, Bebas Neue, sans-serif" fontSize="46"
                fill={primary} letterSpacing="10"
                style={{ paintOrder: "stroke", stroke: "rgba(0,0,0,0.6)", strokeWidth: 3 } as any}>
            {first || "—"}
          </text>
          <text x="400" y="920"
                fontFamily="Anton, Bebas Neue, sans-serif"
                fontSize={last.length > 9 ? 108 : last.length > 7 ? 128 : 148}
                fill="url(#pc-name-metal)"
                letterSpacing="4"
                style={{ paintOrder: "stroke", stroke: "rgba(0,0,0,0.7)", strokeWidth: 2.5 } as any}>
            {last || "—"}
          </text>
          {/* Meta-Zeile mit Bullets */}
          <g fontFamily="Oswald, sans-serif" fontWeight="700" fontSize="16" fill="#ffffff" letterSpacing="4">
            {(() => {
              if (metaParts.length === 0) {
                return <text x="400" y="958" opacity="0.7">—</text>;
              }
              const gaps = 40;
              // approximiere Breite je Char 8
              const widths = metaParts.map((p) => p.length * 9 + 4);
              const total = widths.reduce((a, b) => a + b, 0) + gaps * (metaParts.length - 1);
              let cursor = 400 - total / 2;
              return metaParts.map((p, i) => {
                const w = widths[i];
                const cx = cursor + w / 2;
                const node = (
                  <g key={i}>
                    <text x={cx} y="958" textAnchor="middle" opacity="0.9">{p}</text>
                    {i < metaParts.length - 1 && (
                      <circle cx={cursor + w + gaps / 2} cy="953" r="2.5" fill={primary} />
                    )}
                  </g>
                );
                cursor += w + gaps;
                return node;
              });
            })()}
          </g>
        </g>

        {/* ================ STAT PANEL ================ */}
        <g transform="translate(50, 985)">
          <rect x="0" y="0" width="700" height="150" rx="10" fill="url(#pc-panel)" />
          <rect x="0" y="0" width="700" height="150" rx="10" fill="url(#pc-panel-hi)" />
          <rect x="0.75" y="0.75" width="698.5" height="148.5" rx="9.25" fill="none" stroke="#ffffff" strokeOpacity="0.14" strokeWidth="1.2" />
          {[0, 1, 2, 3, 4].map((i) => (
            <line key={i} x1={(700 / 6) * (i + 1)} y1="18" x2={(700 / 6) * (i + 1)} y2="132" stroke="#ffffff" strokeOpacity="0.08" />
          ))}
          {stats.map((s, i) => {
            const cx = (700 / 6) * i + 700 / 12;
            const segs = 6;
            const filled = s.value == null ? 0 : Math.round((s.value / 99) * segs);
            return (
              <g key={s.attr}>
                <text x={cx} y="26" textAnchor="middle"
                      fontFamily="Oswald, sans-serif" fontWeight="800" fontSize="16"
                      fill="#ffffff" letterSpacing="2">{s.attr}</text>
                <text x={cx} y="66" textAnchor="middle"
                      fontFamily="Anton, Bebas Neue, sans-serif" fontSize="40"
                      fill="#ffffff"
                      style={{ paintOrder: "stroke", stroke: "rgba(0,0,0,0.5)", strokeWidth: 1.5 } as any}>
                  {s.value ?? "—"}
                </text>
                <g transform={`translate(${cx - 11}, 78)`}>
                  <path d={STAT_ICONS[s.attr]} fill="none" stroke={primary} strokeWidth="1.8"
                        strokeLinecap="round" strokeLinejoin="round" transform="scale(0.9)" />
                </g>
                {/* segment bars */}
                <g transform={`translate(${cx - 33}, 112)`}>
                  {Array.from({ length: segs }).map((_, j) => (
                    <rect key={j} x={j * 12} y="0" width="9" height="5" rx="1"
                          fill={j < filled ? primary : "#ffffff"}
                          opacity={j < filled ? 1 : 0.16} />
                  ))}
                </g>
                <text x={cx} y="140" textAnchor="middle"
                      fontFamily="Oswald, sans-serif" fontWeight="600" fontSize="11"
                      fill="#ffffff" opacity="0.55" letterSpacing="1">
                  {s.value ?? "—"} PCTL
                </text>
              </g>
            );
          })}
        </g>

        {/* ================ INFO ROW (3 Spalten) ================ */}
        <g transform="translate(50, 1150)">
          {/* Kartenstufe */}
          <g transform="translate(20, 0)">
            <g transform="translate(0, -2)">
              <path d={SHIELD_ICON} fill={primary} stroke={primary} strokeWidth="1" transform="translate(0, 0) scale(0.9)" />
              <path d="M6 8l2 2 4-4" fill="none" stroke="#ffffff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" transform="scale(0.9)" />
            </g>
            <text x="30" y="4" fontFamily="Oswald, sans-serif" fontWeight="700" fontSize="11"
                  fill="#ffffff" opacity="0.55" letterSpacing="3">KARTENSTUFE</text>
            <text x="30" y="26" fontFamily="Anton, Bebas Neue, sans-serif" fontSize="22"
                  fill={primary} letterSpacing="2">
              {card.tier ? TIER_LABELS[card.tier] : "—"}
            </text>
          </g>
          {/* Letztes Update */}
          <g transform="translate(260, 0)">
            <path d={CAL_ICON} fill="none" stroke={primary} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" transform="translate(0,-2) scale(0.9)" />
            <text x="32" y="4" fontFamily="Oswald, sans-serif" fontWeight="700" fontSize="11"
                  fill="#ffffff" opacity="0.55" letterSpacing="3">LETZTES UPDATE</text>
            <text x="32" y="26" fontFamily="Anton, Bebas Neue, sans-serif" fontSize="22"
                  fill="#ffffff" letterSpacing="1">
              {updateDate}
            </text>
          </g>
          {/* Größte Stärke */}
          <g transform="translate(500, 0)">
            <path d={BOLT_ICON} fill={primary} transform="translate(0,-2) scale(0.9)" />
            <text x="30" y="4" fontFamily="Oswald, sans-serif" fontWeight="700" fontSize="11"
                  fill="#ffffff" opacity="0.55" letterSpacing="3">GRÖSSTE STÄRKE</text>
            <text x="30" y="26" fontFamily="Anton, Bebas Neue, sans-serif" fontSize="22"
                  fill={primary} letterSpacing="2">
              {card.strongest_attribute ?? "—"}
            </text>
          </g>
        </g>

        {/* ================ VERTIKALE SEITENTEXTE ================ */}
        <g transform="translate(52, 630) rotate(-90)">
          <text textAnchor="middle" fontFamily="Oswald, sans-serif" fontWeight="700" fontSize="13"
                fill="#ffffff" opacity="0.6" letterSpacing="10">
            BODYFUEL PERFORMANCE
          </text>
        </g>
        <g transform="translate(752, 630) rotate(-90)">
          <text textAnchor="middle" fontFamily="Oswald, sans-serif" fontWeight="700" fontSize="13"
                fill="#ffffff" opacity="0.6" letterSpacing="10">
            {claim}
          </text>
        </g>

        {/* ================ QR verborgen als foreignObject (kleiner Anker unten) ================
             In der Referenz sitzt der QR im "TEILE DEINE KARTE"-Block ganz unten.
             Werte werden ausgeblendet, sobald keine Daten vorhanden sind — der QR bleibt aber
             immer aktiv, weil er nur die Share-URL trägt. */}
        <foreignObject x="0" y="0" width="1" height="1">
          <div style={{ position: "absolute", visibility: "hidden" }}>
            <QRCodeSVG value={qrValue} size={1} />
          </div>
        </foreignObject>

        {/* ================ RAHMEN ================ */}
        <path d={framePath} fill="none" stroke="#000" strokeOpacity="0.85" strokeWidth="14" transform="translate(0,2)" style={{ filter: "blur(4px)" } as any} />
        <path d={framePath} fill="none" stroke="url(#pc-frame-metal)" strokeWidth="10" />
        <path d={framePath} fill="none" stroke={primary} strokeOpacity="0.75" strokeWidth="2" />
        <path d={framePath} fill="none" stroke="url(#pc-frame-hi)" strokeWidth="1.2" strokeOpacity="0.9" transform="translate(0,-1)" />
        <path d={framePath} fill="none" stroke="#000" strokeOpacity="0.8" strokeWidth="1.2" transform="translate(0,3)" />
      </svg>
    </div>
  );
}
