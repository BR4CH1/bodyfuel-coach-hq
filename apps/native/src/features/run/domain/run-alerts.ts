export type RunAlertSettings = {
  fastestPaceSecondsPerKm: number | null;
  slowestPaceSecondsPerKm: number | null;
  minimumHeartRateBpm: number | null;
  maximumHeartRateBpm: number | null;
  cooldownMs: number;
};

export type RunAlertKind = 'pace-fast' | 'pace-slow' | 'heart-rate-low' | 'heart-rate-high';

export type RunAlert = {
  kind: RunAlertKind;
  message: string;
};

export const disabledRunAlerts: RunAlertSettings = {
  fastestPaceSecondsPerKm: null,
  slowestPaceSecondsPerKm: null,
  minimumHeartRateBpm: null,
  maximumHeartRateBpm: null,
  cooldownMs: 60_000,
};

export function evaluateRunAlert(input: {
  settings: RunAlertSettings;
  currentPaceSecondsPerKm: number | null;
  heartRateBpm: number | null;
  nowMs: number;
  lastAlertAtMs: Partial<Record<RunAlertKind, number>>;
}): RunAlert | null {
  const { settings, currentPaceSecondsPerKm, heartRateBpm, nowMs, lastAlertAtMs } = input;
  const ready = (kind: RunAlertKind) =>
    nowMs - (lastAlertAtMs[kind] ?? Number.NEGATIVE_INFINITY) >= settings.cooldownMs;

  if (
    heartRateBpm !== null &&
    settings.maximumHeartRateBpm !== null &&
    heartRateBpm > settings.maximumHeartRateBpm &&
    ready('heart-rate-high')
  ) {
    return { kind: 'heart-rate-high', message: 'Herzfrequenz über deinem Zielbereich.' };
  }

  if (
    heartRateBpm !== null &&
    settings.minimumHeartRateBpm !== null &&
    heartRateBpm < settings.minimumHeartRateBpm &&
    ready('heart-rate-low')
  ) {
    return { kind: 'heart-rate-low', message: 'Herzfrequenz unter deinem Zielbereich.' };
  }

  if (
    currentPaceSecondsPerKm !== null &&
    settings.fastestPaceSecondsPerKm !== null &&
    currentPaceSecondsPerKm < settings.fastestPaceSecondsPerKm &&
    ready('pace-fast')
  ) {
    return { kind: 'pace-fast', message: 'Du läufst schneller als geplant.' };
  }

  if (
    currentPaceSecondsPerKm !== null &&
    settings.slowestPaceSecondsPerKm !== null &&
    currentPaceSecondsPerKm > settings.slowestPaceSecondsPerKm &&
    ready('pace-slow')
  ) {
    return { kind: 'pace-slow', message: 'Du läufst langsamer als geplant.' };
  }

  return null;
}
