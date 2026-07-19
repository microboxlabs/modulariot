"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import { useRuntimeConfig } from "@/features/runtime-config/runtime-config-context";
import { useIntegrationJobsOverview, useRevalidateJobs } from "./use-integration-jobs";
import {
  connectJobEvents,
  getJobEventsServerSnapshot,
  getJobEventsSnapshot,
  markJobEventsSeen,
  subscribeJobEvents,
  type JobEventsSnapshot,
} from "./job-events-store";

/**
 * Live `integrations.job` feed for an org.
 *
 * Fetches the console overview (which carries the SSE subscription context —
 * tenantId + eventType), keeps the shared tenant stream connected, and
 * debounce-revalidates the jobs SWR keys whenever a frame arrives so the
 * console table, tiles and bell stay current without polling.
 */
export function useJobEvents(orgSlug: string | null): JobEventsSnapshot & {
  liveConfigured: boolean;
  markAllSeen: () => void;
} {
  const runtimeConfig = useRuntimeConfig();
  const { overview } = useIntegrationJobsOverview(orgSlug);
  const revalidate = useRevalidateJobs(orgSlug);
  const debounceRef = useRef<number | null>(null);

  const snapshot = useSyncExternalStore(
    subscribeJobEvents,
    getJobEventsSnapshot,
    getJobEventsServerSnapshot,
  );

  useEffect(() => {
    if (!runtimeConfig?.ECM_PUBLIC_URL || !overview?.liveEventsConfigured || !overview.tenantId) {
      return;
    }
    connectJobEvents(runtimeConfig.ECM_PUBLIC_URL, overview.tenantId, overview.eventType);
  }, [runtimeConfig, overview]);

  const eventCount = snapshot.events.length;
  const latestId = snapshot.events[0]?.id;
  useEffect(() => {
    if (!eventCount || !latestId) return;
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
  }, [eventCount, latestId, revalidate]);

  return {
    ...snapshot,
    liveConfigured: overview?.liveEventsConfigured ?? false,
    markAllSeen: markJobEventsSeen,
  };
}
