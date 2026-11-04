/**
 * TELNYX and TEAMS_PHONE connections: telephony for the Control Tower's calls.
 * The API key or client secret lives in the linked credential; the connection
 * keeps only the non-secret values in `metadata`.
 */

export const TELEPHONY_PROVIDERS = ["TELNYX", "TEAMS_PHONE"] as const;
export type TelephonyProvider = (typeof TELEPHONY_PROVIDERS)[number];

export function isTelephonyProvider(
  value: string | undefined | null
): value is TelephonyProvider {
  return (
    TELEPHONY_PROVIDERS as readonly (string | null | undefined)[]
  ).includes(value);
}

/** The only API each provider's credential is sent to (the server checks it too). */
export const TELEPHONY_BASE_URLS: Record<TelephonyProvider, string> = {
  TELNYX: "https://api.telnyx.com",
  TEAMS_PHONE: "https://graph.microsoft.com",
};

/** The credential type each provider takes. */
export const TELEPHONY_CREDENTIAL_TYPES: Record<TelephonyProvider, string> = {
  TELNYX: "TELNYX",
  TEAMS_PHONE: "AZURE_ENTRA_CLIENT_CREDENTIALS",
};

export interface TelephonyValues {
  readonly sipConnectionId: string;
  readonly callerNumber: string;
  readonly defaultCallerId: string;
  /** Telnyx: calls at once on the line; empty is 10. */
  readonly channelLimit: string;
  /** Telnyx: the webhook public key (ed25519, base64). Public, so in metadata. */
  readonly webhookPublicKey: string;
}

export const EMPTY_TELEPHONY: TelephonyValues = {
  sipConnectionId: "",
  callerNumber: "",
  defaultCallerId: "",
  channelLimit: "",
  webhookPublicKey: "",
};

/** The number without spaces, dots, dashes or parentheses, or null when it is not E.164. */
export function e164(value: string): string | null {
  const compact = value.trim().replace(/[\s().-]/g, "");
  return /^\+[1-9]\d{6,14}$/.test(compact) ? compact : null;
}

export function telephonyValues(
  metadata: Record<string, unknown> | undefined
): TelephonyValues {
  const text = (key: string) => {
    const value = metadata?.[key];
    return typeof value === "string" || typeof value === "number"
      ? String(value)
      : "";
  };
  return {
    sipConnectionId: text("sipConnectionId"),
    callerNumber: text("callerNumber"),
    defaultCallerId: text("defaultCallerId"),
    channelLimit: text("channelLimit"),
    webhookPublicKey: text("webhookPublicKey"),
  };
}

/** The i18n key (under `pages.integrationConnections`) of the first problem, or null. */
export function telephonyProblem(
  provider: TelephonyProvider,
  values: TelephonyValues
): string | null {
  if (provider === "TELNYX") {
    if (!values.sipConnectionId.trim())
      return "telephony.sipConnectionIdRequired";
    if (!e164(values.callerNumber)) return "telephony.callerNumberInvalid";
    const limit = values.channelLimit.trim();
    if (limit && !/^[1-9]\d*$/.test(limit))
      return "telephony.channelLimitInvalid";
    return null;
  }
  if (values.defaultCallerId.trim() && !e164(values.defaultCallerId))
    return "telephony.callerNumberInvalid";
  return null;
}

/** What the connection stores in `metadata`, numbers in E.164. */
export function telephonyMetadata(
  provider: TelephonyProvider,
  values: TelephonyValues
): Record<string, string> {
  if (provider === "TELNYX") {
    const limit = values.channelLimit.trim();
    const key = values.webhookPublicKey.trim();
    return {
      sipConnectionId: values.sipConnectionId.trim(),
      callerNumber: e164(values.callerNumber) ?? values.callerNumber.trim(),
      ...(limit ? { channelLimit: limit } : {}),
      ...(key ? { webhookPublicKey: key } : {}),
    };
  }
  const callerId = e164(values.defaultCallerId);
  return callerId ? { defaultCallerId: callerId } : {};
}
