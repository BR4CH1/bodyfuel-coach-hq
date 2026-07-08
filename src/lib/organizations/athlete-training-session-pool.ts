/**
 * Shared exercise pool for athlete training sessions.
 * Client- und server-safe (keine .server-Imports). Wird sowohl vom Coach-Preview
 * (Client) als auch vom Server-Generator konsumiert.
 */
import type { TrainingFocus } from "@/lib/training-focus-detection";
import { normalizePosition } from "@/lib/football-positions";

export type PoolExercise = {
  id: string;
  name: string;
  category: string;
  sets: number | null;
  reps: string | null;
  duration_sec: number | null;
  notes?: string | null;
};

function mk(
  focus: string,
  name: string,
  sets: number,
  reps: string,
  dur: number | null = null,
  notes?: string,
): PoolExercise {
  return {
    id: name.toLowerCase().replace(/[^a-z0-9]+/g, "_"),
    name,
    category: focus,
    sets,
    reps,
    duration_sec: dur,
    notes: notes ?? null,
  };
}

export function poolFor(
  focus: Exclude<TrainingFocus, "football" | "none">,
  positionCode: string | null,
): PoolExercise[] {
  const p = positionCode ?? "";
  const isOL = ["OL", "C", "G", "T", "LG", "RG", "LT", "RT", "OG", "OT"].includes(p);
  const isWR = ["WR", "SLOT", "SLOTWR"].includes(p);
  const isQB = p === "QB";
  const isRB = ["RB", "FB", "HB", "TB"].includes(p);
  const isDL = ["DL", "DE", "DT", "NT", "NG"].includes(p);
  const isLB = ["LB", "ILB", "OLB", "MLB", "WLB", "SLB", "ROLB", "LOLB"].includes(p);
  const isDB = ["DB", "CB", "NB", "S", "SS", "FS", "SAF", "NICKEL", "DIME"].includes(p);
  const m = (n: string, s: number, r: string, d: number | null = null, notes?: string) =>
    mk(focus, n, s, r, d, notes);

  switch (focus) {
    case "mobility": {
      const base = [m("World's Greatest Stretch", 2, "6/Seite"), m("Adductor Rock Back", 2, "8")];
      if (isQB) return [
        m("Thoracic Rotation (Quadruped)", 3, "8/Seite"),
        m("90/90 Hip Switch", 3, "8/Seite"),
        m("Wall Slides (Shoulder)", 3, "10"),
        m("Sleeper Stretch", 2, "30s", 30),
        ...base,
      ];
      if (isOL) return [
        m("Deep Squat Hold (Goblet)", 3, "45s", 45),
        m("Ankle Dorsiflexion Mobilisation", 3, "10/Seite"),
        m("90/90 Hip Switch", 3, "8/Seite"),
        m("Copenhagen Adductor Hold", 2, "20s", 20),
        ...base,
      ];
      if (isWR || isDB) return [
        m("Hamstring Sweep", 3, "6/Seite"),
        m("90/90 Hip Switch", 3, "8/Seite"),
        m("Ankle Dorsiflexion Mobilisation", 3, "10/Seite"),
        m("Piriformis Stretch", 2, "30s", 30),
        ...base,
      ];
      if (isRB || isLB || isDL) return [
        m("90/90 Hip Switch", 3, "8/Seite"),
        m("Thoracic Rotation (Quadruped)", 3, "8/Seite"),
        m("Ankle Dorsiflexion Mobilisation", 3, "10/Seite"),
        m("Cossack Squat", 2, "6/Seite"),
        ...base,
      ];
      return [
        m("90/90 Hip Switch", 3, "8/Seite"),
        m("Thoracic Rotation (Quadruped)", 3, "8/Seite"),
        m("Ankle Dorsiflexion Mobilisation", 3, "10/Seite"),
        ...base,
      ];
    }
    case "strength": {
      if (isOL || isDL) return [
        m("Trap Bar Deadlift", 4, "5"),
        m("Back Squat", 3, "5"),
        m("Bench Press", 3, "5"),
        m("Barbell Row", 3, "8"),
        m("Farmer Carry", 3, "30m"),
      ];
      if (isQB) return [
        m("Landmine Press", 4, "6/Seite"),
        m("Cable Anti-Rotation Press", 3, "10/Seite"),
        m("Front Squat", 3, "5"),
        m("Single-Leg RDL", 3, "8/Seite"),
        m("Half-Kneeling Med Ball Rotational Throw", 3, "5/Seite"),
      ];
      if (isWR || isDB) return [
        m("Trap Bar Deadlift", 4, "3"),
        m("Bulgarian Split Squat", 3, "6/Seite"),
        m("Nordic Hamstring Curl", 3, "6"),
        m("Pull-Up", 3, "AMRAP"),
        m("Med Ball Slam", 3, "8"),
      ];
      if (isRB || isLB) return [
        m("Back Squat", 4, "5"),
        m("Hip Thrust", 4, "6"),
        m("Weighted Chin-Up", 3, "6"),
        m("Landmine Rotational Press", 3, "8/Seite"),
        m("Suitcase Carry", 3, "30m"),
      ];
      return [
        m("Trap Bar Deadlift", 4, "5"),
        m("Bench Press", 3, "8"),
        m("Bulgarian Split Squat", 3, "8/Seite"),
        m("Pull-Up", 3, "AMRAP"),
      ];
    }
    case "speed": {
      const base = [
        m("A-Skips", 3, "20m", null, "Frequenz + Kontakt"),
        m("Wall Drill (Single Response)", 3, "5/Seite"),
      ];
      if (isWR || isDB || isRB) return [
        ...base,
        m("10m Sprint", 6, "10m", null, "Volle Erholung"),
        m("20m Flying Sprint", 4, "20m"),
        m("Resisted Sled Push (leicht)", 4, "15m"),
      ];
      if (isQB || isLB) return [
        ...base,
        m("10m Sprint", 5, "10m"),
        m("Broad Jump", 4, "3"),
        m("Med Ball Chest Pass Start", 4, "5"),
      ];
      return [...base, m("10m Sprint", 5, "10m"), m("Bounds", 3, "4/Seite")];
    }
    case "agility": {
      if (isWR || isDB || isRB || isLB) return [
        m("Pro Agility (5-10-5)", 6, "1x"),
        m("3-Cone L-Drill", 4, "1x"),
        m("Reactive Mirror Drill", 4, "10s", 10),
        m("Lateral Bound to Stick", 3, "5/Seite"),
      ];
      return [
        m("Pro Agility (5-10-5)", 5, "1x"),
        m("T-Drill", 4, "1x"),
        m("Lateral Shuffle", 3, "15m"),
      ];
    }
    case "conditioning": {
      if (isOL || isDL) return [
        m("Assault Bike Intervals", 6, "30s on / 60s off", 30),
        m("Sled Push", 6, "20m"),
      ];
      if (isWR || isDB || isRB || isLB) return [
        m("Gassers (2×53m)", 8, "1x"),
        m("Tempo Runs (100m ~70%)", 8, "100m"),
      ];
      return [
        m("Assault Bike Intervals", 6, "30s on / 60s off", 30),
        m("Tempo Runs (100m ~70%)", 6, "100m"),
      ];
    }
    case "recovery": {
      return [
        m("Zone 2 Bike / Walk", 1, "15 Min", 900),
        m("Foam Roll Ganzkörper", 1, "8 Min", 480),
        m("Diaphragmatic Breathing", 3, "2 Min", 120),
        m("Static Stretch (Hüfte, Brust, Waden)", 1, "8 Min", 480),
      ];
    }
  }
}

export function scaleToDuration(exercises: PoolExercise[], durationMin: number | null): PoolExercise[] {
  if (!durationMin || durationMin <= 0) return exercises;
  const perExercise = 3.5;
  const budget = Math.max(3, Math.floor(durationMin / perExercise));
  if (exercises.length <= budget) return exercises;
  return exercises.slice(0, budget);
}

export function previewAthleteSession(
  focus: Exclude<TrainingFocus, "football" | "none">,
  positionCode: string,
  durationMin: number = 45,
): PoolExercise[] {
  return scaleToDuration(poolFor(focus, normalizePosition(positionCode)), durationMin);
}
