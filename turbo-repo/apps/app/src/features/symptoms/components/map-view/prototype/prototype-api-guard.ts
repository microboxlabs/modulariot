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
  cancelTreatment,
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
}

/** The operator's treatment on an engine case, as this page opened or resumed it. */
interface StartedTreatment {
  treatmentId: string;
  /** False while it holds no action: it is then cancelled when the operator leaves. */
  recorded: boolean;
  pending: Set<Promise<unknown>>;
}

interface TreatmentTarget {
  symptomId: number | string;
  type: TowerTreatmentType;
  assetId?: string;
  tripId?: string;
}

/** By case id. A treatment stays here from its opening until it is closed or the operator leaves. */
const started = new Map<string, Promise<StartedTreatment>>();
/** By case id: the cancel of an abandoned treatment, which the next opening waits for. */
const leaving = new Map<string, Promise<void>>();
/** Panels left while their call still needed a result. */
const retainedForCall = new Set<string>();

export function retainTreatmentForCall(
  symptomId: number | string | undefined
): void {
  retainedForCall.add(String(symptomId));
}

/** Discarding the call releases only a treatment whose panel has already left. */
export function abandonRetainedCallTreatment(symptomId: string | null): void {
  if (symptomId !== null && retainedForCall.delete(symptomId)) {
    void guardedAbandonTreatment(symptomId);
  }
}

/** Forgets every treatment this page opened, without cancelling any. */
export function forgetStartedTreatments(): void {
  started.clear();
  leaving.clear();
  retainedForCall.clear();
}

/** A conflict answer from the Control Tower API (`ControlTowerError`). */
export function isConflict(error: unknown): error is Error {
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

function targetOf(payload: TreatmentsRequest): TreatmentTarget {
  return {
    symptomId: payload.symptom_id ?? "",
    type: towerType(payload),
    assetId: payload.asset_id || undefined,
    tripId: payload.trip_id || undefined,
  };
}

/**
 * The treatment this page has open on the case. The first call opens it, or
 * resumes the operator's open one, which the API does even after the engine
 * closed the case. Only a new treatment on a closed case is refused.
 */
function startEngineTreatment(
  target: TreatmentTarget
): Promise<StartedTreatment> {
  const key = String(target.symptomId);
  const known = started.get(key);
  if (known) return known;
  const { symptomId, ...body } = target;
  const opening = (leaving.get(key) ?? Promise.resolve())
    .then(() => openTreatment(symptomId, body))
    .then((treatment) => ({
      treatmentId: treatment.id,
      recorded: (treatment.actions?.length ?? 0) > 0,
      pending: new Set<Promise<unknown>>(),
    }));
  started.set(key, opening);
  opening.catch(() => {
    if (started.get(key) === opening) started.delete(key);
  });
  return opening;
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
      targetOf(payload),
      engineAction(payload, action)
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
 * Adds the action to the case's treatment. A treatment closed elsewhere is
 * forgotten and the open one is looked up once.
 */
async function addEngineAction(
  target: TreatmentTarget,
  body: AddActionBody
): Promise<string> {
  const key = String(target.symptomId);
  const remembered = started.has(key);
  const treatment = await startEngineTreatment(target);
  try {
    return await recordAction(treatment, body);
  } catch (error) {
    if (!remembered || !isConflict(error)) throw error;
    started.delete(key);
    return recordAction(await startEngineTreatment(target), body);
  }
}

/** Abandoning waits for in-flight writes and preserves only confirmed actions. */
async function recordAction(
  treatment: StartedTreatment,
  body: AddActionBody
): Promise<string> {
  const write = addTreatmentAction(treatment.treatmentId, body);
  treatment.pending.add(write);
  try {
    await write;
    treatment.recorded = true;
    return treatment.treatmentId;
  } finally {
    treatment.pending.delete(write);
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
    treatmentId:
      treatmentId ??
      (await startEngineTreatment(targetOf(payload))).treatmentId,
    resolution,
  };
  if (progress) progress.pendingClose = pending;
  await closeTreatment(
    pending.treatmentId,
    pending.resolution === undefined ? {} : { resolution: pending.resolution }
  );
  if (progress) progress.pendingClose = undefined;
  started.delete(String(payload.symptom_id));
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
  await addEngineAction(
    {
      symptomId: skip.symptomId,
      type: "CALL",
      assetId: skip.assetId || undefined,
      tripId: skip.tripId || undefined,
    },
    {
      kind: "NOTE",
      note: skip.reason,
      details: {
        [SKIP_TO_STEP]: skip.toStep + 1,
        level: skip.level,
        version: skip.version,
        skipId: skip.skipId,
        slaSince: skip.slaSince,
      },
    }
  );
  void revalidateCase(skip.symptomId);
}

/**
 * Opens the operator's treatment on an engine case when they start treating
 * it, or resumes their open one. Later saves record into it, also after the
 * engine closes the case. Rejects when the API refuses: the case is already
 * closed, or another operator treats it.
 */
export async function guardedStartTreatment(
  payload: TreatmentsRequest
): Promise<void> {
  if (isPrototypeApiDisabled() || !isEngineCase(payload)) return;
  retainedForCall.delete(String(payload.symptom_id));
  const known = started.has(String(payload.symptom_id));
  await startEngineTreatment(targetOf(payload));
  if (!known) void revalidateCase(payload.symptom_id);
}

/**
 * The operator left the case's forms: the treatment this page opened is
 * cancelled when nothing was recorded in it. `keepalive` lets the cancel
 * outlive a page that is unloading.
 */
export function guardedAbandonTreatment(
  symptomId: TreatmentsRequest["symptom_id"],
  options: { keepalive?: boolean } = {}
): Promise<void> {
  const key = String(symptomId);
  const opening = started.get(key);
  if (!opening) return Promise.resolve();
  started.delete(key);
  const left = opening
    .then(async (treatment) => {
      await Promise.allSettled(treatment.pending);
      if (treatment.recorded) return;
      await cancelTreatment(treatment.treatmentId, "panel closed", options);
      void revalidateCase(symptomId);
    })
    .catch(() => undefined)
    .finally(() => {
      if (leaving.get(key) === left) leaving.delete(key);
    });
  leaving.set(key, left);
  return left;
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
