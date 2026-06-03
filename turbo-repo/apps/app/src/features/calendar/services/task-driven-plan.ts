import dayjs from "dayjs";
import { isOriginTaskDriven } from "./task-driven-origin";

/**
 * Structural subset of `SelectedSlot` consumed by the plan-side helper.
 * Declared locally to keep this module free of any dependency on
 * `planning-selection-context.tsx` (which would pull the React/import
 * graph into worker tests).
 */
export type PlanSlotInput = {
  date: Date | string;
  hour: number;
  minutes: number;
};

/**
 * PROCESS-scope variable tuple set on the workflow before completing the
 * planner's task-driven PLAN move (`planService → assignDriver` via the
 * BPMN's `"Asignar Conductor/Transporte"` outcome). ECM's
 * `OnCreateAssignDriverBinding` listener reads these on the `assignDriver`
 * task's `create` event to write the `cld_bookings` row itself
 * (ecm-coordinator#266 E2). All values are strings — `slot_hour` /
 * `slot_minutes` ride as decimal strings to match the existing
 * `processVariables` body shape on `POST /alfresco/s/mintral/tasks/end`
 * (ecm-coordinator#262), which is uniformly string-keyed.
 *
 * `mintral_serviceCategory` is included alongside the slot keys (instead
 * of relying on the `updateTaskServiceCategory` PATCH alone) because the
 * task-form processor writes `prop_mintral_serviceCategory` to the **task
 * node**, which does not propagate to **process scope** before
 * `OnCreateAssignDriverBinding.onCreate` fires. The ECM allow-list
 * accepts this key (camelCase + `mintral_` prefix matches the existing
 * `MintralModel.VAR_SERVICE_CATEGORY` process variable name across the
 * codebase) — see ecm-coordinator#270.
 *
 * See `docs/plans/calendar-task-driven-frontend-P0-spike.md` §2.2 for the
 * wire contract, and `ecm-driven-booking-lifecycle-spike.md` §8 in
 * ecm-coordinator for the FE-side companion contract this implements.
 */
export type PlanProcessVariables = {
  calendar_id: string;
  slot_date: string;
  slot_hour: string;
  slot_minutes: string;
  /**
   * Optional: when the planner sidebar form sets a service category, it
   * rides here so ECM's `OnCreateAssignDriverBinding` can persist it on
   * `cld_bookings.resource_data.serviceCategory`. Omitted when the form
   * leaves the category blank.
   */
  mintral_serviceCategory?: string;
};

export function buildPlanProcessVariables(
  calendarId: string | undefined,
  slot: PlanSlotInput,
  serviceCategory?: string
): PlanProcessVariables | null {
  if (!calendarId) return null;
  const base: PlanProcessVariables = {
    calendar_id: calendarId,
    slot_date: dayjs(slot.date).format("YYYY-MM-DD"),
    slot_hour: String(slot.hour),
    slot_minutes: String(slot.minutes),
  };
  if (serviceCategory) {
    base.mintral_serviceCategory = serviceCategory;
  }
  return base;
}

/**
 * Returns the planner's task-driven PLAN-move processVariables when the
 * origin is task-driven AND the forward transition is the BPMN's
 * `planService → assignDriver` flow (`"Asignar Conductor/Transporte"`).
 *
 * Returns `null` for every other case — including a task-driven origin
 * whose live task is at `assignDriver` (the ASSIGN move uses the resource
 * tuple via {@link decideAssignTaskAdvance}) or any flag-off origin — and
 * the caller proceeds with the legacy booking-POST flow, preserving
 * today's behavior byte-for-byte.
 *
 * The presence of these variables on the task move is the FE signal that
 * the booking row should NOT be written by the BFF: ECM's
 * `OnCreateAssignDriverBinding` writes the row itself from the
 * processVariables on the `assignDriver` create event.
 */
export function decidePlanTaskAdvance(
  transitionId: string | undefined,
  origin: string | undefined,
  calendarId: string | undefined,
  slot: PlanSlotInput,
  enabledOrigins: ReadonlySet<string>,
  serviceCategory?: string
): PlanProcessVariables | null {
  if (transitionId !== "Asignar Conductor/Transporte") return null;
  if (!isOriginTaskDriven(origin, enabledOrigins)) return null;
  return buildPlanProcessVariables(calendarId, slot, serviceCategory);
}
