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
