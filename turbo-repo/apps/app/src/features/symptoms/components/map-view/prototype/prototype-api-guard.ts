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
 * controlling all of it.
 *
 * The SAME flag also gates every *fabricated* contact/call reads in the
 * call-center flow (`mock-contact-data.ts`, `mock-call-log.ts`, the seeded
 * default roles in `call-roles-store.ts`) via `isMockDataEnabled` — there's
 * no real backend for "who to call" or per-call history yet, so until this
 * is cleared for real use, both "can this write for real" and "is this
 * display data fake" answer to the one flag. When it's off, those mock
 * generators return blank/empty instead of a fabricated name, phone, stat,
 * or seeded contact — deliberately not a fallback that quietly *looks*
 * real.
 *
 * Fails closed: with NO env var set at all, real writes stay off and mock
 * data stays on. This is an explicit opt-IN
 * (`NEXT_PUBLIC_SYMPTOMS_PROTOTYPE_ENABLE_API=true`), not an opt-out — a
 * missing or misconfigured env var must never accidentally let this
 * prototype create a real treatment, nor accidentally show fabricated data
 * as if it were real.
 */

import { requestTreatment } from "@/features/common/providers/client-api.provider";
import type { TreatmentsRequest } from "@/app/api/treatments/route.type";

export function isPrototypeApiDisabled(): boolean {
  return process.env.NEXT_PUBLIC_SYMPTOMS_PROTOTYPE_ENABLE_API !== "true";
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
