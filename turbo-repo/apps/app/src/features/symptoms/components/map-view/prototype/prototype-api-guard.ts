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
import {
  addTreatmentAction,
  closeTreatment,
  openTreatment,
  type AddActionBody,
  type TowerActionKind,
  type TowerTreatmentType,
} from "@/features/symptoms/control-tower/control-tower-api";

export function isPrototypeApiDisabled(): boolean {
  return getRuntimeConfig()?.SYMPTOMS_PROTOTYPE_DISABLE_API === "true";
}

/** Same flag as `isPrototypeApiDisabled`, named for the read side: true
 *  means "show fabricated contact/call data," since there's nothing real to
 *  show instead yet. */
export const isMockDataEnabled = isPrototypeApiDisabled;

/**
 * A case opened by the symptom engine: its id is negative and only the
 * Control Tower treatments API knows it. The GPS database RPC rejects it.
 */
export function isEngineCase(payload: TreatmentsRequest): boolean {
  return Number(payload.symptom_id) < 0;
}

const TOWER_TREATMENT_TYPES: Record<string, TowerTreatmentType> = {
  "llamar al conductor": "CALL",
  "ignorar condicion": "IGNORE_CONDITION",
  "invalidar sintoma": "INVALIDATE_SYMPTOM",
};

const TOWER_ACTION_KINDS: Record<TowerTreatmentType, TowerActionKind> = {
  CALL: "CALL",
  IGNORE_CONDITION: "IGNORE",
  INVALIDATE_SYMPTOM: "INVALIDATE",
};

export interface EngineTreatmentOptions {
  /** Fields of the recorded action beyond what the payload carries. */
  action?: Partial<AddActionBody>;
  /** False records the action and leaves the treatment open. */
  finish?: boolean;
}

/** The call forms leave `treatment_type` empty: their saves are calls. */
function towerType(payload: TreatmentsRequest): TowerTreatmentType {
  return TOWER_TREATMENT_TYPES[payload.treatment_type] ?? "CALL";
}

/** Opens the operator's treatment on the case, or resumes the open one. */
function openEngineTreatment(payload: TreatmentsRequest) {
  return openTreatment(payload.symptom_id ?? "", {
    type: towerType(payload),
    assetId: payload.asset_id || undefined,
    tripId: payload.trip_id || undefined,
  });
}

function engineAction(
  payload: TreatmentsRequest,
  extra: Partial<AddActionBody> | undefined
): AddActionBody {
  const type = towerType(payload);
  const reason = payload.description ?? undefined;
  return {
    kind: TOWER_ACTION_KINDS[type],
    outcomeLabel: reason,
    message: payload.message ?? undefined,
    note: payload.driver_response ?? undefined,
    contactName: type === "CALL" ? "Conductor" : undefined,
    ...extra,
  };
}

/**
 * Records the form's save on an engine case: the action, then the close,
 * which also closes the case.
 */
async function saveEngineTreatment(
  payload: TreatmentsRequest,
  { action, finish = true }: EngineTreatmentOptions
): Promise<TreatmentsRequest> {
  const treatment = await openEngineTreatment(payload);
  await addTreatmentAction(treatment.id, engineAction(payload, action));
  if (finish) {
    await closeTreatment(treatment.id, {
      resolution: payload.description ?? undefined,
    });
  }
  return payload;
}

/**
 * Drop-in replacement for `requestTreatment` — when the real API is
 * disabled, echoes the request payload straight back instead of sending it,
 * so callers reading the response (`treatment_id`, etc.) don't need their
 * own disabled-path branching. Engine cases go to the Control Tower API.
 */
export async function guardedRequestTreatment(
  payload: TreatmentsRequest,
  engine: EngineTreatmentOptions = {}
): Promise<TreatmentsRequest> {
  if (isPrototypeApiDisabled()) return payload;
  if (isEngineCase(payload)) return saveEngineTreatment(payload, engine);
  return requestTreatment(payload);
}

/**
 * Closes the operator's treatment on an engine case after its actions were
 * already saved. Other cases have nothing to close.
 */
export async function guardedFinishTreatment(
  payload: TreatmentsRequest
): Promise<void> {
  if (isPrototypeApiDisabled() || !isEngineCase(payload)) return;
  const treatment = await openEngineTreatment(payload);
  await closeTreatment(treatment.id, {});
}

/**
 * The preaction every treatment form runs when its menu opens: records a
 * `pending` treatment of `treatmentType` and keeps the returned
 * `treatment_id` so the form's final save updates that same record. Shared
 * by the past modal (`symptom-form.tsx`) and the inline form. An engine case
 * opens its treatment at the save instead.
 */
export async function startPendingTreatment(
  treatmentRequest: TreatmentsRequest,
  setTreatmentRequest: (treatmentRequest: TreatmentsRequest) => void,
  treatmentType: string
): Promise<void> {
  if (isEngineCase(treatmentRequest)) return;
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

  if (isPrototypeApiDisabled() || isEngineCase(treatmentRequest)) return;

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
