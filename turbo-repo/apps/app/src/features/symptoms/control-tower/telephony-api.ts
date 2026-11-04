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
