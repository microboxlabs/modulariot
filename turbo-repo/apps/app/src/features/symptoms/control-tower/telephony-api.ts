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
  parseCallOutcome,
  parseInboundCalls,
  parseTelephonySetup,
  parseWebRtcToken,
  parseReconcileResult,
  type InboundWhatsAppCall,
  type TelephonyProvider,
  type TelephonySetup,
} from "./telephony-api.types";
export type {
  CallOutcome,
  InboundWhatsAppCall,
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

/** Refusal codes of the token request (409). */
export const QUOTA_EXHAUSTED = "telephony_quota_exhausted";
export const CHANNELS_BUSY = "telephony_channels_busy";
export const WHATSAPP_NO_PERMISSION = "whatsapp_no_permission";
export const WHATSAPP_UNAVAILABLE = "whatsapp_calling_unavailable";
export const WHATSAPP_CALL_TAKEN = "whatsapp_call_taken";

/** Refusals the dialing step explains in words; any other shows the provider's message. */
export const KNOWN_REFUSALS: readonly string[] = [
  QUOTA_EXHAUSTED,
  CHANNELS_BUSY,
  WHATSAPP_NO_PERMISSION,
  WHATSAPP_UNAVAILABLE,
  WHATSAPP_CALL_TAKEN,
];

/**
 * Reserves a managed call and requests the operator's reusable Telnyx login.
 * With `channel: "WHATSAPP"` the server calls the number on WhatsApp.
 */
export async function fetchWebRtcToken(
  call: { calleeNumber?: string; caseRef?: string; channel?: "WHATSAPP" } = {}
) {
  return parseWebRtcToken(
    await request<unknown>(`${telephonyKey}/webrtc-token`, {
      method: "POST",
      body: call,
    })
  );
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

/** Why the provider ended a call before it connected (e.g. whatsapp_no_permission). */
export async function fetchCallOutcome(callRef: string) {
  return parseCallOutcome(
    await request<unknown>(
      `${telephonyKey}/calls/${encodeURIComponent(callRef)}`
    )
  );
}

export const ringingWhatsAppCallsKey = `${telephonyKey}/whatsapp-calls`;

/** WhatsApp calls from contacts ringing in the tower; polled only while WhatsApp calling is on. */
export function useRingingWhatsAppCalls(enabled: boolean, intervalMs = 4000) {
  return useSWR<InboundWhatsAppCall[]>(
    enabled ? ringingWhatsAppCallsKey : null,
    async (path: string) => parseInboundCalls(await request<unknown>(path)),
    {
      refreshInterval: intervalMs,
      revalidateOnFocus: true,
      shouldRetryOnError: false,
    }
  );
}

/** A login to take a ringing WhatsApp call; dial with it like any Telnyx call. */
export async function answerWhatsAppCall(callId: string) {
  return parseWebRtcToken(
    await request<unknown>(
      `${ringingWhatsAppCallsKey}/${encodeURIComponent(callId)}/answer`,
      { method: "POST" }
    )
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
