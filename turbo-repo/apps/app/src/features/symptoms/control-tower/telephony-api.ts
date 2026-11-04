"use client";

/**
 * The organization's telephony for "Llamar a": its TELNYX and TEAMS_PHONE
 * connections, its choice, and the line calls use now. See
 * `OrgControlTowerTelephonyResource` in miot-symptoms.
 */

import useSWR, { mutate } from "swr";
import {
  CONTROL_TOWER_BASE,
  controlTowerRequest as request,
} from "./control-tower-api";

export type TelephonyProvider = "TELNYX" | "TEAMS_PHONE";

export interface TelephonyLine {
  connectionId: string;
  provider: TelephonyProvider;
  name: string;
  /** E.164, or null when the provider decides. */
  callerNumber: string | null;
  /** Whether the connection's last test passed. */
  ready: boolean;
  /** The platform's shared line, charged per minute. */
  managed?: boolean;
}

export interface TelephonySetup {
  /** What the organization chose; null lets the server pick (Telnyx first). */
  preferred: TelephonyProvider | null;
  /** The line calls use now; null opens the phone's dialer. */
  active: TelephonyLine | null;
  lines: TelephonyLine[];
}

export const telephonyKey = `${CONTROL_TOWER_BASE}/telephony`;

export function useTelephony(enabled = true) {
  return useSWR<TelephonySetup>(
    enabled ? telephonyKey : null,
    (path: string) => request<TelephonySetup>(path),
    { revalidateOnFocus: false, shouldRetryOnError: false }
  );
}

export async function saveTelephony(provider: TelephonyProvider | null) {
  const saved = await request<TelephonySetup>(telephonyKey, {
    method: "PUT",
    body: { provider },
  });
  await mutate(telephonyKey, saved, { revalidate: false });
  return saved;
}

/** Refusal codes of the token request (409). */
export const QUOTA_EXHAUSTED = "telephony_quota_exhausted";
export const CHANNELS_BUSY = "telephony_channels_busy";

/**
 * Asks for a Telnyx WebRTC login for the signed-in operator, for one call.
 * `callRef` is the call's usage row; the call carries it as client state.
 */
export function fetchWebRtcToken(
  call: { calleeNumber?: string; caseRef?: string } = {}
) {
  return request<{
    token: string;
    callerNumber: string;
    expiresAt: string;
    callRef?: string | null;
  }>(`${telephonyKey}/webrtc-token`, { method: "POST", body: call });
}

/** The browser's call ended; frees its channel. Telnyx still gives the billed seconds. */
export function reportCallEnded(
  callRef: string,
  providerCallId: string | null
) {
  return request<void>(
    `${telephonyKey}/calls/${encodeURIComponent(callRef)}/ended`,
    { method: "POST", body: { providerCallId } }
  );
}

export interface ReconcileResult {
  checked: number;
  recorded: number;
  pending: number;
}

/** Fills the signed-in operator's pending Teams calls from Graph's call records. */
export function reconcileTeamsCalls() {
  return request<ReconcileResult>(`${telephonyKey}/reconcile`, {
    method: "POST",
  });
}

/** Graph publishes PSTN records minutes after the call: ask again at these delays. */
export const RECONCILE_DELAYS_MS = [2 * 60_000, 10 * 60_000];

let scheduled = false;

/**
 * Retries the reconcile after a Teams call is saved. Runs outside any
 * component, so it survives the panel closing; one schedule at a time.
 */
export function scheduleTeamsReconcile(
  run: () => Promise<unknown> = reconcileTeamsCalls,
  delays: readonly number[] = RECONCILE_DELAYS_MS,
  timer: (cb: () => void, ms: number) => unknown = setTimeout
) {
  if (scheduled) return;
  scheduled = true;
  delays.forEach((ms, i) =>
    timer(() => {
      void run().catch(() => undefined);
      if (i === delays.length - 1) scheduled = false;
    }, ms)
  );
}
