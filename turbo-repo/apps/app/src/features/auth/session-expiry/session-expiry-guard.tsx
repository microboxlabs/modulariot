"use client";

import { installSessionExpiryGuard } from "./session-expiry";

// Installed when the module loads, before any page effect makes a request.
if (typeof window !== "undefined") installSessionExpiryGuard();

/** Rendered by the secured layouts; see `installSessionExpiryGuard`. */
export function SessionExpiryGuard() {
  return null;
}
