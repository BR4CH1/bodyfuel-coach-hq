/**
 * Wochenstruktur — deterministisch, Single Source of Truth für day_date/role/focus.
 *
 * Input: gewählte Gym-Trainingstage (Mo..So Keys), Sport-/Spieltage, Anzahl Wochen,
 *        Erfahrungslevel + Wochenstart-Datum.
 * Output: Für JEDE Woche eine 7-Tage-Liste (Mo→So), jeder Tag mit
 *   - day_date (ISO)
 *   - weekday key + label
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
  | "monday" | "tuesday" | "wednesday"
  | "thursday" | "friday" | "saturday" | "sunday";

export const WEEKDAY_ORDER: WeekdayKey[] = [
  "monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday",
];

export const weekdayShort: Record<WeekdayKey, string> = {
  monday: "Mo", tuesday: "Di", wednesday: "Mi", thursday: "Do",
  friday: "Fr", saturday: "Sa", sunday: "So",
};
export const weekdayLong: Record<WeekdayKey, string> = {
  monday: "Montag", tuesday: "Dienstag", wednesday: "Mittwoch",
  thursday: "Donnerstag", friday: "Freitag", saturday: "Samstag", sunday: "Sonntag",
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

function isoDay(base: Date, offsetDays: number): string {
  const d = new Date(base);
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
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
  const sport = new Set(opts.sportWeekdays);
  const rotation = focusRotation(opts.trainingWeekdays.length, opts.experience);

  const plans: WeekPlan[] = [];
  for (let w = 0; w < opts.weeks; w++) {
    const isDeload = opts.weeks >= 4 && w === opts.weeks - 1; // letzte Woche = Deload
    let gymIdx = 0;
    const days: PlannedDay[] = WEEKDAY_ORDER.map((wd, i) => {
      const dateStr = isoDay(opts.startDate, w * 7 + i);
      const isGym = training.has(wd);
      const isSport = sport.has(wd);

      // Vor-Tag Sport? → recovery statt rest
      const prevIdx = (i + 6) % 7;
      const prevWd = WEEKDAY_ORDER[prevIdx];
      const wasSportYesterday = i > 0 && sport.has(prevWd);

      let role: DayRole = "rest";
      let focus: SessionFocus | null = null;
      let slots: MovementSlot[] = [];

      if (isGym && isSport) {
        role = "gym_light";
        focus = "upper"; // an Sport-/Spieltag nur Oberkörper-Zusatz
        slots = slotsForFocus(focus, opts.experience)
          // an gym_light-Tagen keine schweren Compounds
          .filter((s) => s.tier !== "compound" || s.pattern.includes("push") || s.pattern.includes("pull"))
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
        focus_label: focus ? focusLabel[focus] : role === "sport"
          ? "Sport / Mannschaftstraining"
          : role === "recovery" ? "Recovery / Mobility" : "Ruhetag",
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
