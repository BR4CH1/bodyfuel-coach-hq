/**
 * Movement Framework — deterministische Slot-Vorlagen pro Trainings-Fokus.
 *
 * Jeder Fokus (Push/Pull/Legs/Upper/Lower/FullBody...) besteht aus einer
 * geordneten Liste von "Slots". Ein Slot beschreibt WELCHES Bewegungsmuster
 * (z. B. horizontal_push) mit welcher Priorität (compound zuerst) und
 * welchen Set-/Rep-Zielen an dieser Position der Session steht.
 *
 * Das LLM darf nur noch die konkrete Übungs-VARIANTE (Gerät + genauer Name)
 * für einen Slot vorschlagen — Struktur, Reihenfolge und Volumen sind fest.
 */

export type MovementPattern =
  | "horizontal_push"
  | "vertical_push"
  | "horizontal_pull"
  | "vertical_pull"
  | "squat"
  | "hinge"
  | "single_leg"
  | "hamstring_isolation"
  | "calf"
  | "chest_isolation"
  | "shoulder_isolation"
  | "back_isolation"
  | "biceps"
  | "triceps"
  | "core"
  | "carry_conditioning";

export type SlotTier = "compound" | "secondary" | "isolation" | "core";

export type MovementSlot = {
  slot_id: string;
  pattern: MovementPattern;
  tier: SlotTier;
  /** Ziel-Satzzahl in Woche 1 (Working Sets, ohne Warm-up). */
  sets: number;
  /** Ziel-Wiederholungsbereich, z. B. "6-8", "8-12", "12-15". */
  rep_range: string;
  /** Pause in Sekunden. */
  rest_seconds: number;
  /** Kurzer Hinweis für die LLM-Variantenauswahl. */
  hint: string;
};

export type SessionFocus =
  | "push"
  | "pull"
  | "legs"
  | "upper"
  | "lower"
  | "full_body"
  | "full_body_a"
  | "full_body_b"
  | "full_body_c";

export type Experience = "beginner" | "intermediate" | "advanced";

/** Kompakter Slot-Builder. */
const s = (
  slot_id: string,
  pattern: MovementPattern,
  tier: SlotTier,
  sets: number,
  rep_range: string,
  rest_seconds: number,
  hint: string,
): MovementSlot => ({ slot_id, pattern, tier, sets, rep_range, rest_seconds, hint });

