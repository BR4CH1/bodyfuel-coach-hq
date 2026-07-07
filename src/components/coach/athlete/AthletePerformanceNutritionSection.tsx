/**
 * Coach Read-Only View — Performance Ernährung (Bulls/Organisation).
 *
 * Renders ONLY data supplied by getCoachAthletePerformanceNutrition.
 * No local kcal/macro computation. No override, calibration or day-type controls.
 */
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Flame, AlertTriangle, Info, Activity } from "lucide-react";
import {
  getCoachAthletePerformanceNutrition,
  type CoachDayTypeBlock,
  type CoachDayTypeKey,
  type CoachAthletePerformanceNutrition,
} from "@/lib/performance-nutrition/coach-read.functions";

const DAY_TYPE_LABEL: Record<CoachDayTypeKey, string> = {
  rest: "Restday",
  strength: "Strength",
  football_training: "Football Training",
  game_day: "Game Day",
  double_session: "Double Session",
};

const GOAL_LABEL: Record<string, string> = {
  PERFORMANCE: "Performance",
  STRENGTH_GAIN: "Kraft steigern",
  MUSCLE_GAIN: "Muskelaufbau",
  SPEED_EXPLOSIVENESS: "Speed & Explosivität",
  FAT_LOSS: "Fettabbau",
  BODY_COMPOSITION_REVIEW: "Körperzusammensetzung (Review)",
};

const BASELINE_LABEL: Record<string, string> = {
  MOSTLY_SEATED: "Überwiegend sitzend",
  MIXED: "Gemischter Alltag",
  PHYSICALLY_ACTIVE: "Körperlich aktiv",
  VERY_PHYSICALLY_ACTIVE: "Sehr aktiv",
};

const CLUSTER_LABEL: Record<string, string> = {
  SPEED_SKILL: "Speed / Skill",
  HYBRID: "Hybrid",
  POWER_CONTACT: "Power / Contact",
  SPECIALIST: "Specialist",
};

const SEX_LABEL: Record<string, string> = {
  MALE: "Männlich",
  FEMALE: "Weiblich",
  UNSPECIFIED: "Nicht angegeben",
};

const FLAG_LABEL: Record<string, string> = {
  CARBOHYDRATE_PERFORMANCE_FLOOR_APPLIED: "Performance-Carb-Floor aktiv",
  YOUTH_BODY_COMPOSITION_REVIEW: "Youth Body Composition Review erforderlich",
  INSUFFICIENT_TRACKING_FOR_CALIBRATION: "Zu wenige Trackingdaten für Kalibrierung",
  YOUTH_CALIBRATION_REVIEW_REQUIRED: "Youth Kalibrierung muss geprüft werden",
  MISSING_ENERGY_CALCULATION_SEX: "Angabe für Energiebedarfsberechnung fehlt",
  MISSING_BIRTH_DATE: "Geburtsdatum fehlt",
  MISSING_HEIGHT: "Größe fehlt",
  MISSING_WEIGHT: "Gewicht fehlt",
  MISSING_PERFORMANCE_GOAL: "Performance-Ziel fehlt",
  MISSING_BASELINE_ACTIVITY: "Alltagsaktivität fehlt",
  HEIGHT_VALUE_REVIEW: "Größe außerhalb Plausibilitätsbereich",
  WEIGHT_VALUE_REVIEW: "Gewicht außerhalb Plausibilitätsbereich",
  AGE_VALUE_REVIEW: "Alter außerhalb Plausibilitätsbereich",
  COACH_OVERRIDE_ACTIVE: "Coach-Override aktiv",
  SESSION_INTENSITY_DEFAULT_APPLIED: "Session-Intensität: Standardwert",
};

// Presentational-only flags we hide from the coach flag list (already surfaced
// as "Fehlende Angaben" in the header).
const HIDDEN_FLAGS = new Set([
  "MISSING_BIRTH_DATE",
  "MISSING_HEIGHT",
  "MISSING_WEIGHT",
  "MISSING_ENERGY_CALCULATION_SEX",
  "MISSING_PERFORMANCE_GOAL",
  "MISSING_BASELINE_ACTIVITY",
]);

function fmtInt(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return Math.round(n).toLocaleString("de-DE");
}

function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("de-DE", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
}

const RED = "text-[#e11d2a]";
const RED_BG = "bg-[#e11d2a]";

