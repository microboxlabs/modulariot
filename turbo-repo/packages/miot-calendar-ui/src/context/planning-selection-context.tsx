"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import dayjs from "dayjs";
import isoWeek from "dayjs/plugin/isoWeek";
import isSameOrAfter from "dayjs/plugin/isSameOrAfter";
import {
  createMiotCalendarClient,
  type BookingResponse,
  type ClientConfig,
  type SlotResponse,
} from "@microboxlabs/miot-calendar-client";
import type { CalendarItem } from "../types/calendar-item";
import type { SelectedSlot } from "../types/calendar-slot";
import type {
  AssigningService,
  PlannedService,
  ReassigningService,
} from "../types/planning";
import {
  TimeWindowUtils,
  isTimeBlock,
  isTimeWindow,
  type TimeBlock,
  type TimeSlot,
  type TimeWindow,
} from "../components/planning/time-window";
import type { CalendarHost } from "../contract/calendar-host";
import type { BookingApi, BookingPersistContext } from "../contract/booking-api";
import {
  buildBookingRequest,
  buildMoveRequest,
  buildResource,
  rollbackPlannedService,
} from "../services/booking-persistence";

dayjs.extend(isoWeek);
dayjs.extend(isSameOrAfter);

const MAX_SERVICES_PER_SLOT = 99;

/**
 * The generic, domain-agnostic planning selection surface. Generic over the
 * host's item type (defaults to {@link CalendarItem}); the package only relies
 * on the item carrying a stable `id`. The host supplies all domain behaviour —
 * booking persistence, workflow side-effects, live-task resolution — through
 * {@link CalendarHost} + injected data props.
 */
export interface PlanningSelectionContextValue<
  TItem extends { id: string } = CalendarItem,
> {
  calendarId?: string;
  selectedSlot: SelectedSlot | null;
  selectedService: TItem | null;
  plannedServices: PlannedService<TItem>[];
  /** Unified array of all time slots (windows and blocks). */
  timeSlots: TimeSlot[];
  /** Derived: only TimeWindow slots (filtered from timeSlots). */
  timeWindows: TimeWindow[];
  /** Derived: only TimeBlock slots (filtered from timeSlots). */
  timeBlocks: TimeBlock[];
  /** Number of andenes (platforms) available for simultaneous service. */
  andenesCount: number;
  reassigningService: ReassigningService<TItem> | null;
  assigningService: AssigningService<TItem> | null;
  selectSlot: (slot: SelectedSlot) => void;
  selectService: (service: TItem) => void;
  confirmService: (
    finalSlot?: SelectedSlot,
    serviceOverrides?: Partial<TItem>
  ) => Promise<boolean>;
  clearService: () => void;
  closeSidebar: () => void;
  clearSelection: () => void;
  getServicesForSlot: (slot: SelectedSlot) => PlannedService<TItem>[];
  canAddToSlot: (slot: SelectedSlot) => boolean;
  /** Replace the unified time slots array and sync to the host API. */
  setTimeSlots: (slots: TimeSlot[]) => Promise<void>;
  /** Set only TimeWindow slots (merges with existing blocks) — local only. */
  setTimeWindows: (windows: TimeWindow[]) => void;
  /** Set only TimeBlock slots (merges with existing windows) — local only. */
  setTimeBlocks: (blocks: TimeBlock[]) => void;
  setAndenesCount: (count: number) => void;
  /** Sync the current time slots to the host API (e.g. user clicks "Aplicar"). */
  syncTimeSlotsToAPI: () => Promise<void>;
  getTimeWindowForSlot: (
    date: Date,
    hour: number,
    minutes: number
  ) => TimeWindow | null;
  getRemainingQuota: (timeWindow: TimeWindow, date: Date) => number;
  isSlotBlocked: (date: Date, hour: number, minutes: number) => boolean;
  getBlocksForSlot: (date: Date, hour: number, minutes: number) => TimeBlock[];
  getOccupiedAndenes: (date: Date, hour: number, minutes: number) => number[];
  getAvailableAndenes: (date: Date, hour: number, minutes: number) => number[];
  isSidebarOpen: boolean;
  removeService: (serviceId: string) => Promise<void>;
  removeAssignment: (serviceId: string) => Promise<void>;
  startReassignment: (plannedService: PlannedService<TItem>) => void;
  cancelReassignment: () => void;
  startAssignment: (plannedService: PlannedService<TItem>) => void;
  cancelAssignment: () => void;
  selectChipSlot: (plannedService: PlannedService<TItem>) => void;
  selectChipResource: (plannedService: PlannedService<TItem>) => void;
  inspectPlannedService: (plannedService: PlannedService<TItem>) => void;
  isChipSelected: (serviceId: string) => boolean;
  clearChipSelection: () => void;
  updateServiceAssignment: (
    serviceId: string,
    patch: Partial<TItem>
  ) => void;
  bookingsLoadError: string | null;
  backendSlots: SlotResponse[];
  isSlotsLoading: boolean;
  refreshSlots: () => void;
  bookingVersion: number;
  getLiveTask: (
    serviceCode: string | undefined
  ) => { taskId: string; stage: string } | undefined;
}

