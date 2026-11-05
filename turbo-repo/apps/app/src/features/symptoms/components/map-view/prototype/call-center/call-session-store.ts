/**
 * The active call as kept in sessionStorage, so a reload can restore its bar
 * and timer. Only ids, times and what the operator saw are kept: never the
 * WebRTC login token.
 */

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

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

function storage(): StorageLike | null {
  try {
    return typeof window === "undefined" ? null : window.sessionStorage;
  } catch {
    return null;
  }
}

export function saveCall(call: ActiveCall | null, store = storage()) {
  if (!store) return;
  try {
    if (call) store.setItem(CALL_SESSION_STORAGE_KEY, JSON.stringify(call));
    else store.removeItem(CALL_SESSION_STORAGE_KEY);
  } catch {
    // Full or blocked storage: the call still works, it just won't survive a reload.
  }
}

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null;

export function loadCall(store = storage()): ActiveCall | null {
  if (!store) return null;
  let raw: string | null;
  try {
    raw = store.getItem(CALL_SESSION_STORAGE_KEY);
  } catch {
    return null;
  }
  if (!raw) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (
    !isObject(parsed) ||
    typeof parsed.id !== "string" ||
    typeof parsed.key !== "string" ||
    typeof parsed.startedAt !== "number" ||
    !isObject(parsed.context)
  )
    return null;
  const call = parsed as unknown as ActiveCall;
  const stats = call.context.target?.stats;
  if (stats && typeof stats.lastCallAt === "string")
    stats.lastCallAt = new Date(stats.lastCallAt);
  return call;
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
