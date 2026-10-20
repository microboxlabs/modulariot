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
 * Opt-OUT: the server env var `SYMPTOMS_PROTOTYPE_DISABLE_API=true`
 * disconnects those writes. With the var set to anything else, or not set at
 * all, the prototype writes to the real backend normally. It is read from the
 * runtime config, so the map-view page renders only after that has loaded.
 */

import { getRuntimeConfig } from "@/features/runtime-config/runtime-config-context";
import { requestTreatment } from "@/features/common/providers/client-api.provider";
import type { TreatmentsRequest } from "@/app/api/treatments/route.type";
import type { TreatmentsGeneralResponseItem } from "@/app/api/treatments/general/route.type";

export function isPrototypeApiDisabled(): boolean {
  return getRuntimeConfig()?.SYMPTOMS_PROTOTYPE_DISABLE_API === "true";
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

/**
 * The preaction every treatment form runs when its menu opens: records a
 * `pending` treatment of `treatmentType` and keeps the returned
 * `treatment_id` so the form's final save updates that same record. Shared
 * by the past modal (`symptom-form.tsx`) and the inline form.
 */
export async function startPendingTreatment(
  treatmentRequest: TreatmentsRequest,
  setTreatmentRequest: (treatmentRequest: TreatmentsRequest) => void,
  treatmentType: string
): Promise<void> {
  const pending = {
    ...treatmentRequest,
    treatment_type: treatmentType,
    status: "pending",
  };
  setTreatmentRequest(pending);
  const response = await guardedRequestTreatment(pending);
  setTreatmentRequest({
    ...treatmentRequest,
    treatment_id: response.treatment_id,
  });
}

/**
 * Saves an "invalidar síntoma" treatment and fires the invalidate-symptom
 * webhook — a second, separate real write, not routed through
 * `requestTreatment`, so it needs its own check. Throws if the webhook
 * fails. Shared by the past modal and the inline form.
 */
export async function guardedInvalidateSymptom({
  treatmentRequest,
  setTreatmentRequest,
  treatmentData,
  reason,
}: {
  treatmentRequest: TreatmentsRequest;
  setTreatmentRequest: (treatmentRequest: TreatmentsRequest) => void;
  treatmentData: TreatmentsGeneralResponseItem | null;
  reason: string;
}): Promise<void> {
  const treatmentResult = await guardedRequestTreatment({
    ...treatmentRequest,
    status: "active",
    treatment_type: "invalidar sintoma",
    description: reason,
  });

  setTreatmentRequest({
    ...treatmentRequest,
    status: "active",
    description: reason,
    treatment_id: treatmentResult.treatment_id,
  });

  if (isPrototypeApiDisabled()) return;

  const invalidateResponse = await fetch("/app/api/symptoms/invalidate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      symptom_id: treatmentData?.symptom_info?.id.toString() ?? "",
      asset_id: treatmentData?.trip_info?.asset_id ?? "",
      trip_id: treatmentData?.trip_info?.trip_id ?? "",
      reason,
      invalidated_by: treatmentRequest.assigned_to,
      treatment_id: treatmentResult.treatment_id,
    }),
  });
  if (!invalidateResponse.ok) throw new Error("Invalidate webhook failed");
}
