import { taskShippingBoardMap } from "../../services/data.service";

/**
 * The miot-integrations binding API, as this screen consumes it.
 *
 * Replaces the mock catalog the drawer shipped with: channels are now the org's
 * real connections, the field contract comes from each operation's stored
 * `request_schema`, and the config lives in the database instead of localStorage.
 */

/** One bindable channel: a connection + the operation to call on it. */
export interface DispatchTarget {
  readonly connectionId: string;
  readonly connectionName: string;
  readonly providerType: string;
  readonly operationId: string;
  readonly operationName: string;
  readonly method: string;
  readonly path: string;
  readonly fields: readonly DispatchTargetField[];
}

export interface DispatchTargetField {
  readonly id: string;
  /** `string` | `boolean` | `integer` | `number`, from the operation's contract. */
  readonly type: string;
  readonly required: boolean;
}

export interface EventBinding {
  readonly id: string;
  readonly ownerOrgSlug: string;
  /** Defined by a parent org: visible and live, but not this org's to edit. */
  readonly inherited: boolean;
  readonly eventType: string;
  readonly scopeKind: string | null;
  readonly scopeKey: string | null;
  readonly connectionId: string;
  readonly operationId: string | null;
  readonly matchCondition: Record<string, unknown>;
  readonly fieldTemplates: Record<string, string>;
  readonly enabled: boolean;
  readonly updatedAt: string;
  readonly updatedBy: string;
}

export interface UpsertBindingRequest {
  readonly eventType: string;
  readonly scopeKind: string | null;
  readonly scopeKey: string | null;
  readonly connectionId: string;
  readonly operationId: string | null;
  readonly matchCondition: Record<string, unknown>;
  readonly fieldTemplates: Record<string, string>;
  readonly enabled: boolean;
}

export interface BindingPreview {
  readonly valid: boolean;
  readonly payload: Record<string, unknown>;
  readonly problems: readonly string[];
}

/* -------------------------------------------------------------------------- */
/* Scope                                                                      */
/* -------------------------------------------------------------------------- */

/** The event a reviewed column emits. */
export const REVIEW_EVENT_TYPE = "review.verdict";

/**
 * Bindings key on the Activiti task, not the board.
 *
 * A board title is a *derived* label — `taskShippingBoardMap` folds
 * `wfship:transportValidationTask` into `transportValidation` — and the fold is
 * many-to-one: `wfship:tripOutsideInitiatedTask` and `tripInitiatedWithoutSovos`
 * both land on `monitoringFinalization`. Binding on the form key is therefore both
 * stable when a column is renamed and precise enough to tell two workflow tasks
 * apart when they happen to share a lane.
 */
export const REVIEW_SCOPE_KIND = "activiti_task";

/**
 * Every Activiti task that feeds a board. A board showing more than one task gets
 * one binding per task, so each fires on its own completion.
 */
export function taskKeysForBoard(boardKey: string): string[] {
  const keys = Object.entries(taskShippingBoardMap)
    .filter(([, board]) => board === boardKey)
    .map(([taskKey]) => taskKey);
  // A board with no entry in the map is already keyed by its own task.
  return keys.length > 0 ? keys : [boardKey];
}

/* -------------------------------------------------------------------------- */
/* Trigger                                                                    */
/* -------------------------------------------------------------------------- */

/** The drawer's friendly two-option trigger, expressed as a match condition. */
export type ReviewTrigger = "on_reject" | "on_review";

/** The path the verdict arrives under, and the value that means "rejected". */
const VERDICT_PATH = "review.verdict";

export function conditionForTrigger(trigger: ReviewTrigger): Record<string, unknown> {
  // "Everything" is the absence of a condition, not a wildcard value.
  return trigger === "on_reject" ? { [VERDICT_PATH]: false } : {};
}

export function triggerFromCondition(
  condition: Record<string, unknown> | undefined
): ReviewTrigger {
  if (!condition || Object.keys(condition).length === 0) return "on_review";
  const verdict = condition[VERDICT_PATH];
  return verdict === false || verdict === "false" ? "on_reject" : "on_review";
}

/* -------------------------------------------------------------------------- */
/* Helpers the drawer shares with the server's own validation                  */
/* -------------------------------------------------------------------------- */

/** Required fields of the chosen channel that have no usable template yet. */
export function unmappedRequiredFields(
  target: DispatchTarget | undefined,
  templates: Record<string, string>
): DispatchTargetField[] {
  if (!target) return [];
  return target.fields.filter(
    (field) => field.required && !templates[field.id]?.trim()
  );
}

/** Stable identity for a channel in the picker: a connection *and* an operation. */
export function targetKey(target: DispatchTarget): string {
  return `${target.connectionId}::${target.operationId}`;
}

export function findTarget(
  targets: readonly DispatchTarget[],
  connectionId: string | null,
  operationId: string | null
): DispatchTarget | undefined {
  if (!connectionId) return undefined;
  return targets.find(
    (target) =>
      target.connectionId === connectionId &&
      (operationId === null || target.operationId === operationId)
  );
}
