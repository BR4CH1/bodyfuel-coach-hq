import {
  acknowledgeWatchRuns,
  addWatchRunListener,
  getPendingWatchRuns,
  type WatchRunSummary,
} from '@modules/bodyfuel-watch-connectivity';

import type { RunSession } from '../domain/run-session';
import { saveCompletedRun } from './run-draft';

function toCompletedRun(summary: WatchRunSummary): RunSession {
  const activeElapsedMs = Math.max(0, summary.elapsedSeconds * 1_000);
  const distanceMeters = Math.max(0, summary.distanceMeters);
  return {
    id: summary.id,
    status: 'completed',
    startedAtMs: summary.startedAtMs,
    endedAtMs: summary.endedAtMs,
    lastResumedAtMs: null,
    activeElapsedMs,
    distanceMeters,
    currentPaceSecondsPerKm: null,
    averagePaceSecondsPerKm:
      distanceMeters >= 20 ? activeElapsedMs / 1_000 / (distanceMeters / 1_000) : null,
    heartRateBpm:
      typeof summary.averageHeartRateBpm === 'number'
        ? Math.round(summary.averageHeartRateBpm)
        : null,
    points: [],
    rejectedPointCount: 0,
  };
}

async function importOne(summary: WatchRunSummary): Promise<void> {
  await saveCompletedRun(toCompletedRun(summary));
  await acknowledgeWatchRuns([summary.id]);
}

export async function importPendingWatchRuns(): Promise<number> {
  const pending = await getPendingWatchRuns();
  await Promise.all(pending.map(importOne));
  return pending.length;
}

export function subscribeToWatchRuns(onError: (cause: unknown) => void): () => void {
  const subscription = addWatchRunListener((summary) => {
    void importOne(summary).catch(onError);
  });
  return () => subscription?.remove();
}
