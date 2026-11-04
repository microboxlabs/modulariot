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

import {
  parseTelephonySetup,
  parseWebRtcToken,
  parseReconcileResult,
  type TelephonyProvider,
  type TelephonySetup,
} from "./telephony-api.types";
export type {
  TelephonyProvider,
  TelephonyLine,
  TelephonySetup,
} from "./telephony-api.types";

export const telephonyKey = `${CONTROL_TOWER_BASE}/telephony`;

export function useTelephony(enabled = true) {
  return useSWR<TelephonySetup>(
    enabled ? telephonyKey : null,
    async (path: string) => parseTelephonySetup(await request<unknown>(path)),
    { revalidateOnFocus: false, shouldRetryOnError: false }
  );
}

export async function saveTelephony(provider: TelephonyProvider | null) {
  const saved = parseTelephonySetup(
    await request<unknown>(telephonyKey, {
      method: "PUT",
      body: { provider },
    })
  );
  await mutate(telephonyKey, saved, { revalidate: false });
  return saved;
}

/** Asks for a Telnyx WebRTC login for the signed-in operator (24 hours). */
export async function fetchWebRtcToken() {
  return parseWebRtcToken(
    await request<unknown>(`${telephonyKey}/webrtc-token`, { method: "POST" })
  );
}

export type { ReconcileResult } from "./telephony-api.types";

/** Fills the signed-in operator's pending Teams calls from Graph's call records. */
export async function reconcileTeamsCalls() {
  return parseReconcileResult(
    await request<unknown>(`${telephonyKey}/reconcile`, { method: "POST" })
  );
}

/** Graph publishes PSTN records minutes after the call: ask again at these delays. */
export const RECONCILE_DELAYS_MS = [2 * 60_000, 10 * 60_000];

/**
 * Retries the reconcile after a Teams call is saved. Runs outside any
 * component, so it survives the panel closing. Each save gets its own
 * retries, including calls saved while an earlier schedule is running.
 */
export function scheduleTeamsReconcile(
  run: () => Promise<unknown> = reconcileTeamsCalls,
  delays: readonly number[] = RECONCILE_DELAYS_MS,
  timer: (cb: () => void, ms: number) => unknown = setTimeout
) {
  delays.forEach((ms) =>
    timer(() => {
      void run().catch(() => undefined);
    }, ms)
  );
}
