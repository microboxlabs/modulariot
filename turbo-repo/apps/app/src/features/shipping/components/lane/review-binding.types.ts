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
  /**
   * Every template root this contract accepts: the always-present ones plus the bind names
   * its arrays introduce. Absent on a response from a modulith older than this field —
   * callers fall back to the static roots.
   */
  readonly templateRoots?: readonly string[];
}

export interface DispatchTargetField {
  readonly id: string;
  /** `string` | `boolean` | `integer` | `number`, from the operation's contract. */
  readonly type: string;
  readonly required: boolean;
  /**
   * The contract's own view of the root this row is read under, or null at the envelope. Once
   * the draft names an array's collection, `scopeOfRow` knows better — prefer it.
   */
  readonly contextRoot?: string | null;
  /**
   * `collection` for an array row naming where its elements come from, `value` for a scalar.
   * Absent on a response from a modulith older than the field, where every row is a value.
   */
  readonly kind?: "value" | "collection";
}

/**
 * The template roots a target's contract accepts, or null when the server did not report
 * them (a modulith older than the field). Null means "unknown", not "the static four": a
 * contract's arrays introduce roots that cannot be derived client-side, so callers pass this
 * straight to `checkTemplate`, which then skips the unknown-root rule instead of rejecting a
 * mapping the server would store.
 */
export function contractRoots(
  target: DispatchTarget | undefined,
  /** The draft mapping, whose collection rows introduce roots the server has not seen. */
  templates?: Record<string, string>
): readonly string[] | null {
  const reported = target?.templateRoots?.length ? target.templateRoots : null;
  // Unknown stays unknown: adding the few roots the draft happens to declare would make the
  // check look authoritative while it still cannot see what the contract itself introduces.
  if (!reported) return null;
  const declared = templates ? declaredBindNames(target, templates) : [];
  return declared.length ? [...new Set([...reported, ...declared])] : reported;
}

/** The array rows of a contract — the ones that name where their elements come from. */
export function collectionFields(
  target: DispatchTarget | undefined
): readonly DispatchTargetField[] {
  return target?.fields.filter((field) => field.kind === "collection") ?? [];
}

/** The root a collection row's mapping binds its elements under: its path's last segment. */
export function bindNameOf(template: string | undefined): string | null {
  const path = collectionPathOf(template);
  if (!path) return null;
  const dot = path.lastIndexOf(".");
  return dot < 0 ? path : path.slice(dot + 1);
}

/**
 * The context path a collection row names, or null when it names none usably. Mirrors the
 * server's `PayloadSchema.collectionPathOf`: exactly one stash holding a dotted path, where a
 * bare root is legal — a collection row points at a collection rather than producing a value.
 */
export function collectionPathOf(template: string | undefined): string | null {
  const trimmed = template?.trim() ?? "";
  if (!trimmed.startsWith("{{") || !trimmed.endsWith("}}") || trimmed.length < 5) {
    return null;
  }
  const inner = trimmed.slice(2, -2).trim();
  const usable =
    inner.length > 0 &&
    /^[A-Za-z0-9_.]+$/.test(inner) &&
    !inner.startsWith(".") &&
    !inner.endsWith(".") &&
    !inner.includes("..");
  return usable ? inner : null;
}

function declaredBindNames(
  target: DispatchTarget | undefined,
  templates: Record<string, string>
): string[] {
  return collectionFields(target)
    .map((field) => bindNameOf(templates[field.id]))
    .filter((name): name is string => name !== null);
}

/**
 * The root a row's templates are read under, preferring what the **draft mapping** says over the
 * contract's own view: once the operator names an array's collection, that decides the scope of
 * every row inside it, and the server's value was only ever the schema's guess.
 */
export function scopeOfRow(
  field: DispatchTargetField,
  target: DispatchTarget | undefined,
  templates: Record<string, string>
): string | null {
  // The innermost collection row that encloses this one — `items.notes` beats `items` for
  // `items.notes.code`.
  const enclosing = collectionFields(target)
    .filter((row) => field.id.startsWith(`${row.id}.`))
    .sort((a, b) => b.id.length - a.id.length)[0];
  if (!enclosing) return field.contextRoot ?? null;
  return bindNameOf(templates[enclosing.id]) ?? field.contextRoot ?? null;
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
  // A collection row is never demanded: leaving its source unmapped falls back to the contract's
  // own, so blocking a save on it would refuse a mapping the server stores.
  return target.fields.filter(
    (field) =>
      field.required &&
      field.kind !== "collection" &&
      !templates[field.id]?.trim()
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
