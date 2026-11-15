import { TASKS, type CheckTaskKey } from "./bodyfuel/data";

export const CHALLENGE_FIRST_DAY = "2026-11-15";
export const CHALLENGE_END_EXCLUSIVE = "2026-12-15";
export type ChallengeCheck = { check_date: string; tasks: unknown };

export function summarizeChallengeChecks(checks: ChallengeCheck[], date: string) {
  const inChallenge = checks.filter(check => check.check_date >= CHALLENGE_FIRST_DAY && check.check_date < CHALLENGE_END_EXCLUSIVE);
  const score = (tasks: unknown) => TASKS.reduce((sum, task) => sum + (tasks && typeof tasks === "object" && (tasks as Record<string, unknown>)[task.key] === true ? task.points : 0), 0);
  const selected = inChallenge.find(check => check.check_date === date);
  const tasks = Object.fromEntries(TASKS.map(task => [task.key, !!selected && typeof selected.tasks === "object" && selected.tasks !== null && (selected.tasks as Record<string, unknown>)[task.key] === true])) as Record<CheckTaskKey, boolean>;
  return {
    tasks,
    day_points: score(tasks),
    challenge_points: inChallenge.reduce((sum, check) => sum + score(check.tasks), 0),
    perfect_days: inChallenge.filter(check => score(check.tasks) === 15).length,
  };
}