"use client";

/**
 * Single kill switch for the treatment writes the forms make to the Control
 * Tower API. Every form save goes through `guardedRequestTreatment`.
 *
 * Opt-OUT: the server env var `SYMPTOMS_PROTOTYPE_DISABLE_API=true` turns the
 * writes off; the save then echoes its payload back. It is read from the
 * runtime config, so the map-view page renders only after that has loaded.
 */

import { getRuntimeConfig } from "@/features/runtime-config/runtime-config-context";
import type { TreatmentsRequest } from "@/app/api/treatments/route.type";
import { isEngineCaseId } from "@/features/symptoms/model/treatment-link";
import {
  addTreatmentAction,
  closeTreatment,
  openTreatment,
  revalidateCase,
  type AddActionBody,
  type ControlTowerError,
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
  return isEngineCaseId(payload.symptom_id);
}

/** "Registrar gestión": handled without a call, stored as a NOTE with an outcome. */
export const RECORD_HANDLING_TYPE = "registrar gestion";

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
  /** Per-form progress lets a failed close retry the acknowledged action's episode. */
  progress?: EngineTreatmentProgress;
}

export interface EngineTreatmentProgress {
  pendingClose?: {
    symptomId: TreatmentsRequest["symptom_id"];
    treatmentId: string;
    resolution?: string;
  };
  /** The treatment this form already opened: later saves add to it without opening again. */
  opened?: {
    symptomId: TreatmentsRequest["symptom_id"];
    treatmentId: string;
  };
}

/** A conflict answer from the Control Tower API (`ControlTowerError`). */
function isConflict(error: unknown): error is Error {
  return (
    error instanceof Error &&
    (error as Partial<ControlTowerError>).status === 409
  );
}

/** The API refused a new treatment, or a hold, because the case is already closed. */
export function isCaseClosedError(error: unknown): boolean {
  return isConflict(error) && error.message === "the case is closed";
}

/** The dictionary key of the message for a failed save. */
export function treatmentSaveErrorKey(error: unknown): string {
  return isCaseClosedError(error)
    ? "treatment_case_closed"
    : "treatment_save_error";
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
  const handling = payload.treatment_type === RECORD_HANDLING_TYPE;
  return {
    kind: handling ? "NOTE" : TOWER_ACTION_KINDS[type],
    outcomeLabel: reason,
    message: payload.message ?? undefined,
    note: payload.driver_response ?? undefined,
    contactName: type === "CALL" && !handling ? "Conductor" : undefined,
    ...extra,
  };
}

/**
 * Records the form's save on an engine case: the action, then the close,
 * which also closes the case.
 */
async function saveEngineTreatment(
  payload: TreatmentsRequest,
  { action, finish = true, progress }: EngineTreatmentOptions
): Promise<TreatmentsRequest> {
  if (progress?.pendingClose?.symptomId === payload.symptom_id) {
    await finishEngineTreatment(payload, progress);
  } else {
    const treatmentId = await addEngineAction(
      payload,
      engineAction(payload, action),
      progress
    );
    if (finish) {
      await finishEngineTreatment(
        payload,
        progress,
        treatmentId,
        payload.description ?? undefined
      );
    }
  }
  return payload;
}

/**
 * The treatment this form opened, else the operator's open one on the case,
 * which the API resumes even after the engine closed the case. Only a new
 * treatment on a closed case is refused.
 */
async function engineTreatmentId(
  payload: TreatmentsRequest,
  progress?: EngineTreatmentProgress
): Promise<string> {
  const known = progress?.opened;
  if (known?.symptomId === payload.symptom_id) return known.treatmentId;
  const treatment = await openEngineTreatment(payload);
  if (progress) {
    progress.opened = {
      symptomId: payload.symptom_id,
      treatmentId: treatment.id,
    };
  }
  return treatment.id;
}

/** A remembered treatment closed elsewhere is forgotten and the open one is looked up once. */
async function addEngineAction(
  payload: TreatmentsRequest,
  body: AddActionBody,
  progress?: EngineTreatmentProgress
): Promise<string> {
  const remembered = progress?.opened?.symptomId === payload.symptom_id;
  const treatmentId = await engineTreatmentId(payload, progress);
  try {
    await addTreatmentAction(treatmentId, body);
    return treatmentId;
  } catch (error) {
    if (!remembered || !isConflict(error)) {
      throw error;
    }
    if (progress) progress.opened = undefined;
    const reopened = await engineTreatmentId(payload, progress);
    await addTreatmentAction(reopened, body);
    return reopened;
  }
}

