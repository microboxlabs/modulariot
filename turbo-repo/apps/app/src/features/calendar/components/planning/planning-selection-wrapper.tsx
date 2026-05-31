"use client";

import { useCallback, useMemo, useState, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import dayjs from "dayjs";
import { z } from "zod";
import {
  PlanningSelectionProvider as CorePlanningSelectionProvider,
  type BookingPersistContext,
  type CalendarHost,
  type CalendarItem,
  type PlannedService,
  type SelectedSlot,
  type TimeSlot,
} from "@microboxlabs/miot-calendar-ui";
import {
  useCalendarTimeWindows,
  useCalendarSlots,
  useCalendars,
  useMyTasks,
  createCalendarTimeWindow,
  updateCalendarTimeWindow,
  deactivateCalendarTimeWindow,
  createBooking,
  moveBooking,
  updateBooking,
  cancelBooking,
  listBookings,
  updateServiceCategory,
  advanceWorkflowTask,
  notifyCalendarBinding,
  type BookingTaskAdvance,
} from "@/features/common/providers/client-api.provider";
import { parseUrlDate } from "@/features/calendar/services/calendar.service";
import {
  apiToLocalTimeWindow,
  localToApiTimeWindow,
  TimeWindowResponseSchema,
} from "@/features/calendar/services/time-window.service";
import {
  asTaskStageFromColumn,
  getNextTransition,
  getUnplanTransition,
  getUnassignTransition,
} from "@/features/calendar/services/task-stage-transitions";
import {
  decideUnplanBindingNotification,
  decideUnassignBindingNotification,
} from "@/features/calendar/services/task-driven-binding-gate";
import {
  decideAssignTaskAdvance,
  getTaskDrivenUnassignTransition,
} from "@/features/calendar/services/task-driven-assign";
import { decidePlanTaskAdvance } from "@/features/calendar/services/task-driven-plan";
import { useTaskDrivenOrigins } from "@/features/calendar/services/use-task-driven-origins";
import { ShowNotification } from "@/features/notifications/notification";
import { tr } from "@/features/i18n/tr.service";
import type { I18nDictionary } from "@/features/i18n/i18n.service.types";
import { useCalendarViewMode } from "./use-calendar-view-mode";
import type { SelectedService, TaskStage } from "./planning-selection-types";

/**
 * Zod schema for data stored inside booking.resource.data. All SelectedService
 * fields are optional (defaults applied on merge). `_anden` is stored here
 * because SlotData has no andén field.
 */
const StoredServiceSchema = z
  .object({
    mintral_clientRut: z.string().optional(),
    mintral_delegacionOrigen: z.string().optional(),
    /**
     * Stable business id for the service. Persisted because `resource.id` is a
     * derived display label whose format is owed to the kanban transform —
     * keeping the raw code lets the live-task lookup work without parsing.
     */
    mintral_serviceCode: z.string().optional(),
    origen: z.string().optional(),
    lugarCarguio: z.string().optional(),
    destino: z.string().optional(),
    tipoViaje: z.enum(["Sider", "Doble Sider", "Rampla"]).optional(),
    mintral_serviceType: z.string().optional(),
    ocupacion: z.number().optional(),
    permanencia: z.string().optional(),
    leadTime: z
      .object({
        total_lineasoc_cumplen: z.number(),
        total_lineasoc_incumplen: z.number(),
        // null means "not measured yet" — distinct from a measured 0%.
        lineasoc_pctn_cumplimiento: z.number().nullable(),
      })
      .optional(),
    eta: z.string().optional(),
    incidencias: z.array(z.string()).optional(),
    mintral_incidents: z.array(z.tuple([z.string(), z.string()])).optional(),
    observaciones: z.string().optional(),
    prioridad: z.number().optional(),
    cm_created: z.string().optional(),
    loadConstraint: z.string().optional(),
    loadMaxUtilization: z.number().optional(),
    loadWeightUtilization: z.number().optional(),
    loadPalletUtilization: z.number().optional(),
    loadVolumeUtilization: z.number().optional(),
    serviceCategory: z.string().optional(),
    expectedDepartureDate: z.string().optional(),
    presentationDate: z.string().optional(),
    assignedDriver: z.string().optional(),
    assignedDriver2: z.string().optional(),
    assignedCarrier: z.string().optional(),
    assignedTruck: z.string().optional(),
    assignedTrailer: z.string().optional(),
    assignedCarrierExternalId: z.string().nullable().optional(),
    assignedDriverExternalId: z.string().nullable().optional(),
    assignedDriver2ExternalId: z.string().nullable().optional(),
    assignedTruckExternalId: z.string().nullable().optional(),
    assignedTrailerExternalId: z.string().nullable().optional(),
    _anden: z.number().optional(),
  })
  .optional();

async function cancelBookingWithWarning(
  bookingId: string,
  message: string
): Promise<void> {
  await cancelBooking(bookingId).catch((err) => console.warn(message, err));
}

async function syncServiceCategoryWithWorkflow(
  service: SelectedService,
  bookingId: string,
  liveTaskId: string | undefined
): Promise<void> {
  if (!service.serviceCategory) return;
  if (!liveTaskId) {
    // No live Alfresco task surfaced — the binding tuple was already captured
    // by the bookings POST → coordinator webscript, so rolling back here would
    // drift state for no upside. Log + skip; a future action retries.
    console.warn(
      "Service category sync skipped — no live Alfresco task for service",
      service.mintral_serviceCode,
      "(category:",
      service.serviceCategory,
      ", booking:",
      bookingId,
      ")"
    );
    return;
  }
  try {
    await updateServiceCategory(liveTaskId, service.serviceCategory);
  } catch (err) {
    await cancelBookingWithWarning(
      bookingId,
      "Failed to cancel booking after service category update error:"
    );
    throw err;
  }
}

/**
 * Task-driven PLAN move: ECM's `OnCreateAssignDriverBinding` writes the
 * `cld_bookings` row itself from the slot processVariables on the
 * `assignDriver` create. The FE must NOT POST a booking. Signaled by a
 * `PlanProcessVariables` shape (presence of `calendar_id`) AND no
 * `oldBookingId` (a re-plan still routes through the atomic move).
 */
function isTaskDrivenPlanCreate(
  oldBookingId: string | undefined,
  taskAdvance: BookingTaskAdvance | undefined
): boolean {
  if (oldBookingId) return false;
  const vars = taskAdvance?.processVariables;
  return !!vars && "calendar_id" in vars;
}

/**
 * Task-driven ASSIGN move: ECM's `OnCreatePresentDriverBinding` updates the
 * row from the resource tuple in processVariables on the `presentDriver`
 * create. The FE must NOT PUT a booking. Signaled by an
 * `AssignProcessVariables` shape (presence of `carrier_id`).
 */
function isTaskDrivenAssignUpdate(
  taskAdvance: BookingTaskAdvance | undefined
): boolean {
  const vars = taskAdvance?.processVariables;
  return !!vars && "carrier_id" in vars;
}

interface PlanningSelectionProviderProps {
  readonly children: ReactNode;
  readonly calendarId?: string;
  readonly dict: I18nDictionary;
}

/**
 * Freight-domain wrapper around the generic package provider. Builds the
 * {@link CalendarHost} (booking API, live-task resolver, workflow/binding
 * hooks) and feeds the data layer (slots, time-windows, bookings) the package
 * keeps framework-agnostic. The task-driven skip-persist decision lives HERE,
 * not in the package — `shouldPersistBooking` returns false for task-driven
 * origins so the backend listener writes the row.
 */
export function PlanningSelectionProvider({
  children,
  calendarId,
  dict,
}: PlanningSelectionProviderProps) {
  // Persist-boundary permission flag. The `?as=viewer` override collapses
  // canPlan/canAssign to false, so a planner previewing viewer mode is treated
  // as a viewer here too.
  const { canPlan, canAssign, canView, isLoadingPermissions } =
    useCalendarViewMode();
  const canMutateBookings = !isLoadingPermissions && (canPlan || canAssign);

  const taskDrivenOrigins = useTaskDrivenOrigins();

  // Calendar parallelism (number of andenes).
  const { calendars } = useCalendars();
  const parallelism = useMemo(
    () =>
      calendarId
        ? calendars.find((c) => c.id === calendarId)?.parallelism
        : undefined,
    [calendars, calendarId]
  );

  // Time windows from the backend, mirrored into package grid state.
  const {
    timeWindows: apiTimeWindows,
    error: timeWindowsError,
    refresh: refreshTimeWindows,
  } = useCalendarTimeWindows(calendarId ?? null);

  const apiTimeSlots = useMemo<TimeSlot[]>(
    () =>
      apiTimeWindows.flatMap((tw) => {
        const result = TimeWindowResponseSchema.safeParse(tw);
        if (!result.success) {
          console.warn(
            "Skipping invalid time window response",
            tw,
            result.error.message
          );
          return [];
        }
        return [apiToLocalTimeWindow(result.data)];
      }),
    [apiTimeWindows]
  );

  const deactivateRemovedWindows = useCallback(
    async (newSlotIds: Set<string>): Promise<string[]> => {
      if (!calendarId) return [];
      const errors: string[] = [];
      for (const apiWindow of apiTimeWindows) {
        if (!newSlotIds.has(apiWindow.id)) {
          try {
            await deactivateCalendarTimeWindow(calendarId, apiWindow);
          } catch (err) {
            errors.push(
              `Failed to deactivate "${apiWindow.name}": ${err instanceof Error ? err.message : "unknown error"}`
            );
          }
        }
      }
      return errors;
    },
    [calendarId, apiTimeWindows]
  );

  const saveLocalSlots = useCallback(
    async (slots: TimeSlot[], currentIds: Set<string>): Promise<string[]> => {
      if (!calendarId) return [];
      const errors: string[] = [];
      for (const slot of slots) {
        try {
          const body = localToApiTimeWindow(slot);
          if (currentIds.has(slot.id)) {
            await updateCalendarTimeWindow(calendarId, slot.id, body);
          } else {
            await createCalendarTimeWindow(calendarId, body);
          }
        } catch (err) {
          errors.push(
            `Failed to save "${slot.name}": ${err instanceof Error ? err.message : "unknown error"}`
          );
        }
      }
      return errors;
    },
    [calendarId]
  );

  const syncTimeSlots = useCallback(
    async (slots: TimeSlot[]) => {
      if (!calendarId) return;
      const currentIds = new Set(apiTimeWindows.map((w) => w.id));
      const newSlotIds = new Set(slots.map((s) => s.id));
      const [deactivateErrors, saveErrors] = await Promise.all([
        deactivateRemovedWindows(newSlotIds),
        saveLocalSlots(slots, currentIds),
      ]);
      // Reload from API to replace temp IDs with real server IDs.
      await refreshTimeWindows();
      const errors = [...deactivateErrors, ...saveErrors];
      if (errors.length > 0) throw new Error(errors.join("; "));
    },
    [
      calendarId,
      apiTimeWindows,
      deactivateRemovedWindows,
      saveLocalSlots,
      refreshTimeWindows,
    ]
  );

  // Backend slots for the date the package reports as selected.
  const [slotDate, setSlotDate] = useState<string | null>(null);
  const {
    slots: backendSlots,
    isLoading: isSlotsLoading,
    refresh: refreshSlots,
  } = useCalendarSlots(calendarId ?? null, slotDate);

  // Live workflow index keyed by mintral_serviceCode — intentionally NOT scoped
  // by calendarId (the kanban API would otherwise exclude already-planned
  // services). Booking never persists taskId because Alfresco mints a new task
  // per workflow stage; this is the single source of truth for "which Alfresco
  // task represents service X right now".
  const { data: liveTasksData, refresh: refreshLiveTasks } = useMyTasks(
    [
      "planService",
      "assignDriver",
      "presentDriver",
      "prepareService",
      "missionControl",
    ],
    false,
    1,
    500
  );

  const serviceCodeToLiveTask = useMemo<
    Map<string, { taskId: string; stage: TaskStage }>
  >(() => {
    const map = new Map<string, { taskId: string; stage: TaskStage }>();
    if (!liveTasksData?.data) return map;
    for (const [columnKey, board] of Object.entries(liveTasksData.data)) {
      const stage = asTaskStageFromColumn(columnKey);
      if (!stage) continue;
      for (const task of board.tasks) {
        const code = task.mintral_serviceCode;
        if (code) map.set(code, { taskId: task.id, stage });
      }
    }
    return map;
  }, [liveTasksData]);

  const getLiveTask = useCallback(
    (serviceCode: string | undefined) =>
      serviceCode ? serviceCodeToLiveTask.get(serviceCode) : undefined,
    [serviceCodeToLiveTask]
  );

  // ±30-day window around the URL `date` param — the upstream bookings endpoint
  // returns empty with no range, and this stays well inside the 90-day cap.
  const searchParams = useSearchParams();
  const bookingsRange = useMemo(() => {
    const anchor = parseUrlDate(searchParams.get("date")) ?? dayjs();
    return {
      startDate: anchor.subtract(30, "day").format("YYYY-MM-DD"),
      endDate: anchor.add(30, "day").format("YYYY-MM-DD"),
    };
  }, [searchParams]);
  const bookingsKey = `${calendarId ?? ""}:${bookingsRange.startDate}:${bookingsRange.endDate}`;
  const bookingsLoadErrorMessage = useMemo(
    () => tr("pages.planning.sidebar.notifications.bookingsLoadError", dict),
    [dict]
  );

  const loadBookings = useCallback(
    async (signal: AbortSignal) => {
      const ids = new Map<string, string>();
      const planned: PlannedService<SelectedService>[] = [];
      if (!calendarId) return { planned, ids };
      const result = await listBookings(
        {
          calendarId,
          startDate: bookingsRange.startDate,
          endDate: bookingsRange.endDate,
        },
        signal
      );
      for (const booking of result.data) {
        // Skip entries whose slot is missing — nothing to place on the grid.
        if (!booking.slot) continue;
        const storedParse = StoredServiceSchema.safeParse(booking.resource.data);
        const stored = storedParse.success ? storedParse.data : undefined;
        // Keep _anden separate so it is not spread into SelectedService.
        const { _anden, ...storedService } = stored ?? {};
        const service: SelectedService = {
          origen: "",
          lugarCarguio: "",
          destino: "",
          tipoViaje: "Sider",
          ocupacion: 0,
          permanencia: "",
          leadTime: {
            total_lineasoc_cumplen: 0,
            total_lineasoc_incumplen: 0,
            lineasoc_pctn_cumplimiento: 0,
          },
          eta: "",
          incidencias: [],
          observaciones: "",
          prioridad: 0,
          ...storedService,
          // Canonical booking fields always win over stored data.
          id: booking.resource.id,
          cliente: booking.resource.label ?? booking.resource.id,
          // Recover the code from the `${code}-${type}` resource id prefix for
          // legacy bookings written before mintral_serviceCode was persisted.
          mintral_serviceCode:
            storedService.mintral_serviceCode ??
            booking.resource.id.split("-")[0],
        };
        planned.push({
          service,
          slot: {
            date: dayjs(booking.slot.date).toDate(),
            hour: booking.slot.hour,
            minutes: booking.slot.minutes,
            ...(_anden === undefined ? {} : { anden: _anden }),
          },
        });
        ids.set(booking.resource.id, booking.id);
      }
      return { planned, ids };
    },
    [calendarId, bookingsRange.startDate, bookingsRange.endDate]
  );

  // Resolve the live task + the workflow transition/processVariables tuple for a
  // confirm. Mirrors the original persistPlannedBooking decision so task-driven
  // skip-persist and the plan/assign branching stay byte-for-byte equivalent.
  const computeTaskAdvance = useCallback(
    (service: SelectedService, slot: SelectedSlot, ctx: BookingPersistContext) => {
      const liveTask = getLiveTask(service.mintral_serviceCode);
      // Reassignment only changes the slot; the task was already advanced.
      const transitionId = ctx.isReassigning
        ? undefined
        : getNextTransition(liveTask?.stage);
      const planProcessVariables = decidePlanTaskAdvance(
        transitionId,
        service.origen,
        calendarId,
        slot,
        taskDrivenOrigins,
        service.serviceCategory
      );
      const assignProcessVariables = decideAssignTaskAdvance(
        transitionId,
        service.origen,
        service,
        taskDrivenOrigins
      );
      const processVariables = planProcessVariables ?? assignProcessVariables;
      const taskAdvance: BookingTaskAdvance | undefined =
        transitionId && liveTask?.taskId
          ? {
              taskId: liveTask.taskId,
              transitionId,
              ...(processVariables ? { processVariables } : {}),
            }
          : undefined;
      return { liveTask, taskAdvance };
    },
    [getLiveTask, calendarId, taskDrivenOrigins]
  );

  const host = useMemo<CalendarHost<SelectedService>>(
    () => ({
      client: { baseUrl: "/app/api/calendar" },
      calendarId: calendarId ?? "",
      toItem: (raw): CalendarItem => ({
        id: raw.id,
        title: raw.cliente,
        raw,
      }),
      bookingApi: {
        createBooking,
        moveBooking,
        updateBooking,
        cancelBooking,
        listBookings,
      },
      getLiveTask,
      hooks: {
        shouldPersistBooking: (item, slot, ctx) => {
          const service = item.raw as SelectedService;
          const { taskAdvance } = computeTaskAdvance(service, slot, ctx);
          return !(
            isTaskDrivenPlanCreate(ctx.oldBookingId, taskAdvance) ||
            isTaskDrivenAssignUpdate(taskAdvance)
          );
        },
        afterPlan: async (item, slot, ctx) => {
          const service = item.raw as SelectedService;
          const { liveTask, taskAdvance } = computeTaskAdvance(
            service,
            slot,
            ctx
          );
          // Task-driven PLAN: ECM writes the row; sync the category onto the
          // live task (best-effort, no booking to roll back) then advance.
          if (isTaskDrivenPlanCreate(ctx.oldBookingId, taskAdvance) && taskAdvance) {
            if (liveTask?.taskId && service.serviceCategory) {
              try {
                await updateServiceCategory(
                  liveTask.taskId,
                  service.serviceCategory
                );
              } catch (err) {
                console.warn(
                  "Failed to sync service category before task-driven plan move:",
                  err
                );
                throw err;
              }
            }
            await advanceWorkflowTask(
              taskAdvance.taskId,
              taskAdvance.transitionId,
              taskAdvance.processVariables
            );
            return;
          }
          // Task-driven ASSIGN: ECM updates the row; just advance the task.
          if (isTaskDrivenAssignUpdate(taskAdvance) && taskAdvance) {
            await advanceWorkflowTask(
              taskAdvance.taskId,
              taskAdvance.transitionId,
              taskAdvance.processVariables
            );
            return;
          }
          // Legacy: booking already written by the package — sync category
          // (rolls the booking back on failure) then advance the task.
          if (ctx.booking) {
            await syncServiceCategoryWithWorkflow(
              service,
              ctx.booking.id,
              liveTask?.taskId
            );
          }
          if (taskAdvance) {
            await advanceWorkflowTask(
              taskAdvance.taskId,
              taskAdvance.transitionId,
              taskAdvance.processVariables
            );
          }
        },
        afterCancel: async (item) => {
          const service = item.raw as SelectedService;
          // Reverse the workflow task toward planService BEFORE the package
          // cancels the booking. A failed transition aborts the removal.
          const liveTask = getLiveTask(service.mintral_serviceCode);
          if (liveTask) {
            const transition = getUnplanTransition(liveTask.stage);
            if (transition) {
              await advanceWorkflowTask(liveTask.taskId, transition);
            }
          }
          // Tell the coordinator the service left the calendar (best-effort;
          // task-driven origins reconcile via the ECM listener and are skipped).
          const notification = decideUnplanBindingNotification(
            service.mintral_serviceCode,
            calendarId,
            service.origen,
            taskDrivenOrigins
          );
          if (notification) {
            await notifyCalendarBinding(notification).catch((err) =>
              console.warn("Failed to notify calendar binding (none):", err)
            );
          }
        },
        onUnassign: async (service) => {
          // Reverse the workflow task BEFORE the package rewrites the booking.
          const liveTask = getLiveTask(service.mintral_serviceCode);
          if (liveTask) {
            const transition =
              getTaskDrivenUnassignTransition(
                liveTask.stage,
                service.origen,
                taskDrivenOrigins
              ) ?? getUnassignTransition(liveTask.stage);
            if (transition) {
              await advanceWorkflowTask(liveTask.taskId, transition);
            }
          }
          const notification = decideUnassignBindingNotification(
            service.mintral_serviceCode,
            calendarId,
            service.origen,
            taskDrivenOrigins
          );
          if (notification) {
            await notifyCalendarBinding(notification).catch((err) =>
              console.warn(
                "Failed to notify calendar binding (unassigned):",
                err
              )
            );
          }
          // Return the service with its assignment tuple cleared.
          return {
            ...service,
            assignedCarrier: undefined,
            assignedDriver: undefined,
            assignedDriver2: undefined,
            assignedTruck: undefined,
            assignedTrailer: undefined,
          };
        },
      },
      i18n: {
        dict,
        // Adapt the app's narrowly-typed `tr` to the contract's generic
        // `(path, dict: unknown, params?: Record<string, unknown>)` shape.
        tr: (path, d, params) =>
          tr(
            path,
            d as Parameters<typeof tr>[1],
            params as Parameters<typeof tr>[2]
          ),
      },
      notify: (n) => ShowNotification(n),
      permissions: { canPlan, canAssign, canView },
    }),
    [
      calendarId,
      getLiveTask,
      computeTaskAdvance,
      taskDrivenOrigins,
      dict,
      canPlan,
      canAssign,
      canView,
    ]
  );

  return (
    <CorePlanningSelectionProvider<SelectedService>
      host={host}
      calendarId={calendarId}
      canMutateBookings={canMutateBookings}
      backendSlots={backendSlots}
      isSlotsLoading={isSlotsLoading}
      refreshSlots={refreshSlots}
      apiTimeSlots={apiTimeSlots}
      timeWindowsError={Boolean(timeWindowsError)}
      syncTimeSlots={syncTimeSlots}
      parallelism={parallelism}
      loadBookings={loadBookings}
      bookingsKey={bookingsKey}
      bookingsLoadErrorMessage={bookingsLoadErrorMessage}
      onSelectedDateChange={setSlotDate}
      onBookingChange={refreshLiveTasks}
    >
      {children}
    </CorePlanningSelectionProvider>
  );
}
