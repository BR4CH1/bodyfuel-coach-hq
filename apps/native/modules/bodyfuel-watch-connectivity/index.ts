import { requireOptionalNativeModule } from 'expo';
import { Platform } from 'react-native';

export type WatchRunSummary = {
  id: string;
  startedAtMs: number;
  endedAtMs: number;
  elapsedSeconds: number;
  distanceMeters: number;
  averageHeartRateBpm?: number;
  activeEnergyKilocalories: number;
  source: 'watch';
};

export type WatchAvailability = {
  supported: boolean;
  paired: boolean;
  watchAppInstalled: boolean;
  reachable: boolean;
};

interface WatchConnectivityNativeModule {
  getAvailabilityAsync(): Promise<WatchAvailability>;
  getPendingSummariesAsync(): Promise<WatchRunSummary[]>;
  acknowledgeSummariesAsync(ids: string[]): Promise<void>;
  addListener(
    eventName: 'onRunSummary',
    listener: (summary: WatchRunSummary) => void,
  ): { remove(): void };
}

const nativeModule =
  Platform.OS === 'ios'
    ? requireOptionalNativeModule<WatchConnectivityNativeModule>('BodyFuelWatchConnectivity')
    : null;

export async function getWatchAvailability(): Promise<WatchAvailability> {
  return (
    (await nativeModule?.getAvailabilityAsync()) ?? {
      supported: false,
      paired: false,
      watchAppInstalled: false,
      reachable: false,
    }
  );
}

export async function getPendingWatchRuns(): Promise<WatchRunSummary[]> {
  return (await nativeModule?.getPendingSummariesAsync()) ?? [];
}

export async function acknowledgeWatchRuns(ids: string[]): Promise<void> {
  await nativeModule?.acknowledgeSummariesAsync(ids);
}

export function addWatchRunListener(listener: (summary: WatchRunSummary) => void) {
  return nativeModule?.addListener('onRunSummary', listener) ?? null;
}
