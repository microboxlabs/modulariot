"use client";

import type { JobEventPayload } from "./integration-job.types";

/**
 * Module-level store for live `integrations.job` events.
 *
 * One shared EventSource per organization (same singleton pattern as
 * `sse-listener.tsx`), on the app's relay of the modulith's job stream
 * (`/api/admin/orgs/{org}/integrations/jobs/events`). Consumers (job console page, notification bell)
 * read a bounded in-memory feed via useSyncExternalStore-compatible
 * subscribe/getSnapshot functions.
 */

export interface JobActivityEntry {
  readonly id: string;
  readonly receivedAt: number;
  readonly payload: JobEventPayload;
}

export interface JobEventsSnapshot {
  readonly connected: boolean;
  readonly events: readonly JobActivityEntry[];
  readonly unseen: number;
}

const MAX_EVENTS = 50;
/** Transitions worth surfacing in the bell (claims are too chatty). */
const NOTIFY_TRANSITIONS = new Set([
  "enqueued",
  "succeeded",
  "retry_scheduled",
  "failed",
  "retried",
]);

let eventSource: EventSource | null = null;
let connectedUrl: string | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let sequence = 0;

let snapshot: JobEventsSnapshot = { connected: false, events: [], unseen: 0 };
const listeners = new Set<() => void>();

function publish(next: Partial<JobEventsSnapshot>): void {
  snapshot = { ...snapshot, ...next };
  listeners.forEach((listener) => listener());
}

export function subscribeJobEvents(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getJobEventsSnapshot(
  streamUrl?: string | null
): JobEventsSnapshot {
  if (
    streamUrl === null ||
    (streamUrl !== undefined && streamUrl !== connectedUrl)
  ) {
    return SERVER_SNAPSHOT;
  }
  return snapshot;
}

/** Server snapshot (SSR): nothing connected, empty feed. */
const SERVER_SNAPSHOT: JobEventsSnapshot = {
  connected: false,
  events: [],
  unseen: 0,
};
export function getJobEventsServerSnapshot(): JobEventsSnapshot {
  return SERVER_SNAPSHOT;
}

export function markJobEventsSeen(): void {
  if (snapshot.unseen > 0) {
    publish({ unseen: 0 });
  }
}

/**
 * Ensures the shared stream at {@code streamUrl} is connected. Safe to call from
 * every consumer render; reconnects only when the organization's stream changes.
 */
export function connectJobEvents(streamUrl: string): void {
  if (globalThis.window === undefined) return;
  if (eventSource && connectedUrl === streamUrl) return;

  clearReconnectTimer();
  const previous = eventSource;
  eventSource = null;
  previous?.close();
  const changedOrg = connectedUrl !== streamUrl;
  connectedUrl = streamUrl;
  const source = new EventSource(streamUrl);
  eventSource = source;
  if (changedOrg) publish({ connected: false, events: [], unseen: 0 });

  source.onopen = () => {
    if (eventSource === source) publish({ connected: true });
  };
  source.onerror = () => {
    if (eventSource !== source) return;
    publish({ connected: false });
    // CONNECTING retries natively. Fatal HTTP refusals enter CLOSED and need a fresh source.
    if (source.readyState !== EventSource.CLOSED || reconnectTimer !== null)
      return;
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      if (eventSource !== source || connectedUrl !== streamUrl) return;
      eventSource = null;
      source.close();
      connectJobEvents(streamUrl);
    }, 5000);
  };

  source.onmessage = (message) => {
    if (eventSource !== source) return;
    let payload: JobEventPayload | null = null;
    try {
      const frame = JSON.parse(message.data) as {
        eventType?: string;
        payload?: JobEventPayload;
      };
      payload = frame.payload ?? null;
    } catch {
      return; // ignore malformed frames
    }
    if (!payload?.jobId || !payload.transition) return;

    const entry: JobActivityEntry = {
      id: `jev-${++sequence}`,
      receivedAt: Date.now(),
      payload,
    };
    const events = [entry, ...snapshot.events].slice(0, MAX_EVENTS);
    const unseen = NOTIFY_TRANSITIONS.has(payload.transition)
      ? snapshot.unseen + 1
      : snapshot.unseen;
    publish({ connected: true, events, unseen });
  };
}

function clearReconnectTimer(): void {
  if (reconnectTimer !== null) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
}

/** Test-only: reset module state between tests. */
export function resetJobEventsStoreForTests(): void {
  clearReconnectTimer();
  const previous = eventSource;
  eventSource = null;
  connectedUrl = null;
  previous?.close();
  sequence = 0;
  snapshot = { connected: false, events: [], unseen: 0 };
  listeners.clear();
}

/** Test-only: inject an event as if it arrived on the stream. */
export function pushJobEventForTests(payload: JobEventPayload): void {
  const entry: JobActivityEntry = {
    id: `jev-${++sequence}`,
    receivedAt: Date.now(),
    payload,
  };
  const events = [entry, ...snapshot.events].slice(0, MAX_EVENTS);
  const unseen = NOTIFY_TRANSITIONS.has(payload.transition)
    ? snapshot.unseen + 1
    : snapshot.unseen;
  publish({ connected: true, events, unseen });
}
