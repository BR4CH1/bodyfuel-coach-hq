import { describe, expect, it } from 'vitest';

import { disabledRunAlerts, evaluateRunAlert } from './run-alerts';

describe('run alerts', () => {
  it('prioritizes a high heart-rate warning', () => {
    const alert = evaluateRunAlert({
      settings: { ...disabledRunAlerts, maximumHeartRateBpm: 165 },
      currentPaceSecondsPerKm: null,
      heartRateBpm: 170,
      nowMs: 10_000,
      lastAlertAtMs: {},
    });

    expect(alert?.kind).toBe('heart-rate-high');
  });

  it('respects the cooldown per alert type', () => {
    const alert = evaluateRunAlert({
      settings: { ...disabledRunAlerts, slowestPaceSecondsPerKm: 420 },
      currentPaceSecondsPerKm: 450,
      heartRateBpm: null,
      nowMs: 70_000,
      lastAlertAtMs: { 'pace-slow': 20_000 },
    });

    expect(alert).toBeNull();
  });
});
