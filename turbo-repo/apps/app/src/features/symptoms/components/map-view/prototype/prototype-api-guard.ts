"use client";

/**
 * Single kill switch for every place this prototype could otherwise write to
 * the REAL backend: `requestTreatment` (→ `/app/api/treatments` →
 * Streamhub's `process_treatment_manual_notifi_audit`, a live external
 * system — see `route.ts`) and the "invalidar síntoma" webhook
 * (`/app/api/symptoms/invalidate`). Every prototype form's save funnels
 * through `guardedRequestTreatment` instead of calling `requestTreatment`
 * directly, and every other real-write call site checks
 * `isPrototypeApiDisabled()` itself — so there is exactly one flag
 * controlling all of it. It gates ONLY those production writes — nothing
 * else in the prototype (UI, local stores, mock display data) reads it.
 *
 * Opt-OUT: `NEXT_PUBLIC_SYMPTOMS_PROTOTYPE_DISABLE_API=true` disconnects
 * those writes. With the var set to anything else, or not set at all, the
 * prototype writes to the real backend normally.
 */

import { requestTreatment } from "@/features/common/providers/client-api.provider";
import type { TreatmentsRequest } from "@/app/api/treatments/route.type";

export function isPrototypeApiDisabled(): boolean {
  return process.env.NEXT_PUBLIC_SYMPTOMS_PROTOTYPE_DISABLE_API === "true";
}

/** Same flag as `isPrototypeApiDisabled`, named for the read side: true
 *  means "show fabricated contact/call data," since there's nothing real to
 *  show instead yet. */
export const isMockDataEnabled = isPrototypeApiDisabled;

/**
 * Drop-in replacement for `requestTreatment` — when the real API is
 * disabled, echoes the request payload straight back instead of sending it,
 * so callers reading the response (`treatment_id`, etc.) don't need their
 * own disabled-path branching.
 */
export async function guardedRequestTreatment(
  payload: TreatmentsRequest
): Promise<TreatmentsRequest> {
  if (isPrototypeApiDisabled()) return payload;
  return requestTreatment(payload);
}
