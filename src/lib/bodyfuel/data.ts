export type CheckTaskKey =
  | "protein"
  | "water"
  | "fruitsVeg"
  | "steps"
  | "training"
  | "sleep"
  | "recovery";

export const TASKS: { key: CheckTaskKey; label: string; points: number; emoji: string }[] = [
  { key: "protein", label: "Eiweißziel erreicht", points: 3, emoji: "🥩" },
  { key: "water", label: "Trinkziel erreicht", points: 2, emoji: "💧" },
  { key: "fruitsVeg", label: "3 Portionen Obst/Gemüse", points: 2, emoji: "🥦" },
  { key: "steps", label: "Schrittziel erreicht", points: 2, emoji: "👟" },
  { key: "training", label: "Training absolviert", points: 3, emoji: "🏋️" },
  { key: "sleep", label: "7+ Stunden Schlaf", points: 2, emoji: "😴" },
  { key: "recovery", label: "Recovery gemacht", points: 1, emoji: "🧘" },
];

export const MAX_DAILY_POINTS = TASKS.reduce((s, t) => s + t.points, 0); // 15

export type LevelName = "Rookie" | "Grinder" | "Athlete" | "Elite" | "Beast" | "Legend";

export const LEVELS: { name: LevelName; min: number; max: number }[] = [
  { name: "Rookie", min: 0, max: 99 },
  { name: "Grinder", min: 100, max: 249 },
  { name: "Athlete", min: 250, max: 499 },
  { name: "Elite", min: 500, max: 799 },
  { name: "Beast", min: 800, max: 1199 },
  { name: "Legend", min: 1200, max: Infinity },
];

export function getLevel(points: number) {
  const idx = LEVELS.findIndex((l) => points >= l.min && points <= l.max);
  const level = LEVELS[idx];
  const next = LEVELS[idx + 1];
  const progress = next
    ? Math.min(100, Math.round(((points - level.min) / (next.min - level.min)) * 100))
    : 100;
  return { level, next, progress, index: idx };
}

export type DailyCheck = {
  date: string; // YYYY-MM-DD
  tasks: Record<CheckTaskKey, boolean>;
};

export function pointsForDay(check: DailyCheck | undefined): number {
  if (!check) return 0;
  return TASKS.reduce((sum, t) => sum + (check.tasks[t.key] ? t.points : 0), 0);
}

export type Achievement = {
  id: string;
  name: string;
  description: string;
  emoji: string;
  check: (c: Client) => { progress: number; total: number; done: boolean };
};

export type WeightEntry = { date: string; weight: number; waist?: number };
export type ProgressPhoto = { date: string; url: string; label: string };
export type NutritionPlan = { id: string; name: string; date: string; current: boolean };

export type Client = {
  id: string;
  name: string;
  email: string;
  avatar: string;
  streak: number;
  checks: DailyCheck[]; // newest first
  weightHistory: WeightEntry[];
  photos: ProgressPhoto[];
  plans: NutritionPlan[];
  nextCheckIn: string;
};

export function totalPoints(c: Client): number {
  return c.checks.reduce((s, d) => s + pointsForDay(d), 0);
}

export function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

export function lastNDays(n: number): string[] {
  const out: string[] = [];
  const d = new Date();
  for (let i = 0; i < n; i++) {
    const x = new Date(d);
    x.setDate(d.getDate() - i);
    out.push(x.toISOString().slice(0, 10));
  }
  return out;
}

export function weekPoints(c: Client): number {
  const week = new Set(lastNDays(7));
  return c.checks.filter((d) => week.has(d.date)).reduce((s, d) => s + pointsForDay(d), 0);
}

export function todayPoints(c: Client): number {
  return pointsForDay(c.checks.find((d) => d.date === todayKey()));
}

export function daysSinceLastCheck(c: Client): number {
  if (!c.checks.length) return 999;
  const last = c.checks[0].date;
  const diff = (Date.now() - new Date(last).getTime()) / 86400000;
  return Math.floor(diff);
}

