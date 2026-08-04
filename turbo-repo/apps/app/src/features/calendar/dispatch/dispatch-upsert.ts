/**
 * Pure assembly + pre-flight checks for the dispatch-binding form, mirroring
 * the modulith's `IntegrationEventBindingService` validation one for one —
 * the same preview-must-not-outrun-the-server rule `checkTemplate` follows.
 * Server-side validation stays the authority; these rules only keep the Save
 * button honest.
 */

import {
  DISPATCH_EVENT_TYPE,
  DISPATCH_SCOPE_KIND,
  type UpsertDispatchBinding,
} from "./dispatch.types";

/** One editable condition row: a path under `response` and its expected value. */
export type ConditionRow = readonly [path: string, value: string];

export interface DispatchFormState {
  readonly connectionId: string;
  readonly operationId: string;
  readonly scopeCalendarId: string | null;
  readonly fieldTemplates: Record<string, string>;
  readonly fieldDefaults: Record<string, string>;
  readonly successRows: readonly ConditionRow[];
  readonly retryRows: readonly ConditionRow[];
  readonly enabled: boolean;
}

/** A pre-flight problem, as a code the UI translates. */
export type DispatchFormProblem =
  | { readonly code: "defaultWithoutTemplate"; readonly fieldId: string }
  | { readonly code: "conditionPathOutsideResponse"; readonly path: string }
  | { readonly code: "retryWithoutSuccess" };

function filledRows(rows: readonly ConditionRow[]): ConditionRow[] {
  return rows.filter(([path, value]) => path.trim() !== "" && value.trim() !== "");
}

/**
 * The server refuses a default on a field that has no template mapping (a
 * default is a fallback for an empty render, not a mapping of its own), any
 * condition path rooted outside `response`, and a `retry` block with no
 * `success` (success is what releases the confirm leg — retry alone is
 * unclassifiable).
 */
export function dispatchFormProblems(
  state: DispatchFormState
): DispatchFormProblem[] {
  const problems: DispatchFormProblem[] = [];
  for (const [fieldId, literal] of Object.entries(state.fieldDefaults)) {
    if (literal.trim() === "") continue;
    if ((state.fieldTemplates[fieldId] ?? "").trim() === "") {
      problems.push({ code: "defaultWithoutTemplate", fieldId });
    }
  }
  const success = filledRows(state.successRows);
  const retry = filledRows(state.retryRows);
  for (const [path] of [...success, ...retry]) {
    if (path !== "response" && !path.startsWith("response.")) {
      problems.push({ code: "conditionPathOutsideResponse", path });
    }
  }
  if (retry.length > 0 && success.length === 0) {
    problems.push({ code: "retryWithoutSuccess" });
  }
  return problems;
}

/**
 * The request body for `PUT /bindings`. Blank template/default rows are
 * dropped (an empty row means "not sent", same as the enrichment form);
 * conditions collapse to `{}` when no success row is filled, which keeps the
 * server's status-code-only classification.
 */
export function buildDispatchUpsert(state: DispatchFormState): UpsertDispatchBinding {
  const success = filledRows(state.successRows);
  const retry = filledRows(state.retryRows);
  const responseConditions: Record<string, Record<string, string>> = {};
  if (success.length > 0) {
    responseConditions.success = Object.fromEntries(success);
    if (retry.length > 0) {
      responseConditions.retry = Object.fromEntries(retry);
    }
  }
  return {
    eventType: DISPATCH_EVENT_TYPE,
    scopeKind: state.scopeCalendarId ? DISPATCH_SCOPE_KIND : null,
    scopeKey: state.scopeCalendarId,
    connectionId: state.connectionId,
    operationId: state.operationId,
    matchCondition: {},
    fieldTemplates: Object.fromEntries(
      Object.entries(state.fieldTemplates).filter(([, template]) => template.trim())
    ),
    responseTemplates: {},
    fieldDefaults: Object.fromEntries(
      Object.entries(state.fieldDefaults).filter(([, literal]) => literal.trim())
    ),
    responseConditions,
    enabled: state.enabled,
  };
}

/** The stored conditions back into editable rows, for the edit flow. */
export function conditionRowsOf(
  conditions: Record<string, Record<string, unknown>> | undefined,
  block: "success" | "retry"
): ConditionRow[] {
  return Object.entries(conditions?.[block] ?? {}).map(
    ([path, value]) => [path, String(value)] as const
  );
}
