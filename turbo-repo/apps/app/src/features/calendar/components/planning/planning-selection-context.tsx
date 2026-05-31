// Back-compat surface for the freight planning calendar.
//
// The generic planning core now lives in @microboxlabs/miot-calendar-ui and the
// freight domain wiring in ./planning-selection-wrapper. This module keeps the
// historical `./planning-selection-context` import path resolving the same
// names so existing consumers don't churn. (Slated for removal in R5.)

import {
  usePlanningSelection as usePlanningSelectionGeneric,
  type PlanningSelectionContextValue,
  type PlannedService as GenericPlannedService,
  type ReassigningService as GenericReassigningService,
  type AssigningService as GenericAssigningService,
} from "@microboxlabs/miot-calendar-ui";
import type { SelectedService, TaskStage } from "./planning-selection-types";

// ── generic primitives now owned by the package ──
export {
  TIME_WINDOW_COLORS,
  TimeWindowUtils,
  getWeekOfMonth,
  isTimeWindow,
  isTimeBlock,
} from "@microboxlabs/miot-calendar-ui";
export type {
  TimeWindowColor,
  TimeSlot,
  TimeWindow,
  TimeBlock,
  ParsedWeeklyPattern,
  SelectedSlot,
} from "@microboxlabs/miot-calendar-ui";

// ── freight domain (stays app-side) ──
export {
  DEBUG_SHOW_TEST_SERVICE,
  TEST_SERVICES,
  TEST_SERVICE,
  getLeadTimeStatus,
} from "./planning-selection-types";
export type {
  SelectedService,
  TripType,
  TaskStage,
  LeadTimeData,
} from "./planning-selection-types";

// ── the host wrapper that builds the CalendarHost + renders the core ──
export { PlanningSelectionProvider } from "./planning-selection-wrapper";

/** Planned/reassigning/assigning models bound to the freight item type. */
export type PlannedService = GenericPlannedService<SelectedService>;
export type ReassigningService = GenericReassigningService<SelectedService>;
export type AssigningService = GenericAssigningService<SelectedService>;

/**
 * The freight-bound planning selection contract. Identical to the package's
 * generic value with `getLiveTask`'s `stage` narrowed back to the freight
 * `TaskStage` union (the host resolves live tasks with that exact type).
 */
export type PlanningSelectionContextType = Omit<
  PlanningSelectionContextValue<SelectedService>,
  "getLiveTask"
> & {
  getLiveTask: (
    serviceCode: string | undefined
  ) => { taskId: string; stage: TaskStage } | undefined;
};

/** Read the freight planning selection context. */
export function usePlanningSelection(): PlanningSelectionContextType {
  return usePlanningSelectionGeneric<SelectedService>() as PlanningSelectionContextType;
}