export const ACHIEVEMENTS: Achievement[] = [
  {
    id: "protein-king",
    name: "Protein King",
    description: "30 Tage Eiweißziel erreicht",
    emoji: "🥩",
    check: (c) => {
      const n = c.checks.filter((d) => d.tasks.protein).length;
      return { progress: Math.min(n, 30), total: 30, done: n >= 30 };
    },
  },
  {
    id: "hydration-hero",
    name: "Hydration Hero",
    description: "30 Tage Trinkziel erreicht",
    emoji: "💧",
    check: (c) => {
      const n = c.checks.filter((d) => d.tasks.water).length;
      return { progress: Math.min(n, 30), total: 30, done: n >= 30 };
    },
  },
  {
    id: "iron-athlete",
    name: "Iron Athlete",
    description: "50 Trainings abgeschlossen",
    emoji: "🏋️",
    check: (c) => {
      const n = c.checks.filter((d) => d.tasks.training).length;
      return { progress: Math.min(n, 50), total: 50, done: n >= 50 };
    },
  },
  {
    id: "on-fire",
    name: "On Fire",
    description: "14 Tage Streak",
    emoji: "🔥",
    check: (c) => ({ progress: Math.min(c.streak, 14), total: 14, done: c.streak >= 14 }),
  },
  {
    id: "legend-status",
    name: "Legend Status",
    description: "1200 Punkte erreicht",
    emoji: "👑",
    check: (c) => {
      const p = totalPoints(c);
      return { progress: Math.min(p, 1200), total: 1200, done: p >= 1200 };
    },
  },
];

// ---------- Dummy data generation ----------
function seedChecks(
  days: number,
  bias: number,
  skipRecent = 0,
): DailyCheck[] {
  const out: DailyCheck[] = [];
  const dates = lastNDays(days);
  for (let i = 0; i < dates.length; i++) {
    if (i < skipRecent) continue;
    const tasks = {} as Record<CheckTaskKey, boolean>;
    // pseudo random but stable enough
    let seed = (i * 131 + Math.round(bias * 1000)) % 100;
    for (const t of TASKS) {
      seed = (seed * 7 + 11) % 100;
      tasks[t.key] = seed < bias * 100;
    }
    out.push({ date: dates[i], tasks });
  }
  return out;
}

function weightSeries(start: number, days: number, drift: number): WeightEntry[] {
  const dates = lastNDays(days).reverse();
  return dates.map((d, i) => ({
    date: d,
    weight: +(start + drift * i + Math.sin(i / 2) * 0.3).toFixed(1),
    waist: +(start - 15 + drift * i * 0.6 + Math.cos(i / 3) * 0.2).toFixed(1),
  }));
}

export const CLIENTS: Client[] = [
  {
    id: "stefan",
    name: "Andreas",
    email: "andreas@bodyfuel.app",
    avatar: "A",
    streak: 12,
    checks: seedChecks(60, 0.78),
    weightHistory: weightSeries(92, 12, -0.4),
    photos: [
      { date: lastNDays(30)[29], url: "", label: "Start" },
      { date: lastNDays(15)[14], url: "", label: "Woche 2" },
      { date: lastNDays(1)[0], url: "", label: "Aktuell" },
    ],
    plans: [
      { id: "p1", name: "Cut Phase – 2400 kcal", date: lastNDays(7)[6], current: true },
      { id: "p2", name: "Maintenance – 2800 kcal", date: lastNDays(45)[44], current: false },
    ],
    nextCheckIn: "Heute, 20:00",
  },
  {
    id: "michelle",
    name: "Patrick",
    email: "patrick@bodyfuel.app",
    avatar: "P",
    streak: 28,
    checks: seedChecks(120, 0.92),
    weightHistory: weightSeries(68, 12, -0.2),
    photos: [
      { date: lastNDays(60)[59], url: "", label: "Start" },
      { date: lastNDays(30)[29], url: "", label: "Monat 1" },
      { date: lastNDays(1)[0], url: "", label: "Aktuell" },
    ],
    plans: [
      { id: "p1", name: "Recomp – 2100 kcal", date: lastNDays(3)[2], current: true },
      { id: "p2", name: "Cut – 1900 kcal", date: lastNDays(60)[59], current: false },
      { id: "p3", name: "Onboarding – 2000 kcal", date: lastNDays(90)[89], current: false },
    ],
    nextCheckIn: "Morgen, 19:30",
  },
  {
    id: "mia",
    name: "Luisa",
    email: "luisa@bodyfuel.app",
    avatar: "L",
    streak: 0,
    checks: seedChecks(20, 0.45, 4), // skipped last 4 days → warning
    weightHistory: weightSeries(74, 12, 0.05),
    photos: [{ date: lastNDays(20)[19], url: "", label: "Start" }],
    plans: [{ id: "p1", name: "Starter Plan – 1800 kcal", date: lastNDays(20)[19], current: true }],
    nextCheckIn: "Überfällig",
  },
];

export function findClient(id: string): Client | undefined {
  return CLIENTS.find((c) => c.id === id);
}
