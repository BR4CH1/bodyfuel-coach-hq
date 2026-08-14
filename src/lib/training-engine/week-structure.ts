/**
 * Wochenstruktur — deterministisch, Single Source of Truth für day_date/role/focus.
 *
 * Input: gewählte Gym-Trainingstage (Mo..So Keys), Sport-/Spieltage, Anzahl Wochen,
 *        Erfahrungslevel + Planstart-Datum.
 * Output: Für JEDE 7-Tage-Planwoche ab dem Startdatum eine Liste, jeder Tag mit
 *   - day_date (ISO)
 *   - dem tatsächlichen Wochentag dieses Datums
 *   - role: "gym" | "sport" | "recovery" | "rest" | "gym_light"
 *   - focus: SessionFocus | null
 *   - slots: MovementSlot[] (nur für gym/gym_light)
 *
 * Die Fokus-Rotation ist fest (Push/Pull/Legs; Upper/Lower; PPL x2 …).
 * Wenn Gym-Tag und Sport-Tag auf denselben Wochentag fallen: role="gym_light"
 * (nur Oberkörper-Zusatz + Mobility, KEINE schweren Beine/CNS).
 * Rest-Day direkt NACH Sport-/Spieltag: role="recovery".
 */

import {
  slotsForFocus,
  type Experience,
  type MovementSlot,
  type SessionFocus,
  focusLabel,
} from "./movement-framework";

export type WeekdayKey =
  | "monday"
  | "tuesday"
  | "wednesday"
  | "thursday"
  | "friday"
  | "saturday"
  | "sunday";

export const WEEKDAY_ORDER: WeekdayKey[] = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
];

const JS_DAY_TO_WEEKDAY: WeekdayKey[] = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
];

export const weekdayShort: Record<WeekdayKey, string> = {
  monday: "Mo",
  tuesday: "Di",
  wednesday: "Mi",
  thursday: "Do",
  friday: "Fr",
  saturday: "Sa",
  sunday: "So",
};
export const weekdayLong: Record<WeekdayKey, string> = {
  monday: "Montag",
  tuesday: "Dienstag",
  wednesday: "Mittwoch",
  thursday: "Donnerstag",
  friday: "Freitag",
  saturday: "Samstag",
  sunday: "Sonntag",
};

export type DayRole = "gym" | "gym_light" | "sport" | "recovery" | "rest";

export type PlannedDay = {
  weekday: WeekdayKey;
  weekday_short: string;
  weekday_long: string;
  day_date: string; // ISO YYYY-MM-DD
  role: DayRole;
  focus: SessionFocus | null;
  focus_label: string;
  slots: MovementSlot[]; // leer wenn role != gym/gym_light
};

export type WeekPlan = {
  week_number: number;
  is_deload: boolean;
  days: PlannedDay[];
};

/** Fokus-Rotation je nach Anzahl Gym-Tage & Erfahrung. */
function focusRotation(numGymDays: number, experience: Experience): SessionFocus[] {
  if (numGymDays <= 2) return ["full_body_a", "full_body_b"];
  if (numGymDays === 3) {
    if (experience === "beginner") return ["full_body_a", "full_body_b", "full_body_c"];
    return ["push", "pull", "legs"];
  }
  if (numGymDays === 4) return ["upper", "lower", "upper", "lower"];
  if (numGymDays === 5) return ["push", "pull", "legs", "upper", "lower"];
  return ["push", "pull", "legs", "push", "pull", "legs"]; // 6
}

/**
 * Reiner Kalendertag ohne UTC-Verschiebung: der vom Caller gemeinte lokale
 * Starttag bleibt derselbe, auch wenn der Prozess nicht in UTC läuft.
 */
function isoDay(base: Date, offsetDays: number): string {
  const d = new Date(base);
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() + offsetDays);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function weekdayForIsoDate(iso: string): WeekdayKey {
  const jsDay = new Date(`${iso}T00:00:00Z`).getUTCDay();
  return JS_DAY_TO_WEEKDAY[jsDay];
}

export type BuildWeekPlanOpts = {
  startDate: Date;
  weeks: number;
  trainingWeekdays: WeekdayKey[];
  sportWeekdays: WeekdayKey[];
  experience: Experience;
};

