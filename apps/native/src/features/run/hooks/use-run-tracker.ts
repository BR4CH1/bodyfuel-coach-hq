import * as Crypto from 'expo-crypto';
import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import * as Speech from 'expo-speech';
import { useCallback, useEffect, useReducer, useRef, useState } from 'react';

import {
  disabledRunAlerts,
  evaluateRunAlert,
  type RunAlertKind,
  type RunAlertSettings,
} from '../domain/run-alerts';
import {
  createEmptyRunSession,
  runSessionReducer,
  snapshotRunSession,
  type LocationPoint,
} from '../domain/run-session';
import {
  clearRunDraft,
  loadRunDraft,
  saveCompletedRun,
  saveRunDraft,
} from '../services/run-draft';

type PermissionState = 'checking' | 'granted' | 'denied';

export function useRunTracker(alertSettings: RunAlertSettings = disabledRunAlerts) {
  const [session, dispatch] = useReducer(runSessionReducer, undefined, createEmptyRunSession);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [permission, setPermission] = useState<PermissionState>('checking');
  const [error, setError] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const sessionRef = useRef(session);
  const locationSubscription = useRef<Location.LocationSubscription | null>(null);
  const lastAlertAtMs = useRef<Partial<Record<RunAlertKind, number>>>({});

  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  useEffect(() => {
    let mounted = true;
    void Promise.all([Location.getForegroundPermissionsAsync(), loadRunDraft()]).then(
      ([permissionResult, draft]) => {
        if (!mounted) return;
        setPermission(permissionResult.granted ? 'granted' : 'denied');
        if (draft && (draft.status === 'running' || draft.status === 'paused')) {
          dispatch({ type: 'hydrate', session: draft });
        }
        setHydrated(true);
      },
    );
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setNowMs(Date.now()), 500);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const timer = setInterval(() => {
      const current = sessionRef.current;
      if (current.status === 'running' || current.status === 'paused') {
        const savedAtMs = Date.now();
        void saveRunDraft(snapshotRunSession(current, savedAtMs), savedAtMs).catch((cause) => {
          console.warn('[BodyFuel run] Entwurf konnte nicht gespeichert werden:', cause);
        });
      }
    }, 5_000);
    return () => clearInterval(timer);
  }, [hydrated]);

  useEffect(() => {
    if (session.status !== 'running') return;
    const alert = evaluateRunAlert({
      settings: alertSettings,
      currentPaceSecondsPerKm: session.currentPaceSecondsPerKm,
      heartRateBpm: session.heartRateBpm,
      nowMs,
      lastAlertAtMs: lastAlertAtMs.current,
    });
    if (!alert) return;

    lastAlertAtMs.current[alert.kind] = nowMs;
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    Speech.stop();
    Speech.speak(alert.message, { language: 'de-DE', rate: 0.95 });
  }, [alertSettings, nowMs, session.currentPaceSecondsPerKm, session.heartRateBpm, session.status]);

  const stopLocationWatch = useCallback(() => {
    locationSubscription.current?.remove();
    locationSubscription.current = null;
  }, []);

  useEffect(() => stopLocationWatch, [stopLocationWatch]);

  const startLocationWatch = useCallback(async () => {
    stopLocationWatch();
    locationSubscription.current = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.BestForNavigation,
        timeInterval: 1_000,
        distanceInterval: 3,
        mayShowUserSettingsDialog: true,
      },
      (location) => {
        const point: LocationPoint = {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          altitudeMeters: location.coords.altitude,
          accuracyMeters: location.coords.accuracy,
          speedMetersPerSecond: location.coords.speed,
          timestampMs: location.timestamp,
        };
        dispatch({ type: 'location', point });
      },
    );
  }, [stopLocationWatch]);

  const ensurePermission = useCallback(async () => {
    const result = await Location.requestForegroundPermissionsAsync();
    setPermission(result.granted ? 'granted' : 'denied');
    if (!result.granted) throw new Error('Standortfreigabe wurde nicht erteilt.');
  }, []);

  const start = useCallback(async () => {
    setError(null);
    try {
      await ensurePermission();
      dispatch({ type: 'start', id: Crypto.randomUUID(), atMs: Date.now() });
      await startLocationWatch();
    } catch (cause) {
      stopLocationWatch();
      dispatch({ type: 'pause', atMs: Date.now() });
      setError(cause instanceof Error ? cause.message : 'Der Lauf konnte nicht gestartet werden.');
    }
  }, [ensurePermission, startLocationWatch, stopLocationWatch]);

  const pause = useCallback(() => {
    stopLocationWatch();
    dispatch({ type: 'pause', atMs: Date.now() });
  }, [stopLocationWatch]);

  const resume = useCallback(async () => {
    setError(null);
    try {
      await ensurePermission();
      dispatch({ type: 'resume', atMs: Date.now() });
      await startLocationWatch();
    } catch (cause) {
      stopLocationWatch();
      setError(cause instanceof Error ? cause.message : 'Der Lauf konnte nicht fortgesetzt werden.');
    }
  }, [ensurePermission, startLocationWatch, stopLocationWatch]);

  const finish = useCallback(() => {
    stopLocationWatch();
    const event = { type: 'finish', atMs: Date.now() } as const;
    const completed = runSessionReducer(sessionRef.current, event);
    sessionRef.current = completed;
    dispatch(event);
    void Promise.all([saveCompletedRun(completed), clearRunDraft()]).catch((cause) => {
      console.warn('[BodyFuel run] Abschluss konnte nicht lokal gespeichert werden:', cause);
      setError('Der Lauf ist abgeschlossen, konnte aber nicht lokal gespeichert werden.');
    });
  }, [stopLocationWatch]);

  const reset = useCallback(() => {
    stopLocationWatch();
    dispatch({ type: 'reset' });
    void clearRunDraft();
  }, [stopLocationWatch]);

  return {
    session,
    nowMs,
    permission,
    error,
    start,
    pause,
    resume,
    finish,
    reset,
  };
}
