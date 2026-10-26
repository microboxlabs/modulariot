"use client";

import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";
import {
  useIntegrationJobsOverview,
  useRevalidateJobs,
} from "./use-integration-jobs";
import {
  connectJobEvents,
  getJobEventsServerSnapshot,
  getJobEventsSnapshot,
  markJobEventsSeen,
  subscribeJobEvents,
  type JobEventsSnapshot,
} from "./job-events-store";
import { jobEventsUrl } from "./integration-jobs-data-service";

/**
 * Live `integrations.job` feed for an org.
 *
 * Fetches the console overview (which says whether the modulith streams job
 * events), keeps the org's shared stream connected, and
 * debounce-revalidates the jobs SWR keys whenever a frame arrives so the
 * console table, tiles and bell stay current without polling.
 */
export function useJobEvents(orgSlug: string | null): JobEventsSnapshot & {
  liveConfigured: boolean;
  markAllSeen: () => void;
} {
  const { overview } = useIntegrationJobsOverview(orgSlug);
  const revalidate = useRevalidateJobs(orgSlug);
  const debounceRef = useRef<number | null>(null);
  const streamUrl = orgSlug ? jobEventsUrl(orgSlug) : null;
  const readSnapshot = useCallback(
    () => getJobEventsSnapshot(streamUrl),
    [streamUrl]
  );

  const snapshot = useSyncExternalStore(
    subscribeJobEvents,
    readSnapshot,
    getJobEventsServerSnapshot
  );

  useEffect(() => {
    if (!orgSlug || !overview?.liveEventsConfigured) return;
    connectJobEvents(jobEventsUrl(orgSlug));
  }, [orgSlug, overview]);

  const eventCount = snapshot.events.length;
  const latestId = snapshot.events[0]?.id;
  useEffect(() => {
    // Re-read the ledger after reconnect too: transitions can be missed while the stream is down.
    if (!snapshot.connected) return;
    if (debounceRef.current != null) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => {
      debounceRef.current = null;
      revalidate();
    }, 400);
    return () => {
      if (debounceRef.current != null) {
        window.clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
    };
  }, [snapshot.connected, eventCount, latestId, revalidate]);

  return {
    ...snapshot,
    liveConfigured: overview?.liveEventsConfigured ?? false,
    markAllSeen: markJobEventsSeen,
  };
}
