/**
 * Player Card — Rückseite. BFR-Verlauf, PBs, Coach-Summary, Fortschritt.
 */
import { ClientRecharts } from "@/components/charts/ClientRecharts";
import type { PlayerCardData } from "./PlayerCard";
import type { AttributeKey } from "@/lib/player-cards/engine";
import {
  PlayerCardBadgeWall,
  type BadgeDefinitionRow,
  type BadgeUnlockRow,
} from "./PlayerCardBadgeWall";

type VerifiedPlayerTest = {
  test_id: string;
  result_value: number | string;
  result_unit: string;
  performed_at: string;
};

export type PlayerCardHistoryPoint = {
  bfr: number | null;
  spd: number | null;
  acc: number | null;
  agi: number | null;
  pow: number | null;
  str: number | null;
  end_score: number | null;
  snapshot_at: string;
};

const ATTR_LABEL: Record<AttributeKey, string> = {
  SPD: "Speed",
  ACC: "Acceleration",
  AGI: "Agility",
  POW: "Power",
  STR: "Strength",
  END: "Endurance",
};

const TEST_LABELS: Record<string, string> = {
  sprint_10yd: "10 Yard Sprint",
  sprint_40yd: "40 Yard Dash",
  broad_jump: "Broad Jump",
  cmj_height: "Countermovement Jump",
  bench_press_5rm: "Bench Press 5RM",
  trap_bar_5rm: "Trap Bar 5RM",
  a505_left: "Adapted 505 links",
  a505_right: "Adapted 505 rechts",
  rast_6x35m: "RAST 6 × 35 m",
};

function buildCoachSummary(
  current: PlayerCardData["card"],
  previous: PlayerCardHistoryPoint | null,
): string {
  if (!previous || current.bfr == null) {
    return "Wir sammeln gerade deine Basiswerte. Ein paar Tests mehr und wir können deine Entwicklung präzise beschreiben.";
  }
  const attrs: AttributeKey[] = ["SPD", "ACC", "AGI", "POW", "STR", "END"];
  const currentMap: Record<AttributeKey, number | null> = {
    SPD: current.spd,
    ACC: current.acc,
    AGI: current.agi,
    POW: current.pow,
    STR: current.str,
    END: current.end_score,
  };
  const prevMap: Record<AttributeKey, number | null> = {
    SPD: previous.spd,
    ACC: previous.acc,
    AGI: previous.agi,
    POW: previous.pow,
    STR: previous.str,
    END: previous.end_score,
  };
  const deltas = attrs
    .map((k) => ({ key: k, delta: (currentMap[k] ?? 0) - (prevMap[k] ?? 0) }))
    .filter((d) => Number.isFinite(d.delta));
  const gained = [...deltas].sort((a, b) => b.delta - a.delta)[0];
  const lost = [...deltas].sort((a, b) => a.delta - b.delta)[0];
  const parts: string[] = [];
  if (gained && gained.delta > 0) {
    parts.push(`Größter Sprung im Bereich ${ATTR_LABEL[gained.key]} (+${gained.delta}).`);
  }
  if (lost && lost.delta < 0) {
    parts.push(`Größtes Entwicklungsfeld: ${ATTR_LABEL[lost.key]} (${lost.delta}).`);
  }
  if (!parts.length)
    parts.push("Deine Werte sind stabil — nächster Test zeigt, wohin die Reise geht.");
  return parts.join(" ");
}

