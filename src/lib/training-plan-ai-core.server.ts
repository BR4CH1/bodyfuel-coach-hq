/**
 * Shared core for AI Smart-Trainingsplan generation.
 * Used by both the user-facing server function (with the user's
 * supabase client) and the cron route (with supabaseAdmin).
 * File ends in `.server.ts` so it is stripped from client bundles.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

type ExerciseCategory =
  | "barbell" | "dumbbell" | "machine" | "cardio"
  | "core" | "bodyweight" | "cable";

type GenEx = {
  name: string;
  category?: ExerciseCategory;
  target_sets?: number;
  target_reps?: string;
  target_weights?: string | null;
  rest_seconds?: number | null;
  notes?: string | null;
};
type GenDay = { name: string; focus?: string; exercises: GenEx[] };
type GenWeek = { week_number: number; focus?: string; days: GenDay[] };

export type GenerateOpts = {
  target: string;
  uploadedBy?: string | null;
  title?: string;
  startMode?: "today" | "next_week";
  apiKey: string;
};

export async function generateTrainingPlanCore(
  supabase: SupabaseClient,
  opts: GenerateOpts,
) {
  const { target, uploadedBy = null, title, startMode = "today", apiKey } = opts;

  const since60 = new Date(Date.now() - 60 * 86400000).toISOString();
  const sinceDate60 = since60.slice(0, 10);

  const [
    { data: smartProfile },
    { data: clientProfile },
    { data: latestWeight },
    { data: lastCheck },
    { data: priorPlans },
    { data: targets },
    { data: recentSets },
    { data: recentChecks },
    { data: weightHistory },
  ] = await Promise.all([
    supabase.from("smart_nutrition_profile")
      .select("training_weekdays, training_session_minutes")
      .eq("user_id", target).maybeSingle(),
    supabase.from("profiles")
      .select(
        "display_name, height_cm, birthdate, gender, training_goal, coaching_goal, " +
        "sport, injuries, training_experience, activity_level, goal_weight_kg, " +
        "sport_position, sport_level, team_sport, match_days_per_week, practice_days_per_week, " +
        "sport_weekdays, season_phase, class_types, class_days_per_week, mobility_frequency, mobility_focus, cardio_outside_gym",
      )
      .eq("id", target).maybeSingle(),
    supabase.from("body_measurements")
      .select("weight_kg, body_fat_pct, measured_at")
      .eq("user_id", target).not("weight_kg", "is", null)
      .order("measured_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("strength_checks")
      .select("id, performed_at, bodyweight_kg, score_total, score_lower, score_push, score_pull, score_core")
      .eq("user_id", target).eq("status", "completed")
      .order("performed_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("nutrition_plans")
      .select("id, training_days(week_number, training_exercises(name))")
      .eq("client_id", target).eq("plan_type", "training")
      .order("created_at", { ascending: false }).limit(3),
    supabase.from("nutrition_targets")
      .select("kcal, protein_g, carbs_g, fat_g, kcal_rest, protein_g_rest, carbs_g_rest, fat_g_rest")
      .eq("user_id", target).maybeSingle(),
    supabase.from("training_set_logs")
      .select("exercise_id, weight_kg, reps, performed_at")
      .eq("client_id", target)
      .gte("performed_at", since60)
      .order("performed_at", { ascending: false }).limit(400),
    supabase.from("daily_checks")
      .select("check_date, points, tasks")
      .eq("user_id", target)
      .gte("check_date", sinceDate60)
      .order("check_date", { ascending: false }).limit(60),
    supabase.from("body_measurements")
      .select("weight_kg, measured_at")
      .eq("user_id", target).not("weight_kg", "is", null)
      .gte("measured_at", since60)
      .order("measured_at", { ascending: true }),
  ]);

  const checkResults =
    lastCheck?.id
      ? (await supabase.from("strength_check_results")
          .select("test_key, weight_kg, reps, duration_seconds, e1rm_kg")
          .eq("check_id", lastCheck.id)).data ?? []
      : [];

  const e1rm: Record<string, number | null> = {
    leg_press: null, leg_curl: null, chest_press: null,
    shoulder_press: null, lat_pulldown: null, cable_row: null,
  };
  let plankSeconds: number | null = null;
  for (const r of checkResults as any[]) {
    if (r.test_key === "plank") plankSeconds = r.duration_seconds ?? null;
    else if (r.test_key in e1rm) e1rm[r.test_key] = r.e1rm_kg ? Number(r.e1rm_kg) : null;
  }

  const bw = (lastCheck as any)?.bodyweight_kg ?? (latestWeight as any)?.weight_kg ?? null;
  const bfPct = (latestWeight as any)?.body_fat_pct ?? null;

  const w8 = (v: number | null) => (v ? Math.round((v * 0.75) / 2.5) * 2.5 : null);
  const startWeights = {
    bench_press_kg: w8(e1rm.chest_press),
    shoulder_press_kg: w8(e1rm.shoulder_press),
    squat_kg: e1rm.leg_press ? Math.round((e1rm.leg_press * 0.35) / 2.5) * 2.5 : null,
    deadlift_kg: e1rm.leg_press ? Math.round((e1rm.leg_press * 0.45) / 2.5) * 2.5 : null,
    lat_pulldown_kg: w8(e1rm.lat_pulldown),
    row_kg: w8(e1rm.cable_row),
    leg_press_kg: w8(e1rm.leg_press),
    leg_curl_kg: w8(e1rm.leg_curl),
  };

  const trainingDayKeys: string[] =
    (smartProfile as any)?.training_weekdays?.length
      ? (smartProfile as any).training_weekdays
      : ["monday", "wednesday", "friday"];
  const numDays = Math.max(2, Math.min(6, trainingDayKeys.length));

  const start = (() => {
    const d = new Date();
    if (startMode === "next_week") {
      const day = d.getDay();
      const delta = day === 1 ? 7 : ((1 - day + 7) % 7) || 7;
      d.setDate(d.getDate() + delta);
    }
    d.setHours(0, 0, 0, 0);
    return d;
  })();
  const totalWeeks = 4;
  const planSpan = totalWeeks * 7;

  const priorNames = new Set<string>();
  for (const p of (priorPlans as any[]) ?? []) {
    for (const d of p?.training_days ?? []) {
      for (const ex of d?.training_exercises ?? []) {
        if (ex?.name) priorNames.add(String(ex.name).trim());
      }
    }
  }
  const priorList = Array.from(priorNames).slice(0, 120);

  // Equipment usage stats from recent sets (last 60 days) → tells the AI
  // which variant (Maschine / Multipresse / Kurzhantel / Langhantel / Kabel)
  // the client actually uses, so it picks matching variants for new plans.
  const exNameById = new Map<string, string>();
  for (const p of (priorPlans as any[]) ?? []) {
    for (const d of p?.training_days ?? []) {
      for (const ex of d?.training_exercises ?? []) {
        if (ex?.id && ex?.name) exNameById.set(String(ex.id), String(ex.name));
      }
    }
  }
  const equipCounts: Record<string, number> = {
    maschine: 0, multipresse: 0, kurzhantel: 0, langhantel: 0, kabel: 0, bodyweight: 0,
  };
  for (const s of (recentSets as any[]) ?? []) {
    const nm = exNameById.get(String(s.exercise_id))?.toLowerCase() ?? "";
    if (!nm) continue;
    if (/maschine|machine/.test(nm)) equipCounts.maschine++;
    else if (/multi|smith/.test(nm)) equipCounts.multipresse++;
    else if (/kurzhantel|dumbbell|\bkh\b|\bdb\b/.test(nm)) equipCounts.kurzhantel++;
    else if (/langhantel|barbell|\blh\b/.test(nm)) equipCounts.langhantel++;
    else if (/kabel|seilzug|cable/.test(nm)) equipCounts.kabel++;
    else equipCounts.bodyweight++;
  }
  const equipBlock = `\n🛠️ GERÄTE-PRÄFERENZ (aus den letzten 60 Tagen)
- Maschine: ${equipCounts.maschine} · Multipresse: ${equipCounts.multipresse} · Kurzhantel: ${equipCounts.kurzhantel} · Langhantel: ${equipCounts.langhantel} · Kabel: ${equipCounts.kabel}
→ Wähle die Geräte-VARIANTE jeder Übung entsprechend dieser Daten:
   • Schulterdrücken: Maschine / Multipresse / Kurzhantel
   • Bankdrücken: Langhantel / Kurzhantel / Maschine
   • Rudern: Langhantel / Kurzhantel / Kabel / Maschine
   • Curls: Langhantel / Kurzhantel / Kabel
   • Seitheben: Kurzhantel / Kabel / Maschine
   • Beinpresse / Beinbeuger / Beinstrecker: Maschine
- Falls der Kunde diese Übung schon gemacht hat, BEHALTE die gleiche Variante (für PR-Kontinuität).
- Anfänger ohne Daten → bevorzugt Maschine / Multipresse (sicherer). Fortgeschrittene → Lang-/Kurzhantel.
- Bei Verletzungen Schulter/Rücken → keine schweren Lang­hantel-Varianten über Kopf bzw. ohne Stütze.`;

  const sessionDates = new Set<string>();
  for (const s of (recentSets as any[]) ?? []) {
    sessionDates.add(String(s.performed_at).slice(0, 10));
  }
  const sessionsLast30 = (() => {
    const cutoff = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
    let n = 0;
    sessionDates.forEach((d) => { if (d >= cutoff) n++; });
    return n;
  })();
  const checksLast30 = ((recentChecks as any[]) ?? []).slice(0, 30).length;
  const perfectDays30 = ((recentChecks as any[]) ?? []).filter((c) => (c.points ?? 0) >= 15).length;

  let weightTrendKg: number | null = null;
  if ((weightHistory as any[])?.length && (weightHistory as any[]).length >= 2) {
    const arr = weightHistory as any[];
    weightTrendKg = +(Number(arr[arr.length - 1].weight_kg) - Number(arr[0].weight_kg)).toFixed(1);
  }

  const cp: any = clientProfile ?? {};
  const ageYears = cp.birthdate
    ? Math.floor((Date.now() - new Date(cp.birthdate).getTime()) / (365.25 * 86400000))
    : null;
  const sessionMinutes = (smartProfile as any)?.training_session_minutes ?? 60;
  const trainingGoal: string = cp.training_goal ?? "performance";
  const experience: string = cp.training_experience ?? (sessionsLast30 >= 8 ? "intermediate" : "beginner");

  const goalLabel: Record<string, string> = {
    muscle_gain: "Muskelaufbau", lean_bulk: "lean bulk / Muskelaufbau",
    bulk: "Massephase", weight_loss: "Fettabbau", fat_loss: "Fettabbau",
    aggressive_cut: "aggressiver Cut (Muskel halten)",
    recomp: "Recomposition", recomposition: "Recomposition",
    maintain: "Halten", maintenance: "Halten",
    strength: "Maximalkraft", performance: "Leistung / Athletik",
    health: "Gesundheit & Beweglichkeit",
  };

  const splitHint = (() => {
    if (experience === "beginner")
      return numDays <= 2 ? "Ganzkörper A / B"
        : numDays === 3 ? "Ganzkörper A / B / C"
        : "Oberkörper / Unterkörper-Splits (Anfängergerecht)";
    if (experience === "advanced")
      return numDays === 3 ? "Push / Pull / Beine (klassisch)"
        : numDays === 4 ? "Oberkörper / Unterkörper / Push / Pull"
        : numDays === 5 ? "Push / Pull / Beine / Oberkörper-Schwächen / Unterkörper-Schwächen"
        : numDays === 6 ? "Push A / Pull A / Beine A / Push B / Pull B / Beine B"
        : "Ganzkörper x2";
    return numDays === 3 ? "Push / Pull / Beine"
      : numDays === 4 ? "Oberkörper / Unterkörper x 2"
      : numDays === 5 ? "Push / Pull / Beine / Oberkörper / Unterkörper"
      : numDays >= 6 ? "PPL x 2"
      : "Oberkörper / Unterkörper";
  })();

  const sportLevelLabel: Record<string, string> = {
    recreational: "Hobby", amateur: "Amateur", semi_pro: "Semi-Pro",
    pro: "Profi", coach: "Trainer/Kursleiter",
  };
  const seasonLabel: Record<string, string> = {
    off_season: "Off-Season", pre_season: "Vorbereitung",
    in_season: "Saison (Wettkampfphase)", post_season: "Nachsaison",
  };
  const mobLabel: Record<string, string> = {
    none: "keine", "1_2x": "1–2× Woche", "3_4x": "3–4× Woche", daily: "täglich",
  };
  const weekdayLabel: Record<string, string> = {
    monday: "Mo", tuesday: "Di", wednesday: "Mi", thursday: "Do",
    friday: "Fr", saturday: "Sa", sunday: "So",
  };
  const sportDaysList: string[] = Array.isArray(cp.sport_weekdays) ? cp.sport_weekdays : [];
  const sportDaysHuman = sportDaysList.map((d) => weekdayLabel[d] ?? d).join(", ");
  const trainDaysHuman = trainingDayKeys.map((d) => weekdayLabel[d] ?? d).join(", ");
  const overlapDays = sportDaysList.filter((d) => trainingDayKeys.includes(d))
    .map((d) => weekdayLabel[d] ?? d);

  const allWeekdayOrder = ["monday","tuesday","wednesday","thursday","friday","saturday","sunday"];
  const dayMap = trainingDayKeys
    .map((k, i) => `Tag ${i + 1} = ${weekdayLabel[k] ?? k}`)
    .join(", ");
  const weekPlanMap = allWeekdayOrder.map((k) => {
    const isGym = trainingDayKeys.includes(k);
    const isSport = sportDaysList.includes(k);
    let kind = "Rest";
    if (isGym && isSport) kind = "Gym + Sport (Überlappung)";
    else if (isGym) kind = "Gym";
    else if (isSport) kind = "Sport/Mannschaftstraining/Spieltag";
    return `${weekdayLabel[k]}: ${kind}`;
  }).join(" | ");
  // Sportart-spezifische Beispiele NUR einfügen, wenn die Person diesen Sport tatsächlich macht.
  // Verhindert z.B. American-Football-Übungen für Kunden ohne Football-Profil.
  const sportLower = (cp.sport ?? "").toLowerCase();
  const positionLower = (cp.sport_position ?? "").toLowerCase();
  const sportExamples: string[] = [];
  if (/football|nfl|american/.test(sportLower)) {
    if (/qb|quarterback/.test(positionLower)) {
      sportExamples.push(`• American Football Quarterback (QB): "QB Cuban Press Kurzhantel — Wurfschulter" (3×12, Notiz: "KH neben Körper, Ellbogen 90°, außen rotieren, dann über Kopf drücken"), "QB Rotations-Wurf Medizinball gegen Wand" (3×8/Seite), "Pallof Press Kabel — Anti-Rotation" (3×10/Seite), "Landmine Press einarmig" (3×8/Seite).`);
    } else if (/lineman|line|ol|dl/.test(positionLower)) {
      sportExamples.push(`• Football Lineman: "Prowler/Schlitten schieben" (5×15 m), "Zercher Squat" (4×6, Notiz: "LH in Armbeuge, aufrecht hocken").`);
    } else if (/wr|rb|receiver|running/.test(positionLower)) {
      sportExamples.push(`• Football WR/RB: "Single-Leg RDL Kurzhantel" (3×8/Seite), "Box Jumps" (4×4).`);
    } else {
      sportExamples.push(`• American Football allgemein: Explosivität, Sprintkraft & Wurfschulter — z.B. "Box Jumps" (4×4), "Landmine Press einarmig" (3×8/Seite), "Pallof Press" (3×10/Seite).`);
    }
  }
  if (/fußball|fussball|soccer/.test(sportLower)) {
    sportExamples.push(`• Fußball: "Bulgarian Split Squat KH" (3×8/Seite), "Nordic Hamstring Curl" (3×6), "Copenhagen Plank — Adduktoren" (3×30s/Seite).`);
  }
  if (/basket|volley/.test(sportLower)) {
    sportExamples.push(`• Basketball/Volleyball: "Depth Jump 30-cm-Kasten + Sprung" (4×4), "Wadenheben einbeinig" (3×12/Seite).`);
  }
  if (/kampf|bjj|mma|box|judo|karate|ringen|wrestling/.test(sportLower)) {
    sportExamples.push(`• Kampfsport/BJJ: "Turkish Get-Up KH" (3×3/Seite), "Farmer's Walk KH" (3×30 m).`);
  }
  if (/lauf|run|marathon|triath/.test(sportLower)) {
    sportExamples.push(`• Laufsport: "Single-Leg RDL" (3×8/Seite), "Wadenheben" (3×15), "Hip Thrust" (3×10).`);
  }
  if (/rad|cycl|bike/.test(sportLower)) {
    sportExamples.push(`• Radsport: "Bulgarian Split Squat" (3×8/Seite), "Glute Bridge" (3×12), "Plank-Varianten" (3×45s).`);
  }
  const sportSpecificBlock = sportExamples.length
    ? `\n- POSITIONS-/SPORTART-SPEZIFISCHE PFLICHTÜBUNGEN — füge an MIND. 2 Gym-Tagen pro Woche eine als sportartspezifisch erkennbare Übung ein. Benenne sie eindeutig und schreibe im notes-Feld eine 1-Satz-Ausführungsanleitung. Erlaubte Beispiele NUR aus der Sportart "${cp.sport}":\n   ${sportExamples.join("\n   ")}`
    : `\n- ⛔ KEIN AUSGEÜBTER SPORT/KEINE PASSENDE SPORTART-VORLAGE: Verwende AUSSCHLIESSLICH allgemeine Hypertrophie-/Kraft-/Mobility-Übungen. KEINE sportartspezifischen Übungen einbauen — insbesondere KEINE Football-/QB-/Lineman-/Wurfschulter-/Pallof-Wurf-Übungen, KEINE Fußball-/Soccer-spezifischen Übungen, KEINE Kampfsport-spezifischen Übungen. Im Übungsnamen darf keine Sportart auftauchen.`;

  const sportBlock = cp.sport || cp.class_types?.length || cp.team_sport
    ? `\n🏈 SPORT-/ATHLETEN-PROFIL${cp.sport ? `\n- Sportart: ${cp.sport}${cp.sport_position ? ` (Position: ${cp.sport_position})` : ""}` : ""}${cp.sport_level ? `\n- Niveau: ${sportLevelLabel[cp.sport_level] ?? cp.sport_level}` : ""}${cp.team_sport ? `\n- Mannschaftssport: ja${cp.match_days_per_week != null ? ` · ${cp.match_days_per_week} Spieltag(e)/Wo` : ""}${cp.practice_days_per_week != null ? ` · ${cp.practice_days_per_week} Mannschafts-Training(s)/Wo` : ""}` : ""}${cp.season_phase ? `\n- Saisonphase: ${seasonLabel[cp.season_phase] ?? cp.season_phase}` : ""}${cp.class_types?.length ? `\n- Kurse: ${cp.class_types.join(", ")}${cp.class_days_per_week != null ? ` (${cp.class_days_per_week}× Wo)` : ""}` : ""}${cp.cardio_outside_gym ? `\n- Cardio außerhalb des Studios: ${cp.cardio_outside_gym}` : ""}
${sportDaysHuman ? `- Sport-/Kurs-/Spieltage: ${sportDaysHuman}` : ""}
- Gym-Trainingstage: ${trainDaysHuman} (${dayMap})
- WOCHENÜBERSICHT (Pflicht — JEDER der 7 Wochentage MUSS als eigener day-Eintrag erscheinen, in dieser Reihenfolge Mo→So, mit Wochentag VORN in day.name, z. B. "Mo — Push" oder "Di — Mannschaftstraining" oder "So — Rest/Recovery"): ${weekPlanMap}
- SPORT-/MANNSCHAFTSTRAININGS-/SPIELTAGE: KEINE Kraftübungen einfügen! Stattdessen 1 Eintrag "Mannschaftstraining" bzw. "Spieltag" (category "cardio", target_sets 1, target_reps "60–90 Min", Notiz zur erwarteten Belastung) + 2–3 kurze Mobility-/Aktivierungsübungen (vor) oder Cool-down-Mobility (nach, 5–10 Min). Keine Kniebeugen, kein Bankdrücken, kein Kreuzheben an diesen Tagen.
- RESTDAYS NACH einem Sport-/Spieltag: REGENERATIONSTAG — Foam Rolling Beine/Rücken, lockeres Gehen 20–30 Min, statisches Dehnen Hüfte/Beine/Brust, Atemübung. KEINE schweren Lasten. (3–5 leichte Mobility-/Recovery-Einträge, category "bodyweight"/"core"/"cardio".)
- REINE RESTDAYS (kein Sport am Vortag): optionaler leichter Mobility-Flow 10–15 Min (2–3 Übungen) ODER 1 Eintrag "Rest — frei" (category "bodyweight", target_sets 1, target_reps "—", Notiz "Vollständige Erholung — Schlaf & Ernährung priorisieren").
- ÜBERLAPPUNG Gym+Sport am selben Tag: max. 45 Min Gym, RPE 6–7, KEINE schweren Kniebeugen/Kreuzheben, Fokus Oberkörper-Zusatzübungen oder Mobility. Übertraining vermeiden.
- Tag VOR Spiel-/Sporttag: KEIN schweres Beintraining/CNS-Stress. Stattdessen Oberkörper-Zusatzübungen oder Mobility.
- Mannschaftssport: in-season Volumen reduzieren, Fokus auf Erhalt, Schnellkraft & Verletzungsprophylaxe; off-/pre-season Volumen hoch.${sportSpecificBlock}
- ⛔ VERBOTENES WORT: Schreibe NIEMALS "Akzessoires" oder "Accessoires" in day.name, day.focus oder exercise.name/notes. Nutze stattdessen "Zusatzübungen", "Ergänzung" oder "Feinschliff".`
    : `\n🚫 KEIN SPORT ANGEGEBEN: Der/die Kund:in betreibt KEINEN spezifischen Sport. Erstelle einen reinen Hypertrophie-/Kraft-/Mobility-Plan ohne sportartspezifische Übungen. KEINE Football-/QB-/Lineman-/Wurfschulter-Übungen, KEINE Soccer-/Fußball-spezifischen Übungen, KEINE Kampfsport-/BJJ-Übungen. Im Übungsnamen darf KEINE Sportart auftauchen.`;
  const mobilityBlock = cp.mobility_frequency || cp.mobility_focus
    ? `\n🧘 MOBILITY / STRETCHING (PFLICHT in den Plan einbauen!)
${cp.mobility_frequency ? `- Frequenz vom Kunden gewünscht: ${mobLabel[cp.mobility_frequency] ?? cp.mobility_frequency}` : ""}
${cp.mobility_focus ? `- Schwerpunkt: ${cp.mobility_focus}` : ""}
- WICHTIG: Füge an JEDEM Trainingstag mindestens 1 dedizierte Mobility-/Stretch-Übung als EIGENE Übung ein (category: "core" oder "bodyweight"), die genau diese Schwerpunkt-Bereiche adressiert. Beispiele für Hüfte: "90/90 Hüftrotation" (3×8/Seite), "Couch Stretch" (2×45s/Seite), "World's Greatest Stretch" (2×6/Seite), "Hüftbeuger-Dehnung kniend" (2×60s/Seite). Für Schultern: "Wand-Slides" (3×10), "Banded Pull-Apart" (3×15), "Thoracic Extensions auf der Foam Roll" (2×8). Für BWS: "Cat-Cow" (2×10), "Open Book" (2×8/Seite).
- Dies ist KEIN bloßer Warm-up-Hinweis — die Mobility-Übung MUSS in der exercises-Liste erscheinen mit Sätzen, Wdh/Sekunden und Pause.
- Bei "3-4x" oder "daily" Frequenz: zusätzlich 1 reiner Mobility-Tag pro Woche als optionales Add-on im Notizfeld erwähnen.`
    : "";
  const injuryBlock = cp.injuries
    ? `\n⚠️ VERLETZUNGEN/EINSCHRÄNKUNGEN: ${cp.injuries}\n- VERMEIDE belastende Übungen für diese Bereiche, biete alternative Varianten an.`
    : "";
  const targetsBlock = targets
    ? `\n🍽️ ERNÄHRUNGSZIELE
- Trainingstag: ${(targets as any).kcal} kcal · P ${(targets as any).protein_g}g · KH ${(targets as any).carbs_g}g · F ${(targets as any).fat_g}g
- Restday: ${(targets as any).kcal_rest} kcal · P ${(targets as any).protein_g_rest}g · KH ${(targets as any).carbs_g_rest}g · F ${(targets as any).fat_g_rest}g
→ Trainingsintensität an Trainingstagen höher (mehr Volumen, schwerere Hauptsätze). Restdays für Regeneration nutzen.`
    : "";
  const adherenceBlock = `\n📊 ADHÄRENZ (letzte 30 Tage)
- Trainingseinheiten: ${sessionsLast30}
- Daily-Checks: ${checksLast30}/30 · perfekte Tage: ${perfectDays30}
${weightTrendKg !== null ? `- Gewichtstrend: ${weightTrendKg > 0 ? "+" : ""}${weightTrendKg} kg` : ""}
${sessionsLast30 < 4 ? "→ Kunde trainiert selten — Plan etwas konservativer starten, Einstiegshürden niedrig halten." : ""}
${sessionsLast30 >= 12 ? "→ Hohe Trainingsfrequenz — Volumen darf höher liegen, mehr Akzessoires." : ""}`;
  const startWeightsBlock = `\n💪 STARTGEWICHTE — VERBINDLICH (Woche 1, RPE 7, runden auf 2,5 kg)
Diese Werte stammen aus dem letzten Strength-Check (e1RM × 0,75) und sind eine HARTE OBERGRENZE für Woche 1. Niemals höher ansetzen — auch nicht für ähnliche Varianten derselben Übung (z. B. Brustpresse Maschine ≈ Bankdrücken). Progression: W2 +2,5–5 kg, W3 +2,5–5 kg (RPE 8–9), W4 Deload ≈ 85 % von W3.
- Bankdrücken / Brustpresse (Maschine/LH/KH): MAX ${startWeights.bench_press_kg ?? "?"} kg (e1RM ${e1rm.chest_press ?? "?"} kg)
- Schulterdrücken / Schulterpresse (alle Varianten): MAX ${startWeights.shoulder_press_kg ?? "?"} kg (e1RM ${e1rm.shoulder_press ?? "?"} kg)
- Kniebeuge (LH): MAX ${startWeights.squat_kg ?? "?"} kg
- Kreuzheben (LH): MAX ${startWeights.deadlift_kg ?? "?"} kg
- Latzug (alle Griffe): MAX ${startWeights.lat_pulldown_kg ?? "?"} kg (e1RM ${e1rm.lat_pulldown ?? "?"} kg)
- Rudern (Kabel/Maschine/LH/KH): MAX ${startWeights.row_kg ?? "?"} kg (e1RM ${e1rm.cable_row ?? "?"} kg)
- Beinpresse: MAX ${startWeights.leg_press_kg ?? "?"} kg (e1RM ${e1rm.leg_press ?? "?"} kg)
- Beinbeuger (liegend/sitzend): MAX ${startWeights.leg_curl_kg ?? "?"} kg (e1RM ${e1rm.leg_curl ?? "?"} kg)
- Plank-Niveau: ${plankSeconds ? plankSeconds + "s" : "unbekannt"}

Für Isolationen ohne Test-Daten (Bizeps-Curl, Trizeps, Seitheben, Reverse Fly, Wadenheben usw.): konservativ starten und am SCHWÄCHSTEN e1RM oben orientieren. Werte über den oben genannten MAX-Grenzen werden automatisch nach unten gekappt.
Kurzhantel-Übungen: Gewicht PRO SEITE angeben. Langhantel/Maschinen: GESAMTGEWICHT.`;

  const prompt = `Erstelle einen INDIVIDUELLEN 4-WOCHEN-TRAININGSPLAN für ein Standard-Fitnessstudio.
NIEMALS Standardplan — nutze ALLE folgenden Daten.

👤 KUNDE
- Ziel: ${goalLabel[trainingGoal] ?? trainingGoal}
${cp.coaching_goal ? `- Eigenangabe: "${cp.coaching_goal}"` : ""}
${bw ? `- Körpergewicht: ${bw} kg` : ""}${bfPct ? ` · KFA: ${bfPct}%` : ""}
${cp.height_cm ? `- Größe: ${cp.height_cm} cm` : ""}${ageYears ? ` · Alter: ${ageYears} J.` : ""}${cp.gender ? ` · ${cp.gender}` : ""}
- Trainings-Erfahrung: ${experience}
- Sessionlänge: ca. ${sessionMinutes} Min · ${numDays} Trainingstage/Woche
${sportBlock}${mobilityBlock}${injuryBlock}

🏋️ LETZTER STRENGTH CHECK
${lastCheck ? `Gesamt: ${lastCheck.score_total}/100 · Unter ${lastCheck.score_lower} · Push ${lastCheck.score_push} · Pull ${lastCheck.score_pull} · Core ${lastCheck.score_core}
→ Priorisiere schwächste Muskelgruppe(n) mit mehr Sätzen.` : "- Kein Check vorhanden → konservativ starten."}
${startWeightsBlock}
${targetsBlock}
${adherenceBlock}
${equipBlock}

📐 STRUKTUR
- Split: ${splitHint}
- 4 Wochen mit PROGRESSION:
  • Woche 1: Anpassungsphase, RPE 7, Startgewichte
  • Woche 2: +2,5–5 kg auf Hauptübungen oder +1 Wdh
  • Woche 3: Belastungsspitze, RPE 8–9, ggf. +1 Satz auf Hauptübung
  • Woche 4: Deload — Gewicht ~85%, Sätze -1, Fokus Technik & Regeneration

🔥 WARM-UP & COOL-DOWN (PFLICHT an JEDEM Gym-Tag)
- JEDER Gym-Tag beginnt mit einem WARM-UP-BLOCK (2–3 Einträge, 5–10 Min gesamt):
  1) Allgemeines Warm-up (category "cardio", target_sets 1, target_reps "5 Min", Notiz z. B. "Rudergerät / Crosstrainer / Laufband locker, Puls hochfahren").
  2) Mobility-/Aktivierung passend zum Tagesfokus (category "core" oder "bodyweight"), z. B. Push-Tag → "Wand-Slides" 2×10 + "Band Pull-Apart" 2×15; Bein-Tag → "90/90 Hüftrotation" 2×8/Seite + "Body­weight Squat" 2×10; Pull-Tag → "Scapula Pull-Ups / Dead-Hang" 2×20s + "Cat-Cow" 2×10.
  3) OPTIONAL: 1–2 Aufwärmsätze der ersten Hauptübung als eigene Übung NUR wenn pädagogisch sinnvoll — sonst im notes-Feld der Hauptübung erwähnen.
- JEDER Gym-Tag endet mit einem COOL-DOWN-BLOCK (1–2 Einträge, 3–5 Min): statisches Dehnen der trainierten Muskelgruppen ODER Foam-Rolling ODER 5 Min lockeres Cardio zur Pulsabsenkung. Beispiele: "Brustdehnung Türrahmen" 2×30s/Seite, "Lat-Dehnung hängend" 2×30s/Seite, "Quadriceps-Dehnung stehend" 2×30s/Seite, "Foam Roll BWS" 1×60s.
- An Sport-/Spieltagen: kurzes dynamisches Warm-up (2–3 Einträge) VOR dem Sport-Eintrag, Cool-down-Mobility NACH dem Sport-Eintrag.

🧭 CHRONOLOGISCHE REIHENFOLGE pro Tag (sort_order entspricht Trainingsabfolge!)
Die exercises-Liste MUSS in dieser Reihenfolge sein:
  1. Warm-up Cardio
  2. Mobility/Aktivierung
  3. Hauptübung(en) (compound, schwer) — schwerste zuerst, große Muskelgruppen vor kleinen, mehrgelenkig vor eingelenkig
  4. Nebenübungen (Hypertrophie, mittlere Last)
  5. Isolation / Maschine / Kabel
  6. Core
  7. Optional Finisher / Conditioning-Cardio
  8. Cool-down (Stretching / Foam Roll)
Niemals Isolation vor Compound, niemals Core vor Kniebeugen/Kreuzheben, niemals Stretching am Anfang statt Mobility.

- Pro Tag (Gym): Warm-up + 1–2 Hauptübungen (compound), 2–3 Nebenübungen, 1 Kabel-/Maschine, 1 Core, optional Cardio (5–15 Min), Cool-down
- Übungsnamen wie im deutschen Studio: "Bankdrücken Langhantel", "Latzug eng", "Beinpresse", "Kurzhantel-Schulterdrücken", "Cable Row", "Beinbeuger liegend", "Plank"
${priorList.length ? `- BEVORZUGE bereits genutzte Übungsnamen für saubere PR-Historie:\n${priorList.map((n) => `  • ${n}`).join("\n")}` : ""}
- Pro Übung: Sätze, Wiederholungen (z.B. "8" oder "8,8,10,12"), Startgewichte je Satz in kg (komma-getrennt, nur Zahlen), Pause in Sek.
- Warm-up/Cool-down-Übungen: target_weights = null oder "—", rest_seconds 30–60.
- NOTES-FELD: Schreibe IMMER eine 1-Satz-Ausführungsanleitung in einfachem Deutsch (Setup + Bewegung), sodass die Übung OHNE YouTube sofort verständlich ist. Beispiel: "Couch Stretch — kniend, Fuß an Wand, Hüfte nach vorn schieben, 60s halten". Keine Fachjargon-Abkürzungen ohne Erklärung.
- Kategorie: barbell | dumbbell | machine | cable | cardio | core | bodyweight
- NAMENS-PRÄFIX zur klaren Kennzeichnung: Warm-up-Einträge mit "Warm-up: …" beginnen, Cool-down-Einträge mit "Cool-down: …" beginnen.

📤 ANTWORT
NUR gültiges JSON, KEINE Erklärung außerhalb:
{"weeks":[{"week_number":1,"focus":"Anpassung","days":[{"name":"Push","focus":"Brust/Schulter/Trizeps","exercises":[{"name":"Warm-up: Rudergerät locker","category":"cardio","target_sets":1,"target_reps":"5 Min","target_weights":null,"rest_seconds":30,"notes":"Lockeres Rudern, Puls auf ~120 bringen"},{"name":"Warm-up: Band Pull-Apart","category":"bodyweight","target_sets":2,"target_reps":"15","target_weights":null,"rest_seconds":30,"notes":"Theraband auf Brusthöhe auseinanderziehen, Schulterblätter zusammen"},{"name":"Bankdrücken Langhantel","category":"barbell","target_sets":4,"target_reps":"8,8,8,10","target_weights":"60,60,60,50","rest_seconds":120,"notes":"Schulterblätter zusammen, Stange Richtung Brustmitte, Tempo 3-1-1"},{"name":"Cool-down: Brustdehnung Türrahmen","category":"bodyweight","target_sets":2,"target_reps":"30s/Seite","target_weights":null,"rest_seconds":30,"notes":"Arm 90° an Türrahmen, Oberkörper langsam nach vorne drehen"}]}]}]}
GENAU 4 Wochen. Jede Woche GENAU 7 Tage (Mo, Di, Mi, Do, Fr, Sa, So in dieser Reihenfolge) — Gym-Tage als Krafttraining MIT Warm-up am Anfang und Cool-down am Ende, Sport-/Spieltage mit kurzem Warm-up + Sport-Eintrag + Cool-down (KEINE Kraftübungen), Restdays als Recovery/Mobility oder "Rest — frei". An Gym-Tagen mind. 7 Übungen (inkl. Warm-up + Cool-down), an Sport-/Restdays 1–5 Einträge. Übungen-Array IMMER in chronologischer Trainingsreihenfolge. NIEMALS das Wort "Akzessoires" verwenden.`;

  const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Lovable-API-Key": apiKey },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      response_format: { type: "json_object" },
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (aiRes.status === 429) throw new Error("Rate-Limit erreicht — gleich nochmal versuchen.");
  if (aiRes.status === 402) throw new Error("KI-Guthaben aufgebraucht — bitte aufladen.");
  if (!aiRes.ok) {
    const txt = await aiRes.text();
    throw new Error(`KI-Fehler [${aiRes.status}]: ${txt.slice(0, 200)}`);
  }
  const aiJson = await aiRes.json();
  const raw = aiJson?.choices?.[0]?.message?.content ?? "{}";
  let parsed: { weeks?: GenWeek[]; days?: GenDay[] } = {};
  try { parsed = typeof raw === "string" ? JSON.parse(raw) : raw; }
  catch { throw new Error("KI-Antwort konnte nicht gelesen werden."); }

  let weeks: GenWeek[] = parsed.weeks ?? [];
  if (!weeks.length && parsed.days?.length) {
    weeks = Array.from({ length: totalWeeks }, (_, i) => ({
      week_number: i + 1,
      focus: i === 3 ? "Deload" : `Woche ${i + 1}`,
      days: parsed.days as GenDay[],
    }));
  }
  weeks = weeks.slice(0, totalWeeks);
  if (!weeks.length) throw new Error("Keine Trainingswochen generiert.");

  for (const w of weeks) {
    w.days = (w.days ?? []).slice(0, 7).map((d) => ({
      ...d,
      exercises: (d.exercises ?? []).map((e) => ({
        ...e,
        name: alignExerciseName(e.name, priorList),
      })),
    }));
  }

  await supabase
    .from("nutrition_plans")
    .update({ status: "archived" } as any)
    .eq("client_id", target)
    .eq("plan_type", "training")
    .in("status", ["draft", "approved", "published"]);

  const isoDate = (d: Date) => d.toISOString().slice(0, 10);
  const end = new Date(start);
  end.setDate(end.getDate() + planSpan - 1);

  const { data: planRow, error: planErr } = await supabase
    .from("nutrition_plans")
    .insert({
      client_id: target,
      title:
        title?.trim() ||
        `Smart-Trainingsplan ${totalWeeks} Wochen — ${new Date().toLocaleDateString("de-DE")}`,
      plan_type: "training",
      is_active: false,
      status: "draft",
      generated_by: "ai_auto",
      source: "smart_ai",
      uploaded_by: uploadedBy,
      file_path: `ai-generated/${target}/training-${Date.now()}.json`,
      file_name: "ai-training.json",
      scheduled_start_date: isoDate(start),
      scheduled_end_date: isoDate(end),
      weeks_count: totalWeeks,
      last_auto_generated_at: new Date().toISOString(),
    } as any)
    .select("id").single();
  if (planErr || !planRow) throw new Error(planErr?.message ?? "Plan konnte nicht angelegt werden");

  let totalEx = 0;
  let totalDays = 0;
  for (const w of weeks) {
    for (let i = 0; i < w.days.length; i++) {
      const d = w.days[i];
      const baseName = stripAkzessoires((d.name && String(d.name).trim()) || `Tag ${i + 1}`);
      const dayName = d.focus ? `${baseName} — ${stripAkzessoires(String(d.focus))}` : baseName;
      const { data: dayRow, error: dayErr } = await supabase
        .from("training_days")
        .insert({
          plan_id: planRow.id,
          name: String(dayName).slice(0, 120),
          sort_order: i,
          week_number: w.week_number,
        } as any)
        .select("id").single();
      if (dayErr || !dayRow) continue;
      totalDays++;

      const rows = (d.exercises ?? [])
        .map((e, idx) => {
          const cleanName = stripAkzessoires(String(e.name ?? "").trim()).slice(0, 200);
          const clampedWeights = clampWeightsForExercise(
            cleanName,
            e.target_weights,
            w.week_number,
            startWeights,
          );
          return {
            day_id: dayRow.id,
            name: cleanName,
            category: validCategory(e.category),
            target_sets:
              typeof e.target_sets === "number" && Number.isFinite(e.target_sets)
                ? Math.max(1, Math.min(20, Math.round(e.target_sets)))
                : null,
            target_reps: e.target_reps ? String(e.target_reps).slice(0, 80) : null,
            target_weights: clampedWeights,
            rest_seconds:
              typeof e.rest_seconds === "number" && Number.isFinite(e.rest_seconds)
                ? Math.max(15, Math.min(600, Math.round(e.rest_seconds)))
                : null,
            notes: e.notes ? stripAkzessoires(String(e.notes)).slice(0, 500) : null,
            sort_order: idx,
          };
        })
        .filter((r) => r.name);
      totalEx += rows.length;
      if (rows.length) {
        await supabase.from("training_exercises").insert(rows as any);
      }
    }
  }

  return {
    ok: true,
    plan_id: planRow.id,
    status: "draft",
    weeks: weeks.length,
    days: totalDays,
    exercises: totalEx,
    scheduled_start_date: isoDate(start),
    scheduled_end_date: isoDate(end),
  };
}

function stripAkzessoires(s: string): string {
  return s
    .replace(/akzessoires?/gi, "Zusatzübungen")
    .replace(/accessoires?/gi, "Zusatzübungen");
}

function validCategory(c: unknown): string | null {
  const allowed = ["barbell","dumbbell","machine","cardio","core","bodyweight","cable"];
  if (typeof c !== "string") return null;
  const v = c.toLowerCase().trim();
  return allowed.includes(v) ? v : null;
}

type StartWeights = {
  bench_press_kg: number | null;
  shoulder_press_kg: number | null;
  squat_kg: number | null;
  deadlift_kg: number | null;
  lat_pulldown_kg: number | null;
  row_kg: number | null;
  leg_press_kg: number | null;
  leg_curl_kg: number | null;
};

function detectStartKey(name: string): keyof StartWeights | null {
  const n = name.toLowerCase();
  if (/(brustpresse|bankdr(ü|u)ck|bench[- ]?press|chest[- ]?press|brustdr(ü|u)ck)/.test(n)) return "bench_press_kg";
  if (/(schulterpresse|schulterdr(ü|u)ck|shoulder[- ]?press|overhead[- ]?press|military[- ]?press)/.test(n)) return "shoulder_press_kg";
  if (/(kniebeuge|squat\b|back ?squat|front ?squat|hack[- ]?squat)/.test(n)) return "squat_kg";
  if (/(kreuzheb|deadlift|rdl|rom(a|á)nian)/.test(n)) return "deadlift_kg";
  if (/(latzug|lat[- ]?pulldown|pull[- ]?down)/.test(n)) return "lat_pulldown_kg";
  if (/(rudern|row\b|kabelruder|cable[- ]?row|seated[- ]?row|t[- ]?bar)/.test(n)) return "row_kg";
  if (/beinpresse|leg[- ]?press/.test(n)) return "leg_press_kg";
  if (/(beinbeuger|leg[- ]?curl|hamstring[- ]?curl)/.test(n)) return "leg_curl_kg";
  return null;
}

// Progression-Caps relativ zur Woche-1-Empfehlung (e1RM × 0.75).
function weekCapFactor(weekNumber: number): number {
  switch (weekNumber) {
    case 1: return 1.0;
    case 2: return 1.08;
    case 3: return 1.15;
    case 4: return 1.0; // Deload
    default: return 1.15;
  }
}

function clampWeightsForExercise(
  name: string,
  raw: unknown,
  weekNumber: number,
  start: StartWeights,
): string | null {
  if (raw == null) return null;
  const str = String(raw).trim();
  if (!str.length) return null;
  if (str.length > 120) return str.slice(0, 120);
  const key = detectStartKey(name);
  const baseline = key ? start[key] : null;
  if (!baseline || baseline <= 0) return str;
  const cap = Math.max(2.5, Math.round((baseline * weekCapFactor(weekNumber)) / 2.5) * 2.5);
  const tokens = str.split(/[,;]/).map((t) => t.trim());
  const nums: number[] = [];
  for (const t of tokens) {
    if (!/^-?\d+(?:[\.,]\d+)?$/.test(t)) return str;
    nums.push(parseFloat(t.replace(",", ".")));
  }
  const clamped = nums.map((n) => (n > cap ? cap : n));
  return clamped.map((n) => (Number.isInteger(n) ? String(n) : n.toFixed(1))).join(",");
}

function alignExerciseName(name: string, priorList: string[]): string {
  const raw = String(name ?? "").trim();
  if (!raw) return raw;
  const n = normalize(raw);
  let best: { name: string; score: number } | null = null;
  for (const p of priorList) {
    const np = normalize(p);
    let score = 0;
    if (np === n) score = 100;
    else if (np.includes(n) || n.includes(np)) score = 80;
    else {
      const tokensA = new Set(n.split(/\s+/));
      const tokensB = new Set(np.split(/\s+/));
      let inter = 0;
      tokensA.forEach((t) => { if (t.length > 2 && tokensB.has(t)) inter++; });
      score = (inter / Math.max(tokensA.size, tokensB.size)) * 70;
    }
    if (!best || score > best.score) best = { name: p, score };
  }
  return best && best.score >= 55 ? best.name : raw;
}
function normalize(s: string): string {
  const SYN: Record<string, string> = {
    kh: "kurzhantel", db: "kurzhantel", dumbbell: "kurzhantel",
    lh: "langhantel", barbell: "langhantel",
    masch: "maschine", machine: "maschine",
    multi: "multipresse", smith: "multipresse", multipress: "multipresse",
    seilzug: "kabel", cable: "kabel",
    pulldown: "latzug", row: "rudern", press: "drucken",
  };
  let v = s.toLowerCase()
    .replace(/[äöü]/g, (c) => ({ ä: "a", ö: "o", ü: "u" })[c] as string)
    .replace(/ß/g, "ss").replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ").trim();
  v = v.split(" ").map((t) => SYN[t] ?? t).join(" ");
  return v;
}