async function finishEngineTreatment(
  payload: TreatmentsRequest,
  progress?: EngineTreatmentProgress,
  treatmentId?: string,
  resolution?: string
): Promise<void> {
  let pending = progress?.pendingClose;
  if (pending?.symptomId !== payload.symptom_id) pending = undefined;
  pending ??= {
    symptomId: payload.symptom_id,
    treatmentId: treatmentId ?? (await engineTreatmentId(payload, progress)),
    resolution,
  };
  if (progress) progress.pendingClose = pending;
  await closeTreatment(
    pending.treatmentId,
    pending.resolution === undefined ? {} : { resolution: pending.resolution }
  );
  if (progress) {
    progress.pendingClose = undefined;
    progress.opened = undefined;
  }
}

/** On a NOTE action: the call-script step (1-based) the operator skipped to. */
export const SKIP_TO_STEP = "skipToStep";

export interface StepSkip {
  symptomId: number;
  assetId?: string;
  tripId?: string;
  /** The step skipped to, 0-based as in the panel. */
  toStep: number;
  reason: string;
  level?: number;
  version?: string;
  /** Reuse for retries of the same skip, including a lost server response. */
  skipId: string;
  /** The SLA interval in which the panel was shown; holds restart it too. */
  slaSince?: string;
}

/**
 * Records a call-script skip on an engine case: a NOTE action in the
 * operator's open treatment, which stays open for the calls that follow.
 * The server stores who and when. Other cases keep the skip in the panel.
 */
export async function guardedSkipStep(skip: StepSkip): Promise<void> {
  if (isPrototypeApiDisabled() || skip.symptomId >= 0) return;
  const treatment = await openTreatment(skip.symptomId, {
    type: "CALL",
    assetId: skip.assetId || undefined,
    tripId: skip.tripId || undefined,
  });
  await addTreatmentAction(treatment.id, {
    kind: "NOTE",
    note: skip.reason,
    details: {
      [SKIP_TO_STEP]: skip.toStep + 1,
      level: skip.level,
      version: skip.version,
      skipId: skip.skipId,
      slaSince: skip.slaSince,
    },
  });
  void revalidateCase(skip.symptomId);
}

/**
 * Saves a form on an engine case through the Control Tower API. When the API
 * is disabled, echoes the payload back. A case that is not the engine's is
 * refused.
 */
export async function guardedRequestTreatment(
  payload: TreatmentsRequest,
  engine: EngineTreatmentOptions = {}
): Promise<TreatmentsRequest> {
  if (!isEngineCase(payload)) {
    throw new TypeError("Treatments require an engine case");
  }
  if (isPrototypeApiDisabled()) return payload;
  try {
    return await saveEngineTreatment(payload, engine);
  } finally {
    // An action can be committed even when closing its case subsequently fails.
    void revalidateCase(payload.symptom_id);
  }
}

/**
 * Closes the operator's treatment on an engine case after its actions were
 * already saved. Other cases have nothing to close.
 */
export async function guardedFinishTreatment(
  payload: TreatmentsRequest,
  progress?: EngineTreatmentProgress
): Promise<void> {
  if (isPrototypeApiDisabled() || !isEngineCase(payload)) return;
  try {
    await finishEngineTreatment(payload, progress);
  } finally {
    void revalidateCase(payload.symptom_id);
  }
}

/** Saves an "invalidar síntoma" treatment. Shared by the past modal and the inline form. */
export async function guardedInvalidateSymptom({
  treatmentRequest,
  setTreatmentRequest,
  reason,
  progress,
}: {
  treatmentRequest: TreatmentsRequest;
  setTreatmentRequest: (treatmentRequest: TreatmentsRequest) => void;
  reason: string;
  progress?: EngineTreatmentProgress;
}): Promise<void> {
  const treatmentResult = await guardedRequestTreatment(
    {
      ...treatmentRequest,
      status: "active",
      treatment_type: "invalidar sintoma",
      description: reason,
    },
    { progress }
  );

  setTreatmentRequest({
    ...treatmentRequest,
    status: "active",
    description: reason,
    treatment_id: treatmentResult.treatment_id,
  });
}
