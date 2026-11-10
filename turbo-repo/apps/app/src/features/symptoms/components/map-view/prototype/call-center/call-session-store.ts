/**
 * The active call as kept in sessionStorage, so a reload can restore its bar
 * and timer. Only ids, times and what the operator saw are kept: never the
 * WebRTC login token.
 */

import { z } from "zod/v3";
import type { CallMethod } from "./call-method";
import type { CallScript } from "./call-center-menu";
import type { CallTarget } from "./call-targets";
import type { CallPhase, TelephonyCallResult } from "./telnyx-call";

/** How the call is placed: timed by hand, opened in Teams, or dialed from the browser. */
export type CallKind = "manual" | "teams" | "telnyx";

/**
 * live: on the line. ended: over, waiting for the results form.
 * dropped: a browser call cut by a reload. failed: a browser call that did not start.
 */
export type CallStatus = "live" | "ended" | "dropped" | "failed";

/** What the case panel knows about the call; the bar shows it and the panel restores from it. */
export interface CallContext {
  caseId: string | null;
  /** The case page to go back to, with the call panel open. */
  caseHref: string | null;
  /** Plate or case name shown in the bar. */
  caseLabel: string | null;
  target: CallTarget | null;
  script: CallScript | null;
  /** The treatment's default message, kept to restore it after the call. */
  defaultMessage: string;
  /** The message shown as the script while calling. */
  message: string;
}

export interface CallResult {
  durationSeconds: number;
  method: CallMethod;
  telephony: TelephonyCallResult | null;
}

export interface ActiveCall {
  /** One id per call attempt. */
  id: string;
  /** Who and what this call is for: the dialing step that owns it. */
  key: string;
  context: CallContext;
  contactName: string;
  contactRole: string;
  method: CallMethod;
  kind: CallKind;
  status: CallStatus;
  startedAt: number;
  phase: CallPhase | null;
  answeredAt: number | null;
  /** The browser call can be hung up. */
  dialReady: boolean;
  /** The usage row of a managed call. */
  callRef: string | null;
  providerCallId: string | null;
  calleeNumber: string | null;
  teamsConnectionId: string | null;
  /** i18n key (under `symptoms.`) shown instead of the timer. */
  notice: string | null;
  error: { refusal: string | null; message: string | null } | null;
  result: CallResult | null;
  muted: boolean;
  /** When the page was left; a dropped call's time ends here. */
  leftAt: number | null;
}

export const CALL_SESSION_STORAGE_KEY = "miot.call-session.v1";

type StorageLike = Pick<
  Storage,
  "getItem" | "setItem" | "removeItem" | "length" | "key"
>;

function storage(): StorageLike | null {
  try {
    return globalThis.window === undefined ? null : window.sessionStorage;
  } catch {
    return null;
  }
}

/** Signing out must discard call details, including calls saved in other organizations. */
export function clearSavedCalls(store = storage()) {
  if (!store) return;
  try {
    for (let index = store.length - 1; index >= 0; index--) {
      const key = store.key(index);
      if (
        key === CALL_SESSION_STORAGE_KEY ||
        key?.startsWith(`${CALL_SESSION_STORAGE_KEY}:`)
      )
        store.removeItem(key);
    }
  } catch {
    // Storage may be blocked; signing out must still work.
  }
}

export function saveCall(
  call: ActiveCall | null,
  key = CALL_SESSION_STORAGE_KEY,
  store = storage()
) {
  if (!store) return;
  try {
    if (call) store.setItem(key, JSON.stringify(call));
    else store.removeItem(key);
  } catch {
    // Full or blocked storage: the call still works, it just won't survive a reload.
  }
}

const methodSchema = z.enum(["phone", "whatsapp", "meet", "teams"]);
const timestampSchema = z.number().min(0).max(8_640_000_000_000_000);
const secondsSchema = z.number().nonnegative().finite();
const callStatsSchema = z.object({
  lastCallAt: z
    .string()
    .datetime({ offset: true })
    .transform((s) => new Date(s))
    .nullable(),
  accepted: secondsSchema,
  denied: secondsSchema,
});
const partsSchema = z.array(
  z.union([z.object({ text: z.string() }), z.object({ blank: z.string() })])
);
const telephonySchema = z.object({
  provider: z.enum(["TELNYX", "TEAMS_PHONE"]),
  status: z.enum(["RECORDED", "PENDING"]).optional(),
  answered: z.boolean(),
  durationSeconds: secondsSchema,
  hangupCause: z.string().nullable(),
  sipCode: z.number().finite().nullable(),
  callId: z.string().nullable(),
  connectionId: z.string().optional(),
  calleeNumber: z.string(),
  startedAt: z.string().datetime({ offset: true }),
  endedAt: z.string().datetime({ offset: true }).optional(),
});

