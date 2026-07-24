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

/**
 * One attached channel as the drawer commits it — an upsert without the event and
 * scope, which the hook fills in per Activiti task. A column carries a *list* of
 * these: the backend keys bindings on `connection_id` as part of the natural key
 * precisely so one event can fan out to several channels.
 */
export type ChannelBindingDraft = Omit<
  UpsertBindingRequest,
  "eventType" | "scopeKind" | "scopeKey"
>;

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

/**
 * One channel as the drawer edits it: the trigger and mapping kept in their friendly
 * shapes (a two-option trigger, a field→template map) and turned into a binding's
 * `matchCondition`/`fieldTemplates` only on save.
 */
export interface ChannelDraft {
  readonly connectionId: string;
  readonly operationId: string | null;
  readonly trigger: ReviewTrigger;
  readonly templates: Record<string, string>;
}

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

/**
 * Stable identity for a channel: a connection *and* the operation called on it.
 * This is the key a column's channels are deduplicated and diffed by — it mirrors
 * the backend's unique key, which includes `connection_id` so one event can bind to
 * several channels.
 */
export function channelKey(
  connectionId: string,
  operationId: string | null
): string {
  return `${connectionId}::${operationId ?? ""}`;
}

/** The channel identity of a stored or drafted binding. */
export function bindingChannelKey(
  binding: Pick<EventBinding, "connectionId" | "operationId">
): string {
  return channelKey(binding.connectionId, binding.operationId);
}

/** Stable identity for a channel in the picker: a connection *and* an operation. */
export function targetKey(target: DispatchTarget): string {
  return channelKey(target.connectionId, target.operationId);
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

/**
 * The channels attached to a board column, as one binding each.
 *
 * A column may aggregate several Activiti tasks, and a channel attached to it is
 * written once per task — so the same channel appears under more than one scope key.
 * This folds those duplicates back to one entry per channel (own binding winning over
 * one inherited from a parent org), which is what the drawer edits. Ordering is
 * insertion order, so the list is stable across reopens.
 */
export function attachedChannels(
  bindings: readonly EventBinding[],
  boardKey: string
): EventBinding[] {
  const taskKeys = new Set(taskKeysForBoard(boardKey));
  const byChannel = new Map<string, EventBinding>();
  for (const binding of bindings) {
    if (binding.eventType !== REVIEW_EVENT_TYPE) continue;
    if (!binding.scopeKey || !taskKeys.has(binding.scopeKey)) continue;
    const key = bindingChannelKey(binding);
    const existing = byChannel.get(key);
    if (!existing || (existing.inherited && !binding.inherited)) {
      byChannel.set(key, binding);
    }
  }
  return [...byChannel.values()];
}
