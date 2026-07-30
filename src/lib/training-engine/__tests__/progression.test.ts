import { describe, expect, it } from "vitest";
import {
  incrementFor,
  parseRepRange,
  progressExerciseAfterSession,
  type LoggedSet,
} from "../progression";

function sets(
  rows: Array<[weight: number | null, reps: number | null, rpe?: number | null]>,
): LoggedSet[] {
  return rows.map(([weight_kg, reps, rpe], i) => ({
    set_number: i + 1,
    weight_kg,
    reps,
    rpe: rpe ?? null,
  }));
}

describe("parseRepRange", () => {
  it("liest normale Ranges", () => {
    expect(parseRepRange("8-12")).toEqual({ min: 8, max: 12 });
  });

  it("toleriert Gedankenstriche und Leerzeichen", () => {
    expect(parseRepRange(" 6 – 8 ")).toEqual({ min: 6, max: 8 });
  });

  it("behandelt Einzelwerte als min = max", () => {
    expect(parseRepRange("10")).toEqual({ min: 10, max: 10 });
  });

  it("fällt auf 8-12 zurück, wenn nichts lesbar ist", () => {
    expect(parseRepRange("")).toEqual({ min: 8, max: 12 });
    expect(parseRepRange("max")).toEqual({ min: 8, max: 12 });
  });
});

describe("incrementFor", () => {
  it("nutzt kleine Sprünge für Kurzhantel-Übungen", () => {
    expect(incrementFor("Kurzhantel Bankdrücken", 30)).toBe(2);
  });

  it("nutzt 2,5 kg für Isolationsübungen", () => {
    expect(incrementFor("Seitheben", 12)).toBe(2.5);
  });

  it("nutzt 5 kg für schwere Grundübungen ab 60 kg", () => {
    expect(incrementFor("Kniebeuge", 80)).toBe(5);
    expect(incrementFor("Kniebeuge", 40)).toBe(2.5);
  });
});

describe("progressExerciseAfterSession", () => {
  it("hält zurück, wenn zu wenig Working-Sets geloggt sind", () => {
    const d = progressExerciseAfterSession({
      exerciseName: "Bankdrücken",
      sets: sets([[60, 10]]),
      repRange: "8-12",
      targetSets: 3,
    });
    expect(d.action).toBe("hold_for_more_data");
    expect(d.next_load).toBeNull();
    expect(d.next_target_weights).toBeNull();
  });

  it("steigert die Last, wenn alle Sätze das Rep-Maximum erreichen", () => {
    const d = progressExerciseAfterSession({
      exerciseName: "Bankdrücken",
      sets: sets([
        [60, 12, 8],
        [60, 12, 8],
        [60, 12, 8],
      ]),
      repRange: "8-12",
      targetSets: 3,
    });
    expect(d.action).toBe("increase_load");
    expect(d.previous_load).toBe(60);
    expect(d.next_load).toBe(62.5);
    expect(d.next_target_weights).toBe("62.5,62.5,62.5");
  });

  it("hält die Last, wenn Reps erreicht sind, aber Ø-RPE zu hoch ist", () => {
    const d = progressExerciseAfterSession({
      exerciseName: "Bankdrücken",
      sets: sets([
        [60, 12, 9.5],
        [60, 12, 9.5],
        [60, 12, 10],
      ]),
      repRange: "8-12",
      targetSets: 3,
    });
    expect(d.action).toBe("keep_load");
    expect(d.next_load).toBe(60);
  });

  it("reduziert die Last bei starkem Satzabfall mit hohem RPE", () => {
    const d = progressExerciseAfterSession({
      exerciseName: "Bankdrücken",
      sets: sets([
        [100, 12, 9],
        [100, 8, 10],
        [100, 5, 10],
      ]),
      repRange: "8-12",
      targetSets: 3,
    });
    expect(d.action).toBe("reduce_load");
    expect(d.previous_load).toBe(100);
    expect(d.next_load).toBe(90);
    expect(d.next_target_weights).toBe("90,90,90");
  });

  it("reduziert Volumen, wenn ein Satz unter dem Rep-Minimum liegt", () => {
    const d = progressExerciseAfterSession({
      exerciseName: "Bankdrücken",
      sets: sets([
        [60, 10, 8],
        [60, 9, 8],
        [60, 7, 8],
      ]),
      repRange: "8-12",
      targetSets: 3,
    });
    expect(d.action).toBe("reduce_volume");
    expect(d.next_load).toBe(60);
  });

  it("hält die Last, wenn alles im Zielbereich liegt", () => {
    const d = progressExerciseAfterSession({
      exerciseName: "Bankdrücken",
      sets: sets([
        [60, 10],
        [60, 10],
        [60, 9],
      ]),
      repRange: "8-12",
      targetSets: 3,
    });
    expect(d.action).toBe("keep_load");
    expect(d.previous_load).toBe(60);
    expect(d.next_load).toBe(60);
  });

  it("erhöht bei Körpergewichtsübungen das Rep-Ziel statt der Last", () => {
    const d = progressExerciseAfterSession({
      exerciseName: "Klimmzüge",
      sets: sets([
        [null, 12],
        [null, 13],
        [null, 12],
      ]),
      repRange: "8-12",
      targetSets: 3,
    });
    expect(d.action).toBe("increase_reps_target");
    expect(d.next_target_reps).toBe("13");
    expect(d.next_load).toBeNull();
  });

  it("reduziert Volumen bei Körpergewichtsübungen unter dem Rep-Minimum", () => {
    const d = progressExerciseAfterSession({
      exerciseName: "Klimmzüge",
      sets: sets([
        [null, 8],
        [null, 6],
        [null, 5],
      ]),
      repRange: "8-12",
      targetSets: 3,
    });
    expect(d.action).toBe("reduce_volume");
    expect(d.next_target_weights).toBeNull();
  });

  it("wertet nur die geplante Anzahl Working-Sets aus", () => {
    const d = progressExerciseAfterSession({
      exerciseName: "Bankdrücken",
      sets: sets([
        [60, 12],
        [60, 12],
        [60, 4],
      ]),
      repRange: "8-12",
      targetSets: 2,
    });
    expect(d.action).toBe("increase_load");
    expect(d.next_target_weights).toBe("62.5,62.5");
  });
});