export function AthletePerformanceNutritionSection({
  orgId,
  userId,
}: {
  orgId: string;
  userId: string;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const fetchFn = useServerFn(getCoachAthletePerformanceNutrition);
  const { data, isLoading, error } = useQuery({
    queryKey: ["coach-athlete-perf-nutrition", orgId, userId, today],
    queryFn: () =>
      fetchFn({ data: { organization_id: orgId, target_user_id: userId, date: today } }),
  });

  return (
    <section className="overflow-hidden rounded-2xl border border-white/10 bg-[#0b0b0d] text-white shadow-lg">
      <header className="flex items-center gap-2 border-b border-white/10 bg-black px-4 py-3">
        <span className={`inline-block h-2 w-2 rounded-full ${RED_BG}`} />
        <h2 className="text-[11px] font-bold uppercase tracking-[0.24em] text-white">
          Performance Ernährung
        </h2>
      </header>

      {isLoading ? (
        <div className="px-4 py-8 text-center text-xs uppercase tracking-widest text-white/50">
          Lade Performance-Daten…
        </div>
      ) : error ? (
        <div className="px-4 py-6 text-sm text-red-300">
          Fehler beim Laden: {(error as Error).message}
        </div>
      ) : !data ? (
        <div className="px-4 py-6 text-sm text-white/60">Keine Daten verfügbar.</div>
      ) : (
        <Body data={data} />
      )}
    </section>
  );
}

function Body({ data }: { data: CoachAthletePerformanceNutrition }) {
  const goalLabel = data.meta.performanceGoal
    ? GOAL_LABEL[data.meta.performanceGoal] ?? data.meta.performanceGoal
    : null;

  const incomplete = data.status !== "CALCULATED";

  return (
    <div className="space-y-5 p-4">
      {/* Aktuelles Performance-Ziel */}
      <div>
        <div className="text-[10px] font-bold uppercase tracking-[0.24em] text-white/50">
          Aktuelles Performance-Ziel
        </div>
        <div className={`mt-1 text-2xl font-black tracking-tight ${RED}`}>
          {goalLabel ?? "Nicht gesetzt"}
        </div>
      </div>

      {incomplete && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3">
          <div className="flex items-center gap-2 text-amber-300">
            <AlertTriangle className="h-4 w-4" />
            <span className="text-[11px] font-bold uppercase tracking-widest">
              Performance-Profil unvollständig
            </span>
          </div>
          {data.missing.length > 0 && (
            <ul className="mt-2 space-y-1 text-xs text-amber-100/90">
              <li className="text-amber-200/70">Fehlende Angaben:</li>
              {data.missing.map((m) => (
                <li key={m} className="pl-3">
                  • {m}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Aktives Ziel vs Engine-Vorschlag */}
      {!incomplete && (data.activeTarget || data.engineSuggestion) && (
        <div className="grid grid-cols-2 gap-2">
          <TargetTile
            label="Aktives Ziel"
            kcal={data.activeTarget?.kcal ?? null}
            accent
          />
          <TargetTile
            label="Engine-Vorschlag"
            kcal={data.engineSuggestion?.kcal ?? null}
          />
        </div>
      )}

      {/* Day-Type-Karten */}
      <div className="space-y-2">
        <div className="text-[10px] font-bold uppercase tracking-[0.24em] text-white/50">
          Tagesziele nach Day Type
        </div>
        <div className="grid grid-cols-1 gap-2">
          {data.perDayType.map((b) => (
            <DayTypeCard
              key={b.key}
              block={b}
              active={b.key === data.activeDayType}
            />
          ))}
        </div>
      </div>

      {/* Engine Status */}
      <EngineStatus data={data} />

      {/* Engine Hinweise */}
      <EngineFlags flags={data.flags} />
    </div>
  );
}

function TargetTile({
  label,
  kcal,
  accent,
}: {
  label: string;
  kcal: number | null;
  accent?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border p-3 ${
        accent
          ? "border-[#e11d2a]/40 bg-[#e11d2a]/10"
          : "border-white/10 bg-white/[0.03]"
      }`}
    >
      <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/50">
        {label}
      </div>
      <div className="mt-1 flex items-baseline gap-1">
        <span
          className={`text-2xl font-black tracking-tight ${
            accent ? RED : "text-white"
          }`}
        >
          {fmtInt(kcal)}
        </span>
        <span className="text-xs font-bold uppercase tracking-widest text-white/50">
          kcal
        </span>
      </div>
    </div>
  );
}

function DayTypeCard({ block, active }: { block: CoachDayTypeBlock; active: boolean }) {
  const label = DAY_TYPE_LABEL[block.key];
  const m = block.macros;
  return (
    <div
      className={`rounded-xl border p-3 ${
        active
          ? "border-[#e11d2a]/50 bg-[#e11d2a]/[0.08]"
          : "border-white/10 bg-white/[0.03]"
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Flame className={`h-4 w-4 ${active ? RED : "text-white/50"}`} />
          <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-white">
            {label}
          </span>
        </div>
        {active && (
          <span
            className={`rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest text-white ${RED_BG}`}
          >
            Heute
          </span>
        )}
      </div>

      {m ? (
        <>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="text-2xl font-black tracking-tight text-white">
              {fmtInt(m.kcal)}
            </span>
            <span className="text-xs font-bold uppercase tracking-widest text-white/50">
              kcal
            </span>
          </div>
          <div className="mt-2 grid grid-cols-3 gap-2">
            <MacroCell label="Protein" grams={m.protein_g} />
            <MacroCell label="Kohlenhydrate" grams={m.carbs_g} />
            <MacroCell label="Fett" grams={m.fat_g} />
          </div>
        </>
      ) : (
        <div className="mt-2 text-xs text-white/50">
          {block.status === "REVIEW_REQUIRED"
            ? "Review erforderlich — keine Berechnung möglich."
            : "Profil unvollständig — keine Berechnung."}
        </div>
      )}
    </div>
  );
}

function MacroCell({ label, grams }: { label: string; grams: number }) {
  return (
    <div className="rounded-lg border border-white/10 bg-black/40 px-2 py-1.5">
      <div className="text-[9px] font-bold uppercase tracking-widest text-white/40">
        {label}
      </div>
      <div className="mt-0.5 text-sm font-bold text-white">
        {fmtInt(grams)}
        <span className="ml-0.5 text-[10px] font-medium text-white/50">g</span>
      </div>
    </div>
  );
}

function EngineStatus({ data }: { data: CoachAthletePerformanceNutrition }) {
  const rows: Array<{ label: string; value: string }> = [
    { label: "Engine Version", value: `V${data.engineVersion}` },
    { label: "Letzte Berechnung", value: fmtDateTime(data.meta.lastCalculatedAt) },
    {
      label: "Alter bei Berechnung",
      value:
        data.meta.ageAtCalculation != null
          ? `${data.meta.ageAtCalculation} Jahre`
          : "—",
    },
    {
      label: "Youth Performance Mode",
      value: data.meta.isYouth ? "Aktiv" : "Nicht aktiv",
    },
    { label: "Position", value: data.meta.position ?? "—" },
    {
      label: "Positionscluster",
      value: data.meta.positionCluster
        ? CLUSTER_LABEL[data.meta.positionCluster] ?? data.meta.positionCluster
        : "—",
    },
    {
      label: "Baseline Activity",
      value: data.meta.baselineDailyActivity
        ? BASELINE_LABEL[data.meta.baselineDailyActivity] ?? data.meta.baselineDailyActivity
        : "—",
    },
    {
      label: "Sex (Energieberechnung)",
      value: data.meta.sexForEnergyCalculation
        ? SEX_LABEL[data.meta.sexForEnergyCalculation] ?? data.meta.sexForEnergyCalculation
        : "—",
    },
    {
      label: "Performance Goal",
      value: data.meta.performanceGoal
        ? GOAL_LABEL[data.meta.performanceGoal] ?? data.meta.performanceGoal
        : "—",
    },
    {
      label: "Persönliche Kalibrierung",
      value:
        data.meta.personalCalibrationKcal === 0
          ? "Keine Kalibrierung"
          : `${data.meta.personalCalibrationKcal > 0 ? "+" : ""}${data.meta.personalCalibrationKcal} kcal`,
    },
    {
      label: "Gewichtstrend",
      value:
        data.meta.weightTrendPercentPerWeek == null
          ? "Noch nicht genügend Daten"
          : `${data.meta.weightTrendPercentPerWeek > 0 ? "+" : ""}${data.meta.weightTrendPercentPerWeek.toFixed(2)} % / Woche`,
    },
  ];

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03]">
      <div className="flex items-center gap-2 border-b border-white/10 px-3 py-2">
        <Activity className={`h-3.5 w-3.5 ${RED}`} />
        <span className="text-[10px] font-bold uppercase tracking-[0.24em] text-white">
          Engine Status
        </span>
      </div>
      <dl className="divide-y divide-white/5">
        {rows.map((r) => (
          <div
            key={r.label}
            className="flex items-center justify-between gap-3 px-3 py-2"
          >
            <dt className="text-[11px] uppercase tracking-widest text-white/50">
              {r.label}
            </dt>
            <dd className="text-right text-xs font-semibold text-white">
              {r.value}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function EngineFlags({ flags }: { flags: string[] }) {
  const visible = flags.filter((f) => !HIDDEN_FLAGS.has(f));
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03]">
      <div className="flex items-center gap-2 border-b border-white/10 px-3 py-2">
        <Info className={`h-3.5 w-3.5 ${RED}`} />
        <span className="text-[10px] font-bold uppercase tracking-[0.24em] text-white">
          Engine Hinweise
        </span>
      </div>
      {visible.length === 0 ? (
        <div className="px-3 py-3 text-xs text-white/50">
          Keine offenen Engine-Hinweise
        </div>
      ) : (
        <ul className="divide-y divide-white/5">
          {visible.map((f) => (
            <li key={f} className="flex items-start gap-2 px-3 py-2">
              <span className={`mt-1 inline-block h-1.5 w-1.5 rounded-full ${RED_BG}`} />
              <span className="text-xs text-white/90">
                {FLAG_LABEL[f] ?? f}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
