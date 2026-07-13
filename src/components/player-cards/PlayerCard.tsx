/**
 * Player Card — Fixes Template (100% Referenz-Bild) mit konfigurierbarem Layout.
 *
 * Positionen aller Overlay-Elemente kommen aus `PlayerCardLayout`
 * (siehe `src/lib/player-cards/layout.ts`). Bearbeitung im Layout-Editor.
 */
import cardTemplate from "@/assets/player-card-template.png.asset.json";
import type { AttributeKey, Tier } from "@/lib/player-cards/engine";
import { DEFAULT_LAYOUT, VB_H, VB_W, type PlayerCardLayout } from "@/lib/player-cards/layout";

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
  QUARTERBACK: "QB", "RUNNING BACK": "RB", "WIDE RECEIVER": "WR", "TIGHT END": "TE",
  "OFFENSIVE LINE": "OL", "DEFENSIVE LINE": "DL", LINEBACKER: "LB", CORNERBACK: "CB",
  SAFETY: "S", KICKER: "K", PUNTER: "P",
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

const RED = "#E10600";
const FONT = "Anton, Bebas Neue, sans-serif";

export function PlayerCard({
  data,
  layout = DEFAULT_LAYOUT,
}: {
  data: PlayerCardData;
  layout?: PlayerCardLayout;
}) {
  const { card, profile, bullsProfile, jerseyNumber } = data;
  const ov = card.manual_overrides ?? {};

  const bfrDisplay = ov.BFR ?? card.bfr;
  const positionFull = (card.position_key ?? bullsProfile?.position ?? profile?.sport_position ?? "").toUpperCase();
  const positionAbbr = POS_ABBR[positionFull] ?? positionFull.slice(0, 3);
  const ageVal = computeAge(profile?.birthdate);
  const heightCm = bullsProfile?.height_cm ?? profile?.height_cm ?? null;
  const weightKg = bullsProfile?.weight_kg ?? null;

  const attrs: Array<{ key: keyof PlayerCardLayout; value: number | null }> = [
    { key: "spd", value: ov.SPD ?? card.spd },
    { key: "acc", value: ov.ACC ?? card.acc },
    { key: "agi", value: ov.AGI ?? card.agi },
    { key: "pow", value: ov.POW ?? card.pow },
    { key: "str", value: ov.STR ?? card.str },
    { key: "end", value: ov.END ?? card.end_score },
  ];

  const updateDate =
    card.bfr != null
      ? new Date(card.computed_at).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" })
      : "";
  const strongest = card.strongest_attribute ?? "";

  const photoUrl = layout.photo.url ?? profile?.avatar_cutout_url ?? profile?.avatar_url ?? null;

  return (
    <div className="relative h-full w-full">
      <svg
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        preserveAspectRatio="xMidYMid meet"
        xmlns="http://www.w3.org/2000/svg"
        className="h-full w-full"
        style={{ filter: "drop-shadow(0 30px 60px rgba(0,0,0,0.85))" }}
      >
        {/* Spielerbild (unter der Template-Vorlage) */}
        {photoUrl && (
          <image
            href={photoUrl}
            x={layout.photo.x}
            y={layout.photo.y}
            width={layout.photo.w}
            height={layout.photo.h}
            preserveAspectRatio="xMidYMid meet"
          />
        )}

        {/* Fixes Template-Bild */}
        <image href={cardTemplate.url} x="0" y="0" width={VB_W} height={VB_H} preserveAspectRatio="xMidYMid meet" />

        {bfrDisplay != null && (
          <text x={layout.ovr.x} y={layout.ovr.y} textAnchor="middle" fontFamily={FONT} fontSize={layout.ovr.fontSize} fill={RED}>
            {bfrDisplay}
          </text>
        )}
        {positionAbbr && (
          <text x={layout.pos.x} y={layout.pos.y} textAnchor="middle" fontFamily={FONT} fontSize={layout.pos.fontSize} fill={RED} letterSpacing="2">
            {positionAbbr}
          </text>
        )}
        {jerseyNumber && (
          <text x={layout.jersey.x} y={layout.jersey.y} textAnchor="middle" fontFamily={FONT} fontSize={layout.jersey.fontSize} fill="#ffffff">
            #{jerseyNumber}
          </text>
        )}

        {ageVal != null && (
          <text x={layout.age.x} y={layout.age.y} fontFamily={FONT} fontSize={layout.age.fontSize} fill="#ffffff" letterSpacing="1">{ageVal}</text>
        )}
        {heightCm != null && (
          <text x={layout.height.x} y={layout.height.y} fontFamily={FONT} fontSize={layout.height.fontSize} fill="#ffffff" letterSpacing="1">{heightCm} cm</text>
        )}
        {weightKg != null && (
          <text x={layout.weight.x} y={layout.weight.y} fontFamily={FONT} fontSize={layout.weight.fontSize} fill="#ffffff" letterSpacing="1">{weightKg} kg</text>
        )}

        {attrs.map((a) => {
          const it = layout[a.key] as { x: number; y: number; fontSize?: number };
          if (a.value == null) return null;
          const fs = it.fontSize ?? 72;
          return (
            <g key={a.key}>
              <rect x={it.x - 55} y={it.y - fs} width={110} height={fs + 25} fill="#000000" opacity="0.85" rx="8" />
              <text x={it.x} y={it.y} textAnchor="middle" fontFamily={FONT} fontSize={fs} fill="#ffffff">
                {a.value}
              </text>
            </g>
          );
        })}

        {updateDate && (
          <text x={layout.updateDate.x} y={layout.updateDate.y} fontFamily={FONT} fontSize={layout.updateDate.fontSize} fill="#ffffff" letterSpacing="1">
            {updateDate}
          </text>
        )}
        {strongest && (
          <text x={layout.strongest.x} y={layout.strongest.y} fontFamily={FONT} fontSize={layout.strongest.fontSize} fill={RED} letterSpacing="2">
            {strongest}
          </text>
        )}
      </svg>
    </div>
  );
}
