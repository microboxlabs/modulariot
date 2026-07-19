"use client";

import type { JobEventPayload } from "./integration-job.types";

/**
 * Module-level store for live `integrations.job` events.
 *
 * One shared EventSource per tenant stream (same singleton pattern as
 * `sse-listener.tsx`), subscribed to the type-filtered endpoint
 * `{ECM_PUBLIC_URL}/api/v1/events/tenant/{tenantId}/stream/integrations.job`
 * served by quarkus-sse. Consumers (job console page, notification bell)
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
const NOTIFY_TRANSITIONS = new Set(["enqueued", "succeeded", "retry_scheduled", "failed", "retried"]);

let eventSource: EventSource | null = null;
let connectedTenant: string | null = null;
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

export function getJobEventsSnapshot(): JobEventsSnapshot {
  return snapshot;
}

/** Server snapshot (SSR): nothing connected, empty feed. */
const SERVER_SNAPSHOT: JobEventsSnapshot = { connected: false, events: [], unseen: 0 };
export function getJobEventsServerSnapshot(): JobEventsSnapshot {
  return SERVER_SNAPSHOT;
}

export function markJobEventsSeen(): void {
  if (snapshot.unseen > 0) {
    publish({ unseen: 0 });
  }
}

/**
 * Ensures the shared stream is connected for the tenant. Safe to call from
 * every consumer render; reconnects only when the tenant changes.
 */
export function connectJobEvents(ecmPublicUrl: string, tenantId: string, eventType: string): void {
  if (globalThis.window === undefined) return;
  if (eventSource && connectedTenant === tenantId) return;

  eventSource?.close();
  connectedTenant = tenantId;
  eventSource = new EventSource(
    `${ecmPublicUrl}/api/v1/events/tenant/${encodeURIComponent(tenantId)}/stream/${encodeURIComponent(eventType)}`,
  );

  eventSource.onopen = () => publish({ connected: true });
  eventSource.onerror = () => publish({ connected: false }); // EventSource auto-reconnects

  eventSource.onmessage = (message) => {
    let payload: JobEventPayload | null = null;
    try {
      const frame = JSON.parse(message.data) as { eventType?: string; payload?: JobEventPayload };
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
    const unseen = NOTIFY_TRANSITIONS.has(payload.transition) ? snapshot.unseen + 1 : snapshot.unseen;
    publish({ connected: true, events, unseen });
  };
}

/** Test-only: reset module state between tests. */
export function resetJobEventsStoreForTests(): void {
  eventSource?.close();
  eventSource = null;
  connectedTenant = null;
  sequence = 0;
  snapshot = { connected: false, events: [], unseen: 0 };
  listeners.clear();
}

/** Test-only: inject an event as if it arrived on the stream. */
export function pushJobEventForTests(payload: JobEventPayload): void {
  const entry: JobActivityEntry = { id: `jev-${++sequence}`, receivedAt: Date.now(), payload };
  const events = [entry, ...snapshot.events].slice(0, MAX_EVENTS);
  const unseen = NOTIFY_TRANSITIONS.has(payload.transition) ? snapshot.unseen + 1 : snapshot.unseen;
  publish({ connected: true, events, unseen });
}