/** Grundvorlagen — später um Erfahrungslevel skaliert. */
function baseSlots(focus: SessionFocus): MovementSlot[] {
  switch (focus) {
    case "push":
      return [
        s("push_main", "horizontal_push", "compound", 4, "6-8", 150, "Bankdrücken LH/KH oder Brustpresse Maschine"),
        s("push_vertical", "vertical_push", "compound", 3, "8-10", 120, "Schulterdrücken KH/Maschine/Multipresse"),
        s("push_chest_iso", "chest_isolation", "secondary", 3, "10-12", 90, "Butterfly/Kabel-Fly/Schrägbank-KH"),
        s("push_shoulder_iso", "shoulder_isolation", "isolation", 3, "12-15", 60, "Seitheben KH oder Kabel"),
        s("push_triceps", "triceps", "isolation", 3, "10-12", 75, "Trizepsdrücken Kabel / French Press"),
        s("push_core", "core", "core", 3, "10-15", 60, "Plank / Cable Crunch / Hollow Hold"),
      ];
    case "pull":
      return [
        s("pull_vertical", "vertical_pull", "compound", 4, "6-8", 150, "Klimmzug / Latzug breit oder eng"),
        s("pull_horizontal", "horizontal_pull", "compound", 3, "8-10", 120, "Rudern LH/KH/Kabel/Maschine"),
        s("pull_back_iso", "back_isolation", "secondary", 3, "10-12", 90, "Reverse Fly / Face Pull / Straight-Arm Pulldown"),
        s("pull_rear_delt", "shoulder_isolation", "isolation", 3, "12-15", 60, "Reverse Fly Maschine / Kabel"),
        s("pull_biceps", "biceps", "isolation", 3, "10-12", 75, "Bizeps-Curl KH/LH/Kabel"),
        s("pull_core", "core", "core", 3, "10-15", 60, "Hanging Leg Raise / Ab Wheel"),
      ];
    case "legs":
      return [
        s("legs_squat", "squat", "compound", 4, "6-8", 180, "Kniebeuge LH / Beinpresse / Hackenschmidt"),
        s("legs_hinge", "hinge", "compound", 3, "6-8", 150, "Rumänisches Kreuzheben LH/KH oder Hip Thrust"),
        s("legs_single_leg", "single_leg", "secondary", 3, "8-10", 120, "Bulgarian Split Squat KH / Ausfallschritt"),
        s("legs_hamstring", "hamstring_isolation", "isolation", 3, "10-12", 75, "Beinbeuger liegend/sitzend"),
        s("legs_calf", "calf", "isolation", 4, "12-15", 60, "Wadenheben stehend/sitzend"),
        s("legs_core", "core", "core", 3, "10-15", 60, "Pallof Press / Dead Bug / Plank"),
      ];
    case "upper":
      return [
        s("upper_hpush", "horizontal_push", "compound", 4, "6-8", 150, "Bankdrücken LH/KH/Maschine"),
        s("upper_vpull", "vertical_pull", "compound", 4, "8-10", 150, "Klimmzug / Latzug"),
        s("upper_vpush", "vertical_push", "secondary", 3, "8-10", 120, "Schulterdrücken"),
        s("upper_hpull", "horizontal_pull", "secondary", 3, "8-10", 120, "Rudern"),
        s("upper_arms1", "biceps", "isolation", 3, "10-12", 60, "Bizeps-Curl"),
        s("upper_arms2", "triceps", "isolation", 3, "10-12", 60, "Trizeps"),
        s("upper_core", "core", "core", 3, "10-15", 60, "Core"),
      ];
    case "lower":
      return [
        s("lower_squat", "squat", "compound", 4, "6-8", 180, "Kniebeuge LH/Beinpresse"),
        s("lower_hinge", "hinge", "compound", 3, "6-8", 150, "RDL / Hip Thrust"),
        s("lower_single", "single_leg", "secondary", 3, "8-10", 120, "Split Squat / Lunge"),
        s("lower_ham", "hamstring_isolation", "isolation", 3, "10-12", 75, "Beinbeuger"),
        s("lower_calf", "calf", "isolation", 4, "12-15", 60, "Wadenheben"),
        s("lower_core", "core", "core", 3, "10-15", 60, "Anti-Extension / Anti-Rotation"),
      ];
    case "full_body":
    case "full_body_a":
      return [
        s("fb_squat", "squat", "compound", 3, "6-8", 150, "Kniebeuge / Beinpresse"),
        s("fb_hpush", "horizontal_push", "compound", 3, "6-8", 150, "Bankdrücken / Brustpresse"),
        s("fb_vpull", "vertical_pull", "compound", 3, "8-10", 120, "Latzug / Klimmzug"),
        s("fb_single", "single_leg", "secondary", 3, "8-10", 90, "Ausfallschritt / Split Squat"),
        s("fb_shoulder", "shoulder_isolation", "isolation", 3, "12-15", 60, "Seitheben"),
        s("fb_core", "core", "core", 3, "10-15", 60, "Plank / Dead Bug"),
      ];
    case "full_body_b":
      return [
        s("fbb_hinge", "hinge", "compound", 3, "6-8", 150, "RDL / Kreuzheben"),
        s("fbb_vpush", "vertical_push", "compound", 3, "8-10", 120, "Schulterdrücken"),
        s("fbb_hpull", "horizontal_pull", "compound", 3, "8-10", 120, "Rudern"),
        s("fbb_calf", "calf", "isolation", 3, "12-15", 60, "Wadenheben"),
        s("fbb_arms", "biceps", "isolation", 3, "10-12", 60, "Bizeps"),
        s("fbb_core", "core", "core", 3, "10-15", 60, "Core"),
      ];
    case "full_body_c":
      return [
        s("fbc_squat", "squat", "compound", 3, "8-10", 120, "Beinpresse / Kniebeuge leicht"),
        s("fbc_hpush", "horizontal_push", "compound", 3, "8-10", 120, "Brustpresse"),
        s("fbc_vpull", "vertical_pull", "compound", 3, "8-10", 120, "Latzug"),
        s("fbc_ham", "hamstring_isolation", "isolation", 3, "10-12", 75, "Beinbeuger"),
        s("fbc_tri", "triceps", "isolation", 3, "10-12", 60, "Trizeps"),
        s("fbc_core", "core", "core", 3, "10-15", 60, "Core"),
      ];
  }
}

/** Skaliert Volumen leicht am Erfahrungslevel (Anfänger: 1 Slot weniger). */
export function slotsForFocus(focus: SessionFocus, experience: Experience): MovementSlot[] {
  const base = baseSlots(focus);
  if (experience === "beginner") {
    // Anfänger: alle Isolationen behalten, nur SEHR wenige Slots streichen (Kern-Volumen bleibt)
    return base.filter((sl) => sl.tier !== "isolation" || sl.pattern === "core" || base.indexOf(sl) < 5);
  }
  if (experience === "advanced") {
    // Fortgeschrittene: erste Compound bekommt +1 Satz
    return base.map((sl, i) => (i === 0 ? { ...sl, sets: sl.sets + 1 } : sl));
  }
  return base;
}

/** Menschlich lesbares Label für day.name / day.focus. */
export const focusLabel: Record<SessionFocus, string> = {
  push: "Push (Brust/Schulter/Trizeps)",
  pull: "Pull (Rücken/Bizeps)",
  legs: "Beine",
  upper: "Oberkörper",
  lower: "Unterkörper",
  full_body: "Ganzkörper",
  full_body_a: "Ganzkörper A",
  full_body_b: "Ganzkörper B",
  full_body_c: "Ganzkörper C",
};
