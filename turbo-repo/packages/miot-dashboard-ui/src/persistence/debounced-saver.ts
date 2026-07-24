/**
 * Debounced dashboard persistence engine (Seam E behavior, host-agnostic).
 *
 * Extracted from the app's `use-dashboard-storage.ts`: coalesces rapid edits
 * into one save, retries with exponential backoff, and flushes a pending save
 * on teardown via the store's `saveBeacon` (falling back to a best-effort
 * `save`). Pure TS — no React — so hosts and tests drive it directly.
 *
 * Behavior parity notes (load-bearing, preserved exactly):
 * - `editMode` is stripped before every persist (ephemeral UI state).
 * - The target ref is resolved at dispatch time via `getRef()`, not captured
 *   at schedule time (mirrors the original `siteIdRef.current` semantics).
 * - Retry delays are `retryBaseMs * 2^attempt`; failures beyond the last
 *   retry are reported, never thrown (saves are background work).
 */

import type { DashboardStorageSchema } from "../types/dashboard";
import type { DashboardRef, DashboardStore } from "../adapters/store";

/** Strip ephemeral UI state (editMode) from a config before persisting. */
export function stripEphemeralState(
  data: DashboardStorageSchema
): DashboardStorageSchema {
  return {
    ...data,
    preferences: { ...data.preferences, editMode: false },
  };
}

export const DASHBOARD_SAVE_DEBOUNCE_MS = 2000;
export const DASHBOARD_SAVE_MAX_RETRIES = 3;
export const DASHBOARD_SAVE_RETRY_BASE_MS = 1000;

export interface DebouncedDashboardSaverOptions {
  store: DashboardStore;
  /**
   * Resolve the save target at dispatch time; return null to skip persistence
   * entirely (e.g. no scope selected).
   */
  getRef: () => DashboardRef | null;
  debounceMs?: number;
  maxRetries?: number;
  retryBaseMs?: number;
  /** Called before each retry (default: console.warn, matching legacy). */
  onRetry?: (error: unknown, nextAttempt: number, delayMs: number) => void;
  /** Called when all retries are exhausted (default: console.error). */
  onSaveError?: (error: unknown) => void;
}

export interface DebouncedDashboardSaver {
  /** Schedule a debounced save of this config (coalesces prior schedules). */
  schedule(config: DashboardStorageSchema): void;
  /** Save any pending config immediately (clears the debounce timer). */
  flush(): Promise<void>;
  /**
   * Cancel the timer and beacon-flush any pending config. Call on unmount /
   * page teardown.
   */
  teardown(): void;
  hasPending(): boolean;
}

export function createDebouncedDashboardSaver(
  options: DebouncedDashboardSaverOptions
): DebouncedDashboardSaver {
  const {
    store,
    getRef,
    debounceMs = DASHBOARD_SAVE_DEBOUNCE_MS,
    maxRetries = DASHBOARD_SAVE_MAX_RETRIES,
    retryBaseMs = DASHBOARD_SAVE_RETRY_BASE_MS,
    onRetry = (error, nextAttempt, delayMs) =>
      console.warn(
        `Dashboard save failed, retrying in ${delayMs}ms (attempt ${nextAttempt}/${maxRetries})`,
        error
      ),
    onSaveError = (error) =>
      console.error("Failed to save dashboard config after retries:", error),
  } = options;

  let timer: ReturnType<typeof setTimeout> | null = null;
  let pending: DashboardStorageSchema | null = null;

  async function saveWithRetry(
    ref: DashboardRef,
    config: DashboardStorageSchema,
    attempt = 0
  ): Promise<void> {
    try {
      await store.save(ref, config);
    } catch (error) {
      if (attempt < maxRetries - 1) {
        const delayMs = retryBaseMs * 2 ** attempt;
        onRetry(error, attempt + 2, delayMs);
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        return saveWithRetry(ref, config, attempt + 1);
      }
      onSaveError(error);
    }
  }

  function dispatchPending(): Promise<void> {
    const config = pending;
    pending = null;
    const ref = getRef();
    if (!config || !ref) return Promise.resolve();
    return saveWithRetry(ref, stripEphemeralState(config));
  }

  return {
    schedule(config) {
      if (!getRef()) return;
      pending = config;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = null;
        void dispatchPending();
      }, debounceMs);
    },

    async flush() {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      await dispatchPending();
    },

    teardown() {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      const config = pending;
      pending = null;
      const ref = getRef();
      if (!config || !ref) return;
      const stripped = stripEphemeralState(config);
      if (store.saveBeacon) {
        store.saveBeacon(ref, stripped);
      } else {
        // Best-effort: no beacon transport available.
        void store.save(ref, stripped).catch(() => {});
      }
    },

    hasPending() {
      return pending !== null;
    },
  };
}
