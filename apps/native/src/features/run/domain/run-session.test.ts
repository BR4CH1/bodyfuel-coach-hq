import { describe, expect, it } from 'vitest';

import {
  createEmptyRunSession,
  formatDuration,
  formatPace,
  runSessionReducer,
  selectElapsedMs,
  type LocationPoint,
} from './run-session';

const point = (overrides: Partial<LocationPoint> = {}): LocationPoint => ({
  latitude: 51.4556,
  longitude: 7.0116,
  altitudeMeters: 80,
  accuracyMeters: 5,
  speedMetersPerSecond: 3,
  timestampMs: 2_000,
  ...overrides,
});

describe('run session', () => {
  it('counts only active time across pause and resume', () => {
    let session = runSessionReducer(createEmptyRunSession(), {
      type: 'start',
      id: 'run-1',
      atMs: 1_000,
    });
    session = runSessionReducer(session, { type: 'pause', atMs: 11_000 });
    session = runSessionReducer(session, { type: 'resume', atMs: 21_000 });

    expect(selectElapsedMs(session, 26_000)).toBe(15_000);

    session = runSessionReducer(session, { type: 'finish', atMs: 31_000 });
    expect(session.activeElapsedMs).toBe(20_000);
    expect(session.status).toBe('completed');
  });

  it('adds plausible GPS distance and rejects impossible jumps', () => {
    let session = runSessionReducer(createEmptyRunSession(), {
      type: 'start',
      id: 'run-2',
      atMs: 1_000,
    });
    session = runSessionReducer(session, { type: 'location', point: point() });
    session = runSessionReducer(session, {
      type: 'location',
      point: point({ longitude: 7.01175, timestampMs: 7_000 }),
    });

    expect(session.distanceMeters).toBeGreaterThan(5);
    expect(session.rejectedPointCount).toBe(0);

    session = runSessionReducer(session, {
      type: 'location',
      point: point({ longitude: 8, timestampMs: 8_000 }),
    });
    expect(session.rejectedPointCount).toBe(1);
  });

  it('rejects inaccurate samples', () => {
    let session = runSessionReducer(createEmptyRunSession(), {
      type: 'start',
      id: 'run-3',
      atMs: 1_000,
    });
    session = runSessionReducer(session, {
      type: 'location',
      point: point({ accuracyMeters: 100 }),
    });

    expect(session.points).toHaveLength(0);
    expect(session.rejectedPointCount).toBe(1);
  });

  it('formats time and pace for the running UI', () => {
    expect(formatDuration(3_661_000)).toBe('01:01:01');
    expect(formatPace(365)).toBe('6:05');
    expect(formatPace(null)).toBe('–:––');
  });
});