const PlanningSelectionContext =
  createContext<PlanningSelectionContextValue<{ id: string }> | null>(null);

/**
 * Props the host wires into the generic provider. The {@link CalendarHost}
 * carries domain behaviour; the remaining fields inject the framework-specific
 * data layer (slots/time-windows/bookings fetched by host hooks) so the package
 * stays framework-agnostic.
 */
export interface PlanningSelectionProviderProps<
  TItem extends { id: string } = CalendarItem,
> {
  readonly children: ReactNode;
  readonly host: CalendarHost<TItem>;
  readonly calendarId?: string;
  /** Persist-boundary permission flag derived from host permissions. */
  readonly canMutateBookings: boolean;
  readonly backendSlots: SlotResponse[];
  readonly isSlotsLoading: boolean;
  readonly refreshSlots: () => void;
  /** Time-window config mirrored from the host API into local grid state. */
  readonly apiTimeSlots: TimeSlot[];
  /** True when the time-window fetch errored (suppresses the local mirror). */
  readonly timeWindowsError: boolean;
  /** Persist edited time slots to the host API (create/update/deactivate diff). */
  readonly syncTimeSlots: (slots: TimeSlot[]) => Promise<void>;
  /** Calendar parallelism (number of andenes); applied once when it loads. */
  readonly parallelism?: number;
  /** Reconstruct planned items for the active window (host domain mapping). */
  readonly loadBookings: (
    signal: AbortSignal
  ) => Promise<{ planned: PlannedService<TItem>[]; ids: Map<string, string> }>;
  /** Stable key that changes when the booking query window changes (reloads). */
  readonly bookingsKey: string;
  /** Localised message shown when the initial bookings load fails. */
  readonly bookingsLoadErrorMessage: string;
  /** Notified of the selected date (YYYY-MM-DD) so the host can fetch slots. */
  readonly onSelectedDateChange?: (date: string | null) => void;
  /** Called after each successful booking mutation (e.g. refresh live tasks). */
  readonly onBookingChange?: () => void;
}

/** Build a default booking API from the host's client config. */
function buildDefaultBookingApi(config: ClientConfig): BookingApi {
  const client = createMiotCalendarClient(config);
  return {
    createBooking: (body) => client.bookings.create(body),
    moveBooking: (id, body) => client.bookings.move(id, body),
    updateBooking: (id, body) => client.bookings.update(id, body),
    cancelBooking: (id) => client.bookings.cancel(id),
    listBookings: (params) => client.bookings.list(params),
  };
}

export function PlanningSelectionProvider<
  TItem extends { id: string } = CalendarItem,