export function buildWeekPlan(opts: BuildWeekPlanOpts): WeekPlan[] {
  const training = new Set(opts.trainingWeekdays);
  let sport = new Set(opts.sportWeekdays);
  // Datenschutz gegen Onboarding-Fehler: wenn ALLE Gym-Tage zusätzlich als
  // Sport-Tage markiert sind (training ⊆ sport), ist die Sport-Angabe
  // vermutlich versehentlich mit derselben Auswahl gefüllt worden. Sonst würde
  // die `isGym && isSport`-Regel unten die Rotation komplett aushebeln und
  // jeden einzelnen Tag als „Oberkörper"-Add-on labeln (Bug: Marcel Guss).
  // In diesem Fall Sport-Overlap an Gym-Tagen auflösen, damit Push/Pull/Legs/
  // Upper/Lower wieder rotiert.
  if (training.size > 0) {
    const overlap = [...training].filter((d) => sport.has(d));
    if (overlap.length === training.size) {
      sport = new Set([...sport].filter((d) => !training.has(d)));
    }
  }
  const rotation = focusRotation(training.size, opts.experience);

  const plans: WeekPlan[] = [];
  for (let w = 0; w < opts.weeks; w++) {
    const isDeload = opts.weeks >= 4 && w === opts.weeks - 1; // letzte Woche = Deload
    let gymIdx = 0;
    const days: PlannedDay[] = Array.from({ length: 7 }, (_, i) => {
      const offset = w * 7 + i;
      const dateStr = isoDay(opts.startDate, offset);
      // Entscheidend: Der Wochentag wird aus dem tatsächlichen Kalendertag
      // abgeleitet. Früher wurde hier blind Mo→So verwendet, obwohl startDate
      // z. B. ein Dienstag sein konnte; dadurch war der ganze Plan um 1 Tag verschoben.
      const wd = weekdayForIsoDate(dateStr);
      const isGym = training.has(wd);
      const isSport = sport.has(wd);

      const prevDate = isoDay(opts.startDate, offset - 1);
      const prevWd = weekdayForIsoDate(prevDate);
      const wasSportYesterday = offset > 0 && sport.has(prevWd);

      let role: DayRole = "rest";
      let focus: SessionFocus | null = null;
      let slots: MovementSlot[] = [];

      if (isGym && isSport) {
        role = "gym_light";
        focus = "upper"; // an Sport-/Spieltag nur Oberkörper-Zusatz
        slots = slotsForFocus(focus, opts.experience)
          // an gym_light-Tagen keine schweren Compounds
          .filter(
            (s) =>
              s.tier !== "compound" || s.pattern.includes("push") || s.pattern.includes("pull"),
          )
          .map((s) => ({ ...s, sets: Math.max(2, s.sets - 1) }));
      } else if (isGym) {
        role = "gym";
        focus = rotation[gymIdx % rotation.length];
        gymIdx++;
        slots = slotsForFocus(focus, opts.experience);
        if (isDeload) {
          slots = slots.map((s) => ({ ...s, sets: Math.max(2, s.sets - 1) }));
        }
      } else if (isSport) {
        role = "sport";
      } else if (wasSportYesterday) {
        role = "recovery";
      } else {
        role = "rest";
      }

      return {
        weekday: wd,
        weekday_short: weekdayShort[wd],
        weekday_long: weekdayLong[wd],
        day_date: dateStr,
        role,
        focus,
        focus_label: focus
          ? focusLabel[focus]
          : role === "sport"
            ? "Sport / Mannschaftstraining"
            : role === "recovery"
              ? "Recovery / Mobility"
              : "Ruhetag",
        slots,
      };
    });

    plans.push({ week_number: w + 1, is_deload: isDeload, days });
  }
  return plans;
}

/** Serialisiert die Wochen-Struktur kompakt für den LLM-Prompt. */
export function renderWeekPlanForPrompt(plans: WeekPlan[]): string {
  const lines: string[] = [];
  for (const wp of plans) {
    lines.push(`### Woche ${wp.week_number}${wp.is_deload ? " (DELOAD)" : ""}`);
    for (const d of wp.days) {
      const header = `- ${d.weekday_short} ${d.day_date} · ${d.role.toUpperCase()} · ${d.focus_label}`;
      if (d.slots.length === 0) {
        lines.push(header);
        continue;
      }
      lines.push(header);
      for (const sl of d.slots) {
        lines.push(
          `   • [${sl.slot_id}] ${sl.pattern} · ${sl.tier} · ${sl.sets}×${sl.rep_range} · Pause ${sl.rest_seconds}s · Hinweis: ${sl.hint}`,
        );
      }
    }
  }
  return lines.join("\n");
}
