import { useEffect } from 'react';

import { importPendingWatchRuns, subscribeToWatchRuns } from '../services/watch-run-inbox';

export function WatchRunInbox() {
  useEffect(() => {
    const reportError = (cause: unknown) => {
      console.warn('[BodyFuel watch] Lauf konnte nicht importiert werden:', cause);
    };
    void importPendingWatchRuns().catch(reportError);
    return subscribeToWatchRuns(reportError);
  }, []);

  return null;
}
