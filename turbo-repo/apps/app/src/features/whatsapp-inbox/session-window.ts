/**
 * WhatsApp's customer-service rule: free-form (non-template) messages are only allowed within 24h of
 * the driver's last inbound message. The modulith stores that expiry as `sessionExpiresAt` (bumped
 * on every inbound). These pure helpers turn it into a UI state so the compose box can enable/disable
 * free-text and the header can show a live countdown.
 */

export type WindowStatus = "open" | "closingSoon" | "closed";

/** Amber threshold — warn the operator when under 2h of the window remain. */
const CLOSING_SOON_MS = 2 * 60 * 60 * 1000;

export interface WindowState {
  readonly status: WindowStatus;
  /** Milliseconds until the window closes; 0 once closed. */
  readonly remainingMs: number;
}

export function windowState(sessionExpiresAt: string | null, nowMs: number): WindowState {
  if (!sessionExpiresAt) {
    return { status: "closed", remainingMs: 0 };
  }
  const expiry = new Date(sessionExpiresAt).getTime();
  if (Number.isNaN(expiry)) {
    return { status: "closed", remainingMs: 0 };
  }
  const remainingMs = expiry - nowMs;
  if (remainingMs <= 0) {
    return { status: "closed", remainingMs: 0 };
  }
  return { status: remainingMs <= CLOSING_SOON_MS ? "closingSoon" : "open", remainingMs };
}

/** Compact remaining label: `Hh Mm` when an hour or more is left, otherwise `Mm`. Empty when closed. */
export function formatRemaining(remainingMs: number): string {
  if (remainingMs <= 0) {
    return "";
  }
  const totalMinutes = Math.floor(remainingMs / 60_000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
}
