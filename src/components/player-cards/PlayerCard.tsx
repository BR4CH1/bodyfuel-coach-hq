/**
 * Player Card — Fixes Template (100% Referenz-Bild).
 *
 * Das Kartenbild (Rahmen, Hintergrund, Logo, Icons, Labels) ist fixiert.
 * Wir overlayen ausschließlich dynamische Werte per SVG. Fehlt ein Wert,
 * bleibt der Platz leer — das Layout verändert sich nie.
 *
 * Spielerbild bleibt vorerst raus (wird später ergänzt).
 */
import cardTemplate from "@/assets/player-card-template.png.asset.json";
import type { AttributeKey, Tier } from "@/lib/player-cards/engine";

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

// ViewBox entspricht der Originalauflösung des Kartenbilds (1023 × 1537).
const VB_W = 1023;
const VB_H = 1537;
const RED = "#E10600";

export function PlayerCard({ data }: { data: PlayerCardData }) {
  const { card, profile, bullsProfile, jerseyNumber } = data;
  const ov = card.manual_overrides ?? {};

  const bfrDisplay = ov.BFR ?? card.bfr;
  const positionFull = (card.position_key ?? bullsProfile?.position ?? profile?.sport_position ?? "").toUpperCase();
  const positionAbbr = POS_ABBR[positionFull] ?? positionFull.slice(0, 3);
  const ageVal = computeAge(profile?.birthdate);
  const heightCm = bullsProfile?.height_cm ?? profile?.height_cm ?? null;
  const weightKg = bullsProfile?.weight_kg ?? null;

  const stats: Array<{ attr: AttributeKey; value: number | null; cx: number }> = [
    { attr: "SPD", value: ov.SPD ?? card.spd, cx: 160 },
    { attr: "ACC", value: ov.ACC ?? card.acc, cx: 305 },
    { attr: "AGI", value: ov.AGI ?? card.agi, cx: 450 },
    { attr: "POW", value: ov.POW ?? card.pow, cx: 595 },
    { attr: "STR", value: ov.STR ?? card.str, cx: 740 },
    { attr: "END", value: ov.END ?? card.end_score, cx: 885 },
  ];

  const updateDate =
    card.bfr != null
      ? new Date(card.computed_at).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" })
      : "";
  const strongest = card.strongest_attribute ?? "";

  return (
    <div className="relative h-full w-full">
      <svg
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        preserveAspectRatio="xMidYMid meet"
        xmlns="http://www.w3.org/2000/svg"
        className="h-full w-full"
        style={{ filter: "drop-shadow(0 30px 60px rgba(0,0,0,0.85))" }}
      >
        {/* Fixes Template-Bild (Rahmen, Hintergrund, Logo, Icons, Labels) */}
        <image href={cardTemplate.url} x="0" y="0" width={VB_W} height={VB_H} preserveAspectRatio="xMidYMid meet" />

        {/* ============ OBEN LINKS: OVR / POSITION / # ============ */}
        {bfrDisplay != null && (
          <text
            x="175" y="255"
            textAnchor="middle"
            fontFamily="Anton, Bebas Neue, sans-serif"
            fontSize="150"
            fill={RED}
          >
            {bfrDisplay}
          </text>
        )}
        {positionAbbr && (
          <text
            x="175" y="440"
            textAnchor="middle"
            fontFamily="Anton, Bebas Neue, sans-serif"
            fontSize="96"
            fill={RED}
            letterSpacing="2"
          >
            {positionAbbr}
          </text>
        )}
        {jerseyNumber && (
          <text
            x="175" y="580"
            textAnchor="middle"
            fontFamily="Anton, Bebas Neue, sans-serif"
            fontSize="56"
            fill="#ffffff"
          >
            #{jerseyNumber}
          </text>
        )}

        {/* ============ INFO-BLOCK: Alter / Größe / Gewicht ============ */}
        {ageVal != null && (
          <text x="255" y="775" fontFamily="Anton, Bebas Neue, sans-serif" fontSize="32" fill="#ffffff" letterSpacing="1">
            {ageVal}
          </text>
        )}
        {heightCm != null && (
          <text x="255" y="850" fontFamily="Anton, Bebas Neue, sans-serif" fontSize="32" fill="#ffffff" letterSpacing="1">
            {heightCm} cm
          </text>
        )}
        {weightKg != null && (
          <text x="255" y="925" fontFamily="Anton, Bebas Neue, sans-serif" fontSize="32" fill="#ffffff" letterSpacing="1">
            {weightKg} kg
          </text>
        )}

        {/* ============ ATTRIBUTE (überlagern die Icons, wenn Wert vorhanden) ============ */}
        {stats.map((s) =>
          s.value != null ? (
            <g key={s.attr}>
              {/* dunkler Hintergrund, um Icon zu verdecken */}
              <rect x={s.cx - 55} y={1200} width={110} height={100} fill="#000000" opacity="0.85" rx="8" />
              <text
                x={s.cx}
                y={1275}
                textAnchor="middle"
                fontFamily="Anton, Bebas Neue, sans-serif"
                fontSize="72"
                fill="#ffffff"
              >
                {s.value}
              </text>
            </g>
          ) : null,
        )}

        {/* ============ INFO-ROW: Update / Stärke (Kartenstufe im Template) ============ */}
        {updateDate && (
          <text
            x="490" y="1420"
            fontFamily="Anton, Bebas Neue, sans-serif"
            fontSize="26"
            fill="#ffffff"
            letterSpacing="1"
          >
            {updateDate}
          </text>
        )}
        {strongest && (
          <text
            x="820" y="1420"
            fontFamily="Anton, Bebas Neue, sans-serif"
            fontSize="26"
            fill={RED}
            letterSpacing="2"
          >
            {strongest}
          </text>
        )}
      </svg>
    </div>
  );
}
