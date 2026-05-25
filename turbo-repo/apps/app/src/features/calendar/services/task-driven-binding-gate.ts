import { isOriginTaskDriven } from "./task-driven-origin";

/**
 * Decision helper for the planner's unplan path: returns the
 * `notifyCalendarBinding` payload to send (stage `"none"`) when the
 * coordinator must be told a service left a calendar — or `null` when the
 * call should be skipped.
 *
 * Skipped when:
 * - the service has no business `mintral_serviceCode` to bind by;
 * - there is no `calendarId` in scope;
 * - the service's origin is task-driven (P2 — the ECM listener on the
 *   workflow's unplan move reconciles the binding to `none` on its own,
 *   so the frontend's webscript call would just double-bind).
 *
 * Kept in its own file (not co-located inside the planner context module)
 * so the unplan flag-gating can be exercised by a unit test without
 * pulling the planner context's full React/import graph into the test
 * worker. Mirrors the `isOriginTaskDriven` rollout flag — flag default OFF
 * means today's behavior is preserved for every origin.
 */
export type UnplanBindingNotification = {
  numero_servicio: string;
  calendar_id: string;
  stage: "none";
};

export function decideUnplanBindingNotification(
  numeroServicio: string | undefined,
  calendarId: string | undefined,
  origin: string | undefined
): UnplanBindingNotification | null {
  if (!numeroServicio || !calendarId) return null;
  if (isOriginTaskDriven(origin)) return null;
  return {
    numero_servicio: numeroServicio,
    calendar_id: calendarId,
    stage: "none",
  };
}

/**
 * Decision helper for the planner's UNASSIGN path: returns the
 * `notifyCalendarBinding` payload to send (stage `"unassigned"`) when the
 * coordinator must be told a service dropped its driver/transport tuple —
 * or `null` when the call should be skipped.
 *
 * Skipped when:
 * - the service has no business `mintral_serviceCode` to bind by;
 * - there is no `calendarId` in scope;
 * - the service's origin is task-driven (P3 — the ECM
 *   `OnCreateAssignDriverBinding` listener on the workflow's
 *   `presentDriver → assignDriver` move reconciles the binding to
 *   `unassigned` on its own, so the frontend's webscript call would just
 *   double-bind).
 *
 * Mirrors `decideUnplanBindingNotification` so the unassign flag-gating
 * can be exercised by a unit test without pulling the planner context's
 * full React/import graph into the test worker.
 */
export type UnassignBindingNotification = {
  numero_servicio: string;
  calendar_id: string;
  stage: "unassigned";
};

export function decideUnassignBindingNotification(
  numeroServicio: string | undefined,
  calendarId: string | undefined,
  origin: string | undefined
): UnassignBindingNotification | null {
  if (!numeroServicio || !calendarId) return null;
  if (isOriginTaskDriven(origin)) return null;
  return {
    numero_servicio: numeroServicio,
    calendar_id: calendarId,
    stage: "unassigned",
  };
}
