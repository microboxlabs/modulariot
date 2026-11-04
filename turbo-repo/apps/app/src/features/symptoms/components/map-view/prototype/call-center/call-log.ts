/**
 * One recorded call, as the treatments timeline shows it — built from a
 * Control Tower CALL action.
 */

import type { TowerAction } from "@/features/symptoms/control-tower/control-tower-api";
import type { CallMethod } from "./call-method";
import { fromApiMethod } from "./call-targets";

export type CallOutcome = "answered" | "missed";

export interface CallLogEntry {
  id: string;
  calledName: string;
  method: CallMethod;
  outcome: CallOutcome;
  durationSeconds: number;
  at: Date;
  /** What the operator told the contact. */
  message: string;
  /** What came back; empty when nobody answered. */
  response: string;
  /** The provider's record (Teams) has not arrived yet: duration and result are provisional. */
  pending: boolean;
}

export function callLogEntryOf(action: TowerAction): CallLogEntry {
  const answered = action.answered ?? (action.durationSeconds ?? 0) > 0;
  const response = [action.outcomeLabel, action.note]
    .filter(Boolean)
    .join(" · ");
  return {
    id: action.id,
    calledName: action.contactName ?? "",
    method: action.method ? fromApiMethod(action.method) : "phone",
    outcome: answered ? "answered" : "missed",
    durationSeconds: action.durationSeconds ?? 0,
    at: new Date(action.performedAt),
    message: action.message ?? "",
    response,
    pending: telephonyStatus(action) === "PENDING",
  };
}

function telephonyStatus(action: TowerAction): unknown {
  const telephony = action.details?.telephony;
  return telephony && typeof telephony === "object"
    ? (telephony as Record<string, unknown>).status
    : undefined;
}

export function formatCallLogDuration(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, "0");
  const s = Math.floor(totalSeconds % 60)
    .toString()
    .padStart(2, "0");
  return `${m}:${s}`;
}
