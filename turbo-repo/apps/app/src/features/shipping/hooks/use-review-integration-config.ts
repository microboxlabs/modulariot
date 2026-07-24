import { useCallback, useEffect, useState } from "react";
import {
  EMPTY_REVIEW_CONFIG,
  type ReviewIntegrationConfig,
} from "../components/lane/review-integration.types";

const STORAGE_KEY = "kanbanReviewIntegrationConfig";

/**
 * Per-lane review-integration config (mockup), keyed by the lane's stable
 * workflow title — the same key `use-lane-view-state` uses, and for the same
 * reason: board ids repeat across the shipping/planning/delivery boards.
 *
 * Client-only for now: this stands in for the backend that will own the config
 * and register the async job. Saving stamps a fake job id + timestamp so the UI
 * can show the "registered in async_jobs" outcome without a server.
 */
export function useReviewIntegrationConfig() {
  const [map, setMap] = useState<Record<string, ReviewIntegrationConfig>>({});

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        setMap(JSON.parse(raw) as Record<string, ReviewIntegrationConfig>);
      }
    } catch {
      // Ignore malformed persisted state and start fresh.
    }
  }, []);

  const getConfig = useCallback(
    (key: string): ReviewIntegrationConfig => map[key] ?? EMPTY_REVIEW_CONFIG,
    [map]
  );

  const saveConfig = useCallback(
    (key: string, config: ReviewIntegrationConfig) => {
      setMap((prev) => {
        const next = { ...prev, [key]: config };
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        } catch {
          // Storage may be unavailable (private mode); keep in-memory state.
        }
        return next;
      });
    },
    []
  );

  return { getConfig, saveConfig };
}

/**
 * Simulates registering the integration as an async job: mints a job id and
 * stamps the moment. The real backend will return these from the async_jobs
 * insert; here they just make the "registered" state concrete in the UI.
 */
export function registerAsyncJob(
  config: ReviewIntegrationConfig
): ReviewIntegrationConfig {
  const suffix = Math.random().toString(36).slice(2, 10);
  return {
    ...config,
    registeredJobId: config.registeredJobId ?? `job_review_${suffix}`,
    lastRegisteredAt: new Date().toISOString(),
  };
}
