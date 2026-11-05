"use client";

import { useEffect } from "react";
import {
  installSessionExpiryGuard,
  setSessionExpiryGuardActive,
} from "./session-expiry";

// Installed when the module loads, before any page effect makes a request.
if (globalThis.window !== undefined) installSessionExpiryGuard();

/**
 * Rendered by the secured layout. The guard acts only while it is mounted, so
 * public pages reached by client navigation keep their own 401 handling.
 */
export function SessionExpiryGuard() {
  useEffect(() => {
    setSessionExpiryGuardActive(true);
    return () => setSessionExpiryGuardActive(false);
  }, []);
  return null;
}