export function PlayerCardBack({
  data,
  history,
  badges,
}: {
  data: PlayerCardData;
  history: PlayerCardHistoryPoint[];
  badges?: { definitions: BadgeDefinitionRow[]; unlocks: BadgeUnlockRow[] };
}) {
  const { card, organization } = data;
  const verifiedTests = (data as PlayerCardData & { verifiedTests?: VerifiedPlayerTest[] })
    .verifiedTests;
  const primary = organization?.primary_color ?? "#dc2626";
  const accent = organization?.accent_color ?? primary;
  const bg = organization?.background_color ?? "#0a0a0a";
  const text = organization?.text_color ?? "#ffffff";

  const chartData = history.map((h) => ({
    date: new Date(h.snapshot_at).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" }),
    bfr: h.bfr ?? 0,
  }));

  const previous = history.length > 1 ? history[history.length - 2] : null;
  const summary = buildCoachSummary(card, previous);

  const attrs: AttributeKey[] = ["SPD", "ACC", "AGI", "POW", "STR", "END"];
  const currentMap: Record<AttributeKey, number | null> = {
    SPD: card.spd,
    ACC: card.acc,
    AGI: card.agi,
    POW: card.pow,
    STR: card.str,
    END: card.end_score,
  };
  const prevMap: Record<AttributeKey, number | null> = previous
    ? {
        SPD: previous.spd,
        ACC: previous.acc,
        AGI: previous.agi,
        POW: previous.pow,
        STR: previous.str,
        END: previous.end_score,
      }
    : { SPD: null, ACC: null, AGI: null, POW: null, STR: null, END: null };

  const pbList = (verifiedTests ?? []).slice(0, 20);
  // Beste Werte pro test_id.
  const pbMap = new Map<string, { value: number; unit: string; performed_at: string }>();
  for (const t of pbList) {
    const key = t.test_id as string;
    const lowerBetter = /^sprint_|^a505_|^rast_/.test(key);
    const existing = pbMap.get(key);
    const val = Number(t.result_value);
    if (!existing || (lowerBetter ? val < existing.value : val > existing.value)) {
      pbMap.set(key, { value: val, unit: t.result_unit, performed_at: t.performed_at });
    }
  }
  const pbs = Array.from(pbMap.entries()).slice(0, 8);

  return (
    <div className="w-full h-full rounded-[28px] pc-metal-frame p-[3px]">
      <div
        className="h-full w-full overflow-hidden overflow-y-auto rounded-[26px] p-4"
        style={{
          background: `radial-gradient(120% 90% at 50% 0%, color-mix(in oklab, ${primary} 20%, ${bg}) 0%, ${bg} 55%, #000 100%)`,
          color: text,
        }}
      >
        <div className="text-center">
          <div
            className="text-[10px] font-bold uppercase tracking-[0.3em]"
            style={{ color: accent }}
          >
            Player Details
          </div>
          <div className="font-display text-lg font-black">BFR Entwicklung</div>
        </div>

        {/* BFR Chart */}
        <div className="mt-2 h-32 w-full">
          {chartData.length >= 2 ? (
            <ClientRecharts
              fallback={
                <div className="flex h-full items-center justify-center text-[10px] text-white/50">
                  Verlauf wird geladen…
                </div>
              }
            >
              {({ ResponsiveContainer, LineChart, XAxis, YAxis, Tooltip, Line }) => (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 9, fill: "#ffffff80" }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      domain={[40, 99]}
                      tick={{ fontSize: 9, fill: "#ffffff80" }}
                      axisLine={false}
                      tickLine={false}
                      width={30}
                    />
                    <Tooltip
                      contentStyle={{
                        background: "#111",
                        border: `1px solid ${accent}`,
                        fontSize: 11,
                      }}
                      labelStyle={{ color: "#fff" }}
                    />
                    <Line
                      type="monotone"
                      dataKey="bfr"
                      stroke={accent}
                      strokeWidth={2.5}
                      dot={{ r: 3, fill: accent }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </ClientRecharts>
          ) : (
            <div className="flex h-full items-center justify-center text-[10px] text-white/50">
              Noch nicht genug Datenpunkte für einen Verlauf.
            </div>
          )}
        </div>

        {/* Delta since last */}
        <div className="mt-3">
          <div className="mb-1 text-[9px] font-bold uppercase tracking-[0.25em] text-white/60">
            Fortschritt seit letztem Test
          </div>
          <div className="grid grid-cols-3 gap-1 rounded-lg border border-white/10 bg-black/40 px-2 py-2 text-[10px]">
            {attrs.map((k) => {
              const cur = currentMap[k];
              const prev = prevMap[k];
              const delta = cur != null && prev != null ? cur - prev : null;
              return (
                <div key={k} className="flex items-center justify-between">
                  <span className="text-white/70">{k}</span>
                  <span
                    className="tabular-nums font-bold"
                    style={{
                      color:
                        delta == null
                          ? "#ffffff80"
                          : delta > 0
                            ? "#4ade80"
                            : delta < 0
                              ? "#f87171"
                              : "#ffffff80",
                    }}
                  >
                    {delta == null ? "—" : `${delta > 0 ? "+" : ""}${delta}`}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* PBs */}
        <div className="mt-3">
          <div className="mb-1 text-[9px] font-bold uppercase tracking-[0.25em] text-white/60">
            Persönliche Bestleistungen
          </div>
          <div className="space-y-0.5 rounded-lg border border-white/10 bg-black/40 px-2 py-2 text-[10px]">
            {pbs.length === 0 && (
              <div className="text-white/50">Noch keine verifizierten Tests.</div>
            )}
            {pbs.map(([key, pb]) => (
              <div key={key} className="flex items-center justify-between">
                <span className="text-white/80">{TEST_LABELS[key] ?? key}</span>
                <span className="tabular-nums font-bold" style={{ color: accent }}>
                  {pb.value.toFixed(pb.unit === "kg" || pb.unit === "cm" ? 1 : 2)}
                  <span className="ml-1 text-white/50">{pb.unit}</span>
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Coach summary */}
        <div className="mt-3">
          <div className="mb-1 text-[9px] font-bold uppercase tracking-[0.25em] text-white/60">
            Coach Summary
          </div>
          <div className="rounded-lg border border-white/10 bg-black/40 px-2 py-2 text-[11px] leading-relaxed text-white/90">
            {summary}
          </div>
        </div>

        {/* Badges */}
        {badges && badges.definitions.length > 0 && (
          <div className="mt-3">
            <div className="mb-1 flex items-center justify-between text-[9px] font-bold uppercase tracking-[0.25em] text-white/60">
              <span>Badges</span>
              <span className="text-white/40">
                {badges.unlocks.length} / {badges.definitions.length}
              </span>
            </div>
            <div className="rounded-lg border border-white/10 bg-black/40 p-2">
              <PlayerCardBadgeWall
                definitions={badges.definitions}
                unlocks={badges.unlocks}
                accent={accent}
                compact
              />
            </div>
          </div>
        )}

        <div className="mt-3 text-center text-[8px] uppercase tracking-[0.3em] text-white/40">
          BodyFuel Performance • Tippen zum Umdrehen
        </div>
      </div>
    </div>
  );
}