/** Storage can be stale or malformed; validate everything the bar and form read. */
const storedCallSchema = z.object({
  id: z.string(),
  key: z.string(),
  context: z.object({
    caseId: z.string().nullable(),
    caseHref: z.string().startsWith("/").nullable(),
    caseLabel: z.string().nullable(),
    target: z
      .object({
        id: z.string(),
        contactId: z.string().optional(),
        personName: z.string(),
        role: z.string(),
        phone: z.string(),
        channels: z
          .object({
            phone: z.string().optional(),
            whatsapp: z.string().optional(),
            meet: z.string().optional(),
            teams: z.string().optional(),
            email: z.string().optional(),
          })
          .nullable()
          .optional(),
        company: z.string().nullable().optional(),
        companyRut: z.string().nullable().optional(),
        nationalId: z.string().nullable().optional(),
        methods: z.array(methodSchema),
        stats: callStatsSchema.nullable(),
        history: callStatsSchema.nullable().optional(),
      })
      .nullable(),
    script: z
      .object({
        message: z.string(),
        goal: z.string(),
        messageParts: partsSchema.optional(),
        goalParts: partsSchema.optional(),
      })
      .nullable(),
    defaultMessage: z.string(),
    message: z.string(),
  }),
  contactName: z.string(),
  contactRole: z.string(),
  method: methodSchema,
  kind: z.enum(["manual", "teams", "telnyx"]),
  status: z.enum(["live", "ended", "dropped", "failed"]),
  startedAt: timestampSchema,
  phase: z.enum(["connecting", "ringing", "active", "ended"]).nullable(),
  answeredAt: timestampSchema.nullable(),
  dialReady: z.boolean(),
  callRef: z.string().nullable(),
  providerCallId: z.string().nullable(),
  calleeNumber: z.string().nullable(),
  teamsConnectionId: z.string().nullable(),
  notice: z.string().nullable(),
  error: z
    .object({ refusal: z.string().nullable(), message: z.string().nullable() })
    .nullable(),
  result: z
    .object({
      durationSeconds: secondsSchema,
      method: methodSchema,
      telephony: telephonySchema.nullable(),
    })
    .nullable(),
  muted: z.boolean(),
  leftAt: timestampSchema.nullable(),
});

export function loadCall(
  key = CALL_SESSION_STORAGE_KEY,
  store = storage()
): ActiveCall | null {
  if (!store) return null;
  let raw: string | null;
  try {
    raw = store.getItem(key);
  } catch {
    return null;
  }
  if (!raw) return null;
  try {
    const parsed = storedCallSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

/** A browser call cannot outlive its page: after a reload it is reported as cut. */
export function dropAfterReload(call: ActiveCall, now: number): ActiveCall {
  if (call.kind !== "telnyx" || call.status !== "live") return call;
  const endedAt = call.leftAt ?? now;
  const answered = call.answeredAt !== null;
  const durationSeconds = answered
    ? Math.max(0, Math.round((endedAt - (call.answeredAt ?? endedAt)) / 1000))
    : 0;
  const telephony: TelephonyCallResult | null = call.providerCallId
    ? {
        provider: "TELNYX",
        answered,
        durationSeconds,
        hangupCause: "PAGE_RELOAD",
        sipCode: null,
        callId: call.providerCallId,
        calleeNumber: call.calleeNumber ?? "",
        startedAt: new Date(call.startedAt).toISOString(),
        endedAt: new Date(endedAt).toISOString(),
      }
    : null;
  return {
    ...call,
    status: "dropped",
    phase: "ended",
    dialReady: false,
    muted: false,
    result: { durationSeconds, method: call.method, telephony },
  };
}
