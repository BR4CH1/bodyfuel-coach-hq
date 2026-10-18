export type RunStatus = 'idle' | 'running' | 'paused' | 'completed';

export type LocationPoint = {
  latitude: number;
  longitude: number;
  altitudeMeters: number | null;
  accuracyMeters: number | null;
  speedMetersPerSecond: number | null;
  timestampMs: number;
};

export type RunSession = {
  id: string | null;
  status: RunStatus;
  startedAtMs: number | null;
  endedAtMs: number | null;
  lastResumedAtMs: number | null;
  activeElapsedMs: number;
  distanceMeters: number;
  currentPaceSecondsPerKm: number | null;
  averagePaceSecondsPerKm: number | null;
  heartRateBpm: number | null;
  points: LocationPoint[];
  rejectedPointCount: number;
};

export type RunSessionEvent =
  | { type: 'start'; id: string; atMs: number }
  | { type: 'pause'; atMs: number }
  | { type: 'resume'; atMs: number }
  | { type: 'finish'; atMs: number }
  | { type: 'location'; point: LocationPoint }
  | { type: 'heart-rate'; bpm: number }
  | { type: 'hydrate'; session: RunSession }
  | { type: 'reset' };

const EARTH_RADIUS_METERS = 6_371_000;
const MAX_ACCEPTED_ACCURACY_METERS = 65;
const MAX_PLAUSIBLE_RUNNING_SPEED_METERS_PER_SECOND = 15;
const MIN_DISTANCE_STEP_METERS = 0.8;

export const createEmptyRunSession = (): RunSession => ({
  id: null,
  status: 'idle',
  startedAtMs: null,
  endedAtMs: null,
  lastResumedAtMs: null,
  activeElapsedMs: 0,
  distanceMeters: 0,
  currentPaceSecondsPerKm: null,
  averagePaceSecondsPerKm: null,
  heartRateBpm: null,
  points: [],
  rejectedPointCount: 0,
});

export function selectElapsedMs(session: RunSession, nowMs: number): number {
  if (session.status !== 'running' || session.lastResumedAtMs === null) {
    return session.activeElapsedMs;
  }

  return session.activeElapsedMs + Math.max(0, nowMs - session.lastResumedAtMs);
}

export function snapshotRunSession(session: RunSession, atMs: number): RunSession {
  if (session.status !== 'running') return session;

  return {
    ...session,
    activeElapsedMs: selectElapsedMs(session, atMs),
    lastResumedAtMs: atMs,
  };
}

export function recoverRunSession(session: RunSession): RunSession {
  if (session.status !== 'running') return session;

  return {
    ...session,
    status: 'paused',
    lastResumedAtMs: null,
  };
}

export function distanceBetweenMeters(a: LocationPoint, b: LocationPoint): number {
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
  const latitudeDelta = toRadians(b.latitude - a.latitude);
  const longitudeDelta = toRadians(b.longitude - a.longitude);
  const latitudeA = toRadians(a.latitude);
  const latitudeB = toRadians(b.latitude);

  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(latitudeA) * Math.cos(latitudeB) * Math.sin(longitudeDelta / 2) ** 2;

  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.sqrt(haversine));
}

function normalizeSpeed(speed: number | null): number | null {
  if (speed === null || !Number.isFinite(speed) || speed <= 0) return null;
  return speed <= MAX_PLAUSIBLE_RUNNING_SPEED_METERS_PER_SECOND ? speed : null;
}

function paceFromSpeed(speedMetersPerSecond: number | null): number | null {
  if (speedMetersPerSecond === null || speedMetersPerSecond < 0.5) return null;
  return 1000 / speedMetersPerSecond;
}

function addLocationPoint(session: RunSession, point: LocationPoint): RunSession {
  if (session.status !== 'running') return session;

  if (
    !Number.isFinite(point.latitude) ||
    !Number.isFinite(point.longitude) ||
    (point.accuracyMeters !== null && point.accuracyMeters > MAX_ACCEPTED_ACCURACY_METERS)
  ) {
    return { ...session, rejectedPointCount: session.rejectedPointCount + 1 };
  }

  const previous = session.points.at(-1);
  if (previous && point.timestampMs <= previous.timestampMs) {
    return { ...session, rejectedPointCount: session.rejectedPointCount + 1 };
  }

  if (!previous) {
    return { ...session, points: [point] };
  }

  const stepMeters = distanceBetweenMeters(previous, point);
  const seconds = (point.timestampMs - previous.timestampMs) / 1000;
  const derivedSpeed = seconds > 0 ? stepMeters / seconds : null;

  if (
    stepMeters > MIN_DISTANCE_STEP_METERS &&
    derivedSpeed !== null &&
    derivedSpeed > MAX_PLAUSIBLE_RUNNING_SPEED_METERS_PER_SECOND
  ) {
    return { ...session, rejectedPointCount: session.rejectedPointCount + 1 };
  }

  const acceptedStep = stepMeters >= MIN_DISTANCE_STEP_METERS ? stepMeters : 0;
  const distanceMeters = session.distanceMeters + acceptedStep;
  const elapsedMs = selectElapsedMs(session, point.timestampMs);
  const currentSpeed = normalizeSpeed(point.speedMetersPerSecond) ?? normalizeSpeed(derivedSpeed);
  const averagePaceSecondsPerKm =
    distanceMeters >= 20 && elapsedMs > 0
      ? elapsedMs / 1000 / (distanceMeters / 1000)
      : null;

  return {
    ...session,
    distanceMeters,
    currentPaceSecondsPerKm: paceFromSpeed(currentSpeed),
    averagePaceSecondsPerKm,
    points: [...session.points, point],
  };
}

export function runSessionReducer(session: RunSession, event: RunSessionEvent): RunSession {
  switch (event.type) {
    case 'start':
      if (session.status === 'running' || session.status === 'paused') return session;
      return {
        ...createEmptyRunSession(),
        id: event.id,
        status: 'running',
        startedAtMs: event.atMs,
        lastResumedAtMs: event.atMs,
      };
    case 'pause':
      if (session.status !== 'running') return session;
      return {
        ...session,
        status: 'paused',
        activeElapsedMs: selectElapsedMs(session, event.atMs),
        lastResumedAtMs: null,
      };
    case 'resume':
      if (session.status !== 'paused') return session;
      return { ...session, status: 'running', lastResumedAtMs: event.atMs };
    case 'finish':
      if (session.status !== 'running' && session.status !== 'paused') return session;
      return {
        ...session,
        status: 'completed',
        activeElapsedMs: selectElapsedMs(session, event.atMs),
        lastResumedAtMs: null,
        endedAtMs: event.atMs,
      };
    case 'location':
      return addLocationPoint(session, event.point);
    case 'heart-rate':
      if (!Number.isFinite(event.bpm) || event.bpm < 30 || event.bpm > 250) return session;
      return { ...session, heartRateBpm: Math.round(event.bpm) };
    case 'hydrate':
      return recoverRunSession(event.session);
    case 'reset':
      return createEmptyRunSession();
  }
}

export function formatDuration(elapsedMs: number): string {
  const totalSeconds = Math.max(0, Math.floor(elapsedMs / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return [hours, minutes, seconds].map((part) => part.toString().padStart(2, '0')).join(':');
}

export function formatPace(secondsPerKm: number | null): string {
  if (secondsPerKm === null || !Number.isFinite(secondsPerKm) || secondsPerKm <= 0) return '–:––';
  const rounded = Math.round(secondsPerKm);
  const minutes = Math.floor(rounded / 60);
  const seconds = rounded % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}
