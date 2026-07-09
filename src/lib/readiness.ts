// Zentrale Readiness-Berechnung — Source of Truth für Athleten- und Coach-Ansicht.
// Keine medizinische Bewertung, kein Diagnose-Wording.

export type ReadinessCheckin = {
  checkin_date: string;
  sleep: number | null;
  energy: number | null;
  stress: number | null;
  training_feel: number | null;
  pain_level: number | null;
  pain_note?: string | null;
};

/** Score 0–100 basierend auf 4 Skalen (0–5). Schmerz wirkt als leichter Malus. */
export function scoreOfCheckin(r: ReadinessCheckin): number | null {
  const parts: number[] = [];
  if (r.sleep != null) parts.push((r.sleep / 5) * 25);
  if (r.energy != null) parts.push((r.energy / 5) * 25);
  if (r.stress != null) parts.push(((5 - r.stress) / 5) * 25);
  if (r.training_feel != null) parts.push((r.training_feel / 5) * 25);
  if (!parts.length) return null;
  let score = parts.reduce((a, b) => a + b, 0) * (4 / parts.length);
  if (r.pain_level != null) score -= r.pain_level * 5;
  return Math.max(0, Math.min(100, Math.round(score)));
}

export type ReadinessBucket = "green" | "yellow" | "red";
export function bucketOf(score: number | null): ReadinessBucket | null {
  if (score == null) return null;
  if (score >= 70) return "green";
  if (score >= 45) return "yellow";
  return "red";
}

/** Series: älteste zuerst; jeder Eintrag mit Datum-Timestamp + Score. */
export function readinessSeries(rows: ReadinessCheckin[]): Array<{ t: number; v: number; date: string }> {
  return rows
    .map((r) => {
      const v = scoreOfCheckin(r);
      if (v == null) return null;
      return { t: new Date(r.checkin_date).getTime(), v, date: r.checkin_date };
    })
    .filter((x): x is { t: number; v: number; date: string } => !!x)
    .sort((a, b) => a.t - b.t);
}

export function avgOf(nums: number[]): number | null {
  if (!nums.length) return null;
  return Math.round(nums.reduce((a, b) => a + b, 0) / nums.length);
}

/**
 * Vergleicht Readiness-Ø 7d vor dem ersten Gate-Event vs. 7d danach.
 * Gibt null zurück, wenn eine Seite keine Daten hat. Identische Logik
 * wird für Coach-Drilldown und Athleten-Banner genutzt.
 */
export function recoveryAfterGate(
  gateDates: string[],
  rows: ReadinessCheckin[],
): { before: number; after: number; delta: number } | null {
  if (gateDates.length === 0 || rows.length === 0) return null;
  const sorted = [...gateDates].sort();
  const start = new Date(sorted[0]);
  start.setHours(0, 0, 0, 0);
  const before: number[] = [];
  const after: number[] = [];
  for (const r of rows) {
    const t = new Date(r.checkin_date);
    t.setHours(0, 0, 0, 0);
    const diffDays = (t.getTime() - start.getTime()) / (24 * 60 * 60 * 1000);
    const s = scoreOfCheckin(r);
    if (s == null) continue;
    if (diffDays >= -7 && diffDays < 0) before.push(s);
    else if (diffDays >= 0 && diffDays <= 7) after.push(s);
  }
  if (before.length === 0 || after.length === 0) return null;
  const b = Math.round(before.reduce((a, x) => a + x, 0) / before.length);
  const a = Math.round(after.reduce((a, x) => a + x, 0) / after.length);
  return { before: b, after: a, delta: a - b };
}
  if (!nums.length) return null;
  return Math.round(nums.reduce((a, b) => a + b, 0) / nums.length);
}

function daysAgoTs(days: number): number {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - days);
  return d.getTime();
}

export type ReadinessSummary = {
  current: number | null;
  avg7: number | null;
  avg30: number | null;
  delta7v30: number | null;
  pain_events_7: number;
  pain_events_30: number;
  load_trend: "rising" | "falling" | "stable" | null; // aus training_feel-Trend
  message: string;
};

export function summarize(rows: ReadinessCheckin[]): ReadinessSummary {
  const series = readinessSeries(rows);
  const now = Date.now();
  const t7 = daysAgoTs(6);
  const t30 = daysAgoTs(29);
  const in7 = series.filter((p) => p.t >= t7);
  const in30 = series.filter((p) => p.t >= t30);
  const current = series.length ? series[series.length - 1].v : null;
  const avg7 = avgOf(in7.map((p) => p.v));
  const avg30 = avgOf(in30.map((p) => p.v));
  const delta7v30 = avg7 != null && avg30 != null ? avg7 - avg30 : null;

  const pain7 = rows.filter(
    (r) => r.pain_level != null && r.pain_level >= 2 && new Date(r.checkin_date).getTime() >= t7,
  ).length;
  const pain30 = rows.filter(
    (r) => r.pain_level != null && r.pain_level >= 2 && new Date(r.checkin_date).getTime() >= t30,
  ).length;

  // Belastungstrend aus training_feel: fällt = Belastung wirkt stärker (Athlet fühlt sich "platter")
  const feelRows = rows
    .filter((r) => r.training_feel != null)
    .map((r) => ({ t: new Date(r.checkin_date).getTime(), v: r.training_feel as number }))
    .sort((a, b) => a.t - b.t);
  let load_trend: ReadinessSummary["load_trend"] = null;
  if (feelRows.length >= 4) {
    const half = Math.floor(feelRows.length / 2);
    const oldAvg = feelRows.slice(0, half).reduce((a, b) => a + b.v, 0) / half;
    const newAvg = feelRows.slice(-half).reduce((a, b) => a + b.v, 0) / half;
    const diff = newAvg - oldAvg;
    if (diff > 0.4) load_trend = "falling"; // Trainingsgefühl steigt → Belastung verträglich
    else if (diff < -0.4) load_trend = "rising"; // Trainingsgefühl fällt → Belastung wirkt hoch
    else load_trend = "stable";
  }
  void now;

  return {
    current,
    avg7,
    avg30,
    delta7v30,
    pain_events_7: pain7,
    pain_events_30: pain30,
    load_trend,
    message: buildMessage({ current, avg7, avg30, delta7v30, pain7, load_trend }),
  };
}

function buildMessage(x: {
  current: number | null;
  avg7: number | null;
  avg30: number | null;
  delta7v30: number | null;
  pain7: number;
  load_trend: ReadinessSummary["load_trend"];
}): string {
  if (x.current == null && x.avg7 == null) {
    return "Noch keine Check-ins — leg einfach heute los.";
  }
  if (x.pain7 >= 2) {
    return "Du hast mehrfach Beschwerden gemeldet — dein Live Plan berücksichtigt das.";
  }
  if (x.load_trend === "rising") {
    return "Deine Belastung ist erhöht — dein Live Plan passt sich an.";
  }
  if (x.delta7v30 != null) {
    if (x.delta7v30 >= 6) return "Deine Readiness ist zuletzt besser als dein 30-Tage-Schnitt. Stark.";
    if (x.delta7v30 <= -6) return "Deine Erholung liegt aktuell unter deinem persönlichen Durchschnitt.";
  }
  return "Deine Readiness ist in den letzten 7 Tagen stabil.";
}