>({
  children,
  host,
  calendarId,
  canMutateBookings,
  backendSlots,
  isSlotsLoading,
  refreshSlots,
  apiTimeSlots,
  timeWindowsError,
  syncTimeSlots,
  parallelism,
  loadBookings,
  bookingsKey,
  bookingsLoadErrorMessage,
  onSelectedDateChange,
  onBookingChange,
}: PlanningSelectionProviderProps<TItem>) {
  const [selectedSlot, setSelectedSlot] = useState<SelectedSlot | null>(null);
  const [selectedService, setSelectedService] = useState<TItem | null>(null);
  // Visual-only "this chip is selected" mark set by right-clicking a chip.
  // Kept separate from selectedService because right-click must not open the
  // sidebar — only selectedSlot/selectedService toggle isSidebarOpen.
  const [selectedChipServiceId, setSelectedChipServiceId] = useState<
    string | null
  >(null);
  const [plannedServices, setPlannedServices] = useState<
    PlannedService<TItem>[]
  >([]);
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([]);
  const [andenesCount, setAndenesCount] = useState<number>(1);
  const [reassigningService, setReassigningService] =
    useState<ReassigningService<TItem> | null>(null);
  const [assigningService, setAssigningService] =
    useState<AssigningService<TItem> | null>(null);
  // Map of item.id -> booking.id from the calendar backend.
  const [bookingIds, setBookingIds] = useState<Map<string, string>>(new Map());
  const [bookingsLoadError, setBookingsLoadError] = useState<string | null>(
    null
  );
  const [bookingVersion, setBookingVersion] = useState(0);

  const bookingApi = useMemo<BookingApi>(
    () => host.bookingApi ?? buildDefaultBookingApi(host.client),
    [host.bookingApi, host.client]
  );

  const getLiveTask = useCallback(
    (serviceCode: string | undefined) => host.getLiveTask?.(serviceCode),
    [host]
  );

  // ── injected data layer effects ──

  // Apply calendar parallelism once, when it loads from the host.
  const parallelismInitRef = useRef(false);
  useEffect(() => {
    if (parallelismInitRef.current) return;
    if (parallelism) {
      setAndenesCount(parallelism);
      parallelismInitRef.current = true;
    }
  }, [parallelism]);

  // Mirror the host's time-window config into local grid state (skip on error).
  useEffect(() => {
    if (timeWindowsError) return;
    setTimeSlots(apiTimeSlots);
  }, [apiTimeSlots, timeWindowsError]);

  // Report the selected date so the host can fetch backend slots for it.
  const selectedDateStr = useMemo(
    () => (selectedSlot ? dayjs(selectedSlot.date).format("YYYY-MM-DD") : null),
    [selectedSlot]
  );
  useEffect(() => {
    onSelectedDateChange?.(selectedDateStr);
  }, [selectedDateStr, onSelectedDateChange]);

  // Load existing bookings whenever the calendar or query window changes.
  // Latest host callbacks are read through refs so an unrelated host identity
  // change (permissions, i18n) doesn't trigger a reload.
  const loadBookingsRef = useRef(loadBookings);
  loadBookingsRef.current = loadBookings;
  const notifyRef = useRef(host.notify);
  notifyRef.current = host.notify;
  const errorMessageRef = useRef(bookingsLoadErrorMessage);
  errorMessageRef.current = bookingsLoadErrorMessage;
  useEffect(() => {
    if (!calendarId) return;
    const controller = new AbortController();
    loadBookingsRef
      .current(controller.signal)
      .then(({ planned, ids }) => {
        if (controller.signal.aborted) return;
        setPlannedServices(planned);
        setBookingIds(ids);
        setBookingsLoadError(null);
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        if (err instanceof Error && err.name === "AbortError") return;
        setPlannedServices([]);
        setBookingIds(new Map());
        const message = errorMessageRef.current;
        setBookingsLoadError(message);
        notifyRef.current({ type: "error", message });
      });
    return () => {
      controller.abort();
    };
  }, [calendarId, bookingsKey]);

  // Re-fetch live tasks after a booking change (stage/task ids likely moved).
  useEffect(() => {
    if (bookingVersion > 0) onBookingChange?.();
  }, [bookingVersion, onBookingChange]);

  // ── derived state ──
  const timeWindows = useMemo(
    () => timeSlots.filter(isTimeWindow),
    [timeSlots]
  );
  const timeBlocks = useMemo(() => timeSlots.filter(isTimeBlock), [timeSlots]);

  // ── pure selection callbacks ──
  const selectSlot = useCallback((slot: SelectedSlot) => {
    setSelectedSlot(slot);
    setAssigningService(null);
  }, []);

  const selectService = useCallback((service: TItem) => {
    setSelectedService(service);
    setAssigningService(null);
  }, []);

  const setTimeSlotsAndSync = useCallback(
    async (slots: TimeSlot[]) => {
      setTimeSlots(slots);
      if (!calendarId) return;
      await syncTimeSlots(slots);
    },
    [calendarId, syncTimeSlots]
  );

  const setTimeWindows = useCallback((windows: TimeWindow[]) => {
    setTimeSlots((current) => [...current.filter(isTimeBlock), ...windows]);
  }, []);

  const setTimeBlocks = useCallback((blocks: TimeBlock[]) => {
    setTimeSlots((current) => [...current.filter(isTimeWindow), ...blocks]);
  }, []);

  const syncTimeSlotsToAPI = useCallback(async () => {
    await setTimeSlotsAndSync(timeSlots);
  }, [timeSlots, setTimeSlotsAndSync]);

  /**
   * Count services placed within a time window on a day (excludes the service
   * being reassigned, so its own slot doesn't count against the quota).
   */
  const getServicesInTimeWindow = useCallback(
    (timeWindow: TimeWindow, date: Date): number => {
      const d = dayjs(date);
      const timeRange = TimeWindowUtils.getTimeRange(timeWindow);
      if (!timeRange) return 0;
      const windowStart = timeRange.startHour * 60 + timeRange.startMinutes;
      const windowEnd = timeRange.endHour * 60 + timeRange.endMinutes;
      return plannedServices.filter((ps) => {
        if (
          reassigningService &&
          ps.service.id === reassigningService.service.service.id
        ) {
          return false;
        }
        if (!dayjs(ps.slot.date).isSame(d, "day")) return false;
        const slotMinutes = ps.slot.hour * 60 + ps.slot.minutes;
        return slotMinutes >= windowStart && slotMinutes < windowEnd;
      }).length;
    },
    [plannedServices, reassigningService]
  );

  const getRemainingQuota = useCallback(
    (timeWindow: TimeWindow, date: Date): number => {
      const usedQuota = getServicesInTimeWindow(timeWindow, date);
      return Math.max(0, timeWindow.quota - usedQuota);
    },
    [getServicesInTimeWindow]
  );

  const getTimeWindowForSlot = useCallback(
    (date: Date, hour: number, minutes: number): TimeWindow | null => {
      const d = dayjs(date);
      // Daily-override windows take priority over weekly windows.
      for (const window of timeWindows) {
        if (window.type !== "daily-override") continue;
        if (TimeWindowUtils.matchesSlot(window, d, hour, minutes)) return window;
      }
      for (const window of timeWindows) {
        if (window.type === "daily-override") continue;
        if (TimeWindowUtils.matchesSlot(window, d, hour, minutes)) return window;
      }
      return null;
    },
    [timeWindows]
  );

  const getBlocksForSlot = useCallback(
    (date: Date, hour: number, minutes: number): TimeBlock[] => {
      const d = dayjs(date);
      const matchingBlocks: TimeBlock[] = [];
      for (const block of timeBlocks) {
        if (
          block.type === "daily-override" &&
          TimeWindowUtils.matchesSlot(block, d, hour, minutes)
        ) {
          matchingBlocks.push(block);
        }
      }
      for (const block of timeBlocks) {
        if (
          block.type === "weekly" &&
          TimeWindowUtils.matchesSlot(block, d, hour, minutes)
        ) {
          matchingBlocks.push(block);
        }
      }
      return matchingBlocks;
    },
    [timeBlocks]
  );

  const isSlotBlocked = useCallback(
    (date: Date, hour: number, minutes: number): boolean =>
      getBlocksForSlot(date, hour, minutes).length > 0,
    [getBlocksForSlot]
  );

  const getOccupiedAndenes = useCallback(
    (date: Date, hour: number, minutes: number): number[] => {
      const d = dayjs(date);
      const occupied: number[] = [];
      for (const ps of plannedServices) {
        if (
          reassigningService &&
          ps.service.id === reassigningService.service.service.id
        ) {
          continue;
        }
        if (
          dayjs(ps.slot.date).isSame(d, "day") &&
          ps.slot.hour === hour &&
          ps.slot.minutes === minutes &&
          ps.slot.anden
        ) {
          occupied.push(ps.slot.anden);
        }
      }
      return occupied;
    },
    [plannedServices, reassigningService]
  );

  const getAvailableAndenes = useCallback(
    (date: Date, hour: number, minutes: number): number[] => {
      const occupied = getOccupiedAndenes(date, hour, minutes);
      const available: number[] = [];
      for (let i = 1; i <= andenesCount; i++) {
        if (!occupied.includes(i)) available.push(i);
      }
      return available;
    },
    [getOccupiedAndenes, andenesCount]
  );

  const getServicesForSlot = useCallback(
    (slot: SelectedSlot) =>
      plannedServices.filter((ps) => {
        if (
          reassigningService &&
          ps.service.id === reassigningService.service.service.id
        ) {
          return false;
        }
        return (
          dayjs(ps.slot.date).isSame(slot.date, "day") &&
          ps.slot.hour === slot.hour &&
          ps.slot.minutes === slot.minutes
        );
      }),
    [plannedServices, reassigningService]
  );

  const canAddToSlot = useCallback(
    (slot: SelectedSlot) =>
      getServicesForSlot(slot).length < MAX_SERVICES_PER_SLOT,
    [getServicesForSlot]
  );

  // ── async booking mutations (domain side-effects via host hooks) ──
  const confirmService = useCallback(
    async (
      finalSlot?: SelectedSlot,
      serviceOverrides?: Partial<TItem>
    ): Promise<boolean> => {
      // Persist-boundary permission guard — UI surfaces are gated upstream, so
      // reaching here without permission implies a bypass bug; throw.
      if (!canMutateBookings) {
        throw new Error("confirmService: caller lacks mutate permission");
      }
      const slotToUse = finalSlot ?? selectedSlot;
      if (!slotToUse || !selectedService) return false;

      const effectiveItem = (
        serviceOverrides
          ? { ...selectedService, ...serviceOverrides }
          : selectedService
      ) as TItem;

      const existingInSlot = getServicesForSlot(slotToUse);
      const isReplanning = existingInSlot.some(
        (ps) => ps.service.id === effectiveItem.id
      );
      if (!isReplanning && existingInSlot.length >= MAX_SERVICES_PER_SLOT) {
        return false;
      }

      const wasReassigning = reassigningService !== null;
      const originalPlannedService = reassigningService?.service ?? null;

      // Optimistic update: replace any existing entry with the new slot.
      setPlannedServices((prev) => [
        ...prev.filter((p) => p.service.id !== effectiveItem.id),
        { service: effectiveItem, slot: slotToUse },
      ]);

      if (calendarId) {
        const ci = host.toItem(effectiveItem);
        const oldBookingId = bookingIds.get(effectiveItem.id);
        const ctx: BookingPersistContext = {
          oldBookingId,
          isReassigning: wasReassigning,
        };
        try {
          let booking: BookingResponse | undefined;
          if (host.hooks?.shouldPersistBooking?.(ci, slotToUse, ctx) !== false) {
            booking = oldBookingId
              ? await bookingApi.moveBooking(
                  oldBookingId,
                  buildMoveRequest(ci, slotToUse)
                )
              : await bookingApi.createBooking(
                  buildBookingRequest(calendarId, ci, slotToUse)
                );
          }
          await host.hooks?.afterPlan?.(ci, slotToUse, { ...ctx, booking });
          if (booking) {
            const bookingId = booking.id;
            setBookingIds((prev) => {
              const next = new Map(prev);
              next.set(effectiveItem.id, bookingId);
              return next;
            });
          }
          refreshSlots();
          setBookingVersion((v) => v + 1);
        } catch (err) {
          console.warn("Failed to persist booking:", err);
          rollbackPlannedService(
            setPlannedServices,
            effectiveItem.id,
            originalPlannedService
          );
          throw err;
        }
      }

      setReassigningService(null);
      setSelectedSlot(null);
      setSelectedService(null);
      return wasReassigning;
    },
    [
      canMutateBookings,
      selectedSlot,
      selectedService,
      getServicesForSlot,
      reassigningService,
      calendarId,
      host,
      bookingIds,
      bookingApi,
      refreshSlots,
    ]
  );

  const clearService = useCallback(() => {
    setSelectedService(null);
    setReassigningService(null);
    setAssigningService(null);
  }, []);

  const closeSidebar = useCallback(() => {
    setSelectedSlot(null);
    setSelectedService(null);
    setReassigningService(null);
    setAssigningService(null);
    setSelectedChipServiceId(null);
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedSlot(null);
    setSelectedService(null);
    setReassigningService(null);
    setAssigningService(null);
    setSelectedChipServiceId(null);
  }, []);

  const removeService = useCallback(
    async (serviceId: string) => {
      if (!canMutateBookings) {
        throw new Error("removeService: caller lacks mutate permission");
      }
      const planned = plannedServices.find((p) => p.service.id === serviceId);
      // Host pre-cancel reversal: reverse the workflow task + notify the
      // binding. Throwing aborts the removal so the item stays visible.
      if (planned) {
        await host.hooks?.afterCancel?.(host.toItem(planned.service));
      }

      const bookingId = bookingIds.get(serviceId);
      if (bookingId) {
        await bookingApi
          .cancelBooking(bookingId)
          .catch((err) => console.warn("Failed to cancel booking:", err));
        setBookingIds((prev) => {
          const next = new Map(prev);
          next.delete(serviceId);
          return next;
        });
      }

      setPlannedServices((prev) =>
        prev.filter((p) => p.service.id !== serviceId)
      );
      setBookingVersion((v) => v + 1);
    },
    [canMutateBookings, plannedServices, host, bookingIds, bookingApi]
  );

  const removeAssignment = useCallback(
    async (serviceId: string) => {
      if (!canMutateBookings) {
        throw new Error("removeAssignment: caller lacks mutate permission");
      }
      const planned = plannedServices.find((p) => p.service.id === serviceId);
      if (!planned) return;

      // Host reversal/notify, returning the item with its assignment cleared.
      // Throwing aborts so the tuple stays visible and the user can retry.
      const cleared = await host.hooks?.onUnassign?.(planned.service);
      if (!cleared) {
        setBookingVersion((v) => v + 1);
        return;
      }

      const bookingId = bookingIds.get(serviceId);
      if (bookingId) {
        await bookingApi.updateBooking(bookingId, {
          resource: buildResource(host.toItem(cleared), planned.slot),
        });
      }

      setPlannedServices((prev) =>
        prev.map((p) =>
          p.service.id === serviceId ? { ...p, service: cleared } : p
        )
      );
      setBookingVersion((v) => v + 1);
    },
    [canMutateBookings, plannedServices, host, bookingIds, bookingApi]
  );

  const startReassignment = useCallback(
    (plannedService: PlannedService<TItem>) => {
      setAssigningService(null);
      setReassigningService({
        service: plannedService,
        originalSlot: { ...plannedService.slot },
      });
      setSelectedService(plannedService.service);
      // Snap to the 30-minute cell boundary so the time-range filter works.
      const snappedMinutes = Math.floor(plannedService.slot.minutes / 30) * 30;
      setSelectedSlot({ ...plannedService.slot, minutes: snappedMinutes });
    },
    []
  );

  const cancelReassignment = useCallback(() => {
    setReassigningService(null);
    setSelectedSlot(null);
    setSelectedService(null);
  }, []);

  const startAssignment = useCallback(
    (plannedService: PlannedService<TItem>) => {
      setReassigningService(null);
      setAssigningService({ service: plannedService });
      setSelectedService(plannedService.service);
      setSelectedSlot(plannedService.slot);
    },
    []
  );

  const cancelAssignment = useCallback(() => {
    setAssigningService(null);
    setSelectedSlot(null);
    setSelectedService(null);
  }, []);

  const selectChipSlot = useCallback(
    (plannedService: PlannedService<TItem>) => {
      setReassigningService(null);
      setAssigningService(null);
      setSelectedService(null);
      setSelectedChipServiceId(null);
      setSelectedSlot(plannedService.slot);
    },
    []
  );

  const selectChipResource = useCallback(
    (plannedService: PlannedService<TItem>) => {
      setSelectedChipServiceId(plannedService.service.id);
    },
    []
  );

  const inspectPlannedService = useCallback(
    (plannedService: PlannedService<TItem>) => {
      setReassigningService(null);
      setAssigningService(null);
      setSelectedChipServiceId(plannedService.service.id);
      setSelectedService(plannedService.service);
      setSelectedSlot(plannedService.slot);
    },
    []
  );

  const clearChipSelection = useCallback(() => {
    setSelectedChipServiceId(null);
  }, []);

  const isChipSelected = useCallback(
    (serviceId: string) => selectedChipServiceId === serviceId,
    [selectedChipServiceId]
  );

  const updateServiceAssignment = useCallback(
    (serviceId: string, patch: Partial<TItem>) => {
      setPlannedServices((prev) =>
        prev.map((ps) =>
          ps.service.id === serviceId
            ? { ...ps, service: { ...ps.service, ...patch } }
            : ps
        )
      );
    },
    []
  );

  const isSidebarOpen = selectedSlot !== null || selectedService !== null;

  const contextValue = useMemo<PlanningSelectionContextValue<TItem>>(
    () => ({
      calendarId,
      selectedSlot,
      selectedService,
      plannedServices,
      timeSlots,
      timeWindows,
      timeBlocks,
      andenesCount,
      reassigningService,
      assigningService,
      selectSlot,
      selectService,
      confirmService,
      clearService,
      closeSidebar,
      clearSelection,
      getServicesForSlot,
      canAddToSlot,
      setTimeSlots: setTimeSlotsAndSync,
      setTimeWindows,
      setTimeBlocks,
      setAndenesCount,
      syncTimeSlotsToAPI,
      getTimeWindowForSlot,
      getRemainingQuota,
      isSlotBlocked,
      getBlocksForSlot,
      getOccupiedAndenes,
      getAvailableAndenes,
      isSidebarOpen,
      removeService,
      removeAssignment,
      startReassignment,
      cancelReassignment,
      startAssignment,
      cancelAssignment,
      selectChipSlot,
      selectChipResource,
      inspectPlannedService,
      isChipSelected,
      clearChipSelection,
      updateServiceAssignment,
      bookingsLoadError,
      backendSlots,
      isSlotsLoading,
      refreshSlots,
      bookingVersion,
      getLiveTask,
    }),
    [
      calendarId,
      selectedSlot,
      selectedService,
      plannedServices,
      timeSlots,
      timeWindows,
      timeBlocks,
      andenesCount,
      reassigningService,
      assigningService,
      selectSlot,
      selectService,
      confirmService,
      clearService,
      closeSidebar,
      clearSelection,
      getServicesForSlot,
      canAddToSlot,
      setTimeSlotsAndSync,
      setTimeWindows,
      setTimeBlocks,
      syncTimeSlotsToAPI,
      getTimeWindowForSlot,
      getRemainingQuota,
      isSlotBlocked,
      getBlocksForSlot,
      getOccupiedAndenes,
      getAvailableAndenes,
      isSidebarOpen,
      removeService,
      removeAssignment,
      startReassignment,
      cancelReassignment,
      startAssignment,
      cancelAssignment,
      selectChipSlot,
      selectChipResource,
      inspectPlannedService,
      isChipSelected,
      clearChipSelection,
      updateServiceAssignment,
      bookingsLoadError,
      backendSlots,
      isSlotsLoading,
      refreshSlots,
      bookingVersion,
      getLiveTask,
    ]
  );

  return (
    <PlanningSelectionContext.Provider
      value={
        contextValue as unknown as PlanningSelectionContextValue<{
          id: string;
        }>
      }
    >
      {children}
    </PlanningSelectionContext.Provider>
  );
}

/**
 * Read the planning selection context. Generic over the host's item type
 * (defaults to {@link CalendarItem}); a back-compat host re-export binds its own
 * domain type. Throws outside a {@link PlanningSelectionProvider}.
 */
export function usePlanningSelection<
  TItem extends { id: string } = CalendarItem,
>(): PlanningSelectionContextValue<TItem> {
  const ctx = useContext(PlanningSelectionContext);
  if (!ctx) {
    throw new Error(
      "usePlanningSelection must be used within a PlanningSelectionProvider"
    );
  }
  return ctx as unknown as PlanningSelectionContextValue<TItem>;
}
