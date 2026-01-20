"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  type ReactNode,
} from "react";
import dayjs from "dayjs";
import isoWeek from "dayjs/plugin/isoWeek";

dayjs.extend(isoWeek);

/**
 * Represents a selected time slot in the calendar
 */
export interface SelectedSlot {
  date: Date;
  hour: number;
  minutes: number;
  dayIndex?: number; // For week view
}

/**
 * Time window configuration for quota management
 * Format: W1-4 1-5 0900-1700
 */
export interface TimeWindow {
  id: string;
  name: string;
  startHour: number;
  startMinutes: number;
  endHour: number;
  endMinutes: number;
  days: number[]; // 1 = Monday, ..., 7 = Sunday
  weeks: number[]; // 1-5 for weeks of month, empty = all weeks
  quota: number;
}

/**
 * Lead time status for a service
 */
export type LeadTimeStatus = "on_time" | "warning" | "delayed";

/**
 * Trip type options
 */
export type TripType = "Sider" | "Doble Sider" | "Rampla";

/**
 * Represents a service that can be selected in the planning calendar
 * Based on the Service mock data contract
 */
export interface SelectedService {
  id: string;
  cliente: string;
  origen: string;
  lugarCarguio: string;
  destino: string;
  tipoViaje: TripType;
  ocupacion: number; // percentage 0-100
  permanencia: string;
  leadTime: {
    deadline: string; // ISO date
    status: LeadTimeStatus;
  };
  eta: string; // ISO datetime
  incidencias: string[]; // e.g. ['urgencia', 'shutdown', 'c5']
  observaciones: string;
  prioridad: number;
}

/**
 * A service that has been confirmed and placed in a slot
 */
export interface PlannedService {
  service: SelectedService;
  slot: SelectedSlot;
}

interface PlanningSelectionContextType {
  selectedSlot: SelectedSlot | null;
  selectedService: SelectedService | null;
  plannedServices: PlannedService[];
  timeWindows: TimeWindow[];
  selectSlot: (slot: SelectedSlot) => void;
  selectService: (service: SelectedService) => void;
  confirmService: () => void;
  clearService: () => void;
  closeSidebar: () => void;
  clearSelection: () => void;
  getServicesForSlot: (slot: SelectedSlot) => PlannedService[];
  canAddToSlot: (slot: SelectedSlot) => boolean;
  setTimeWindows: (windows: TimeWindow[]) => void;
  getTimeWindowForSlot: (
    date: Date,
    hour: number,
    minutes: number
  ) => TimeWindow | null;
  getRemainingQuota: (
    timeWindow: TimeWindow,
    date: Date
  ) => number;
  isSidebarOpen: boolean;
}

const MAX_SERVICES_PER_SLOT = 3;

const PlanningSelectionContext =
  createContext<PlanningSelectionContextType | null>(null);

interface PlanningSelectionProviderProps {
  readonly children: ReactNode;
}

/**
 * Gets the week number of the month (1-5) for a given date
 */
function getWeekOfMonth(date: dayjs.Dayjs): number {
  const firstDayOfMonth = date.startOf("month");
  const firstMonday =
    firstDayOfMonth.isoWeekday() <= 1
      ? firstDayOfMonth
      : firstDayOfMonth.add(8 - firstDayOfMonth.isoWeekday(), "day");

  if (date.isBefore(firstMonday)) {
    return 1;
  }

  const weekNumber = Math.ceil(
    (date.date() + firstDayOfMonth.isoWeekday() - 1) / 7
  );
  return Math.min(weekNumber, 5);
}

export function PlanningSelectionProvider({
  children,
}: PlanningSelectionProviderProps) {
  const [selectedSlot, setSelectedSlot] = useState<SelectedSlot | null>(null);
  const [selectedService, setSelectedService] =
    useState<SelectedService | null>(null);
  const [plannedServices, setPlannedServices] = useState<PlannedService[]>([]);
  const [timeWindows, setTimeWindowsState] = useState<TimeWindow[]>([]);

  const selectSlot = useCallback((slot: SelectedSlot) => {
    setSelectedSlot(slot);
  }, []);

  const selectService = useCallback((service: SelectedService) => {
    setSelectedService(service);
  }, []);

  const setTimeWindows = useCallback((windows: TimeWindow[]) => {
    setTimeWindowsState(windows);
  }, []);

  /**
   * Count services assigned within a time window for a specific day
   */
  const getServicesInTimeWindow = useCallback(
    (timeWindow: TimeWindow, date: Date): number => {
      const d = dayjs(date);
      const windowStart = timeWindow.startHour * 60 + timeWindow.startMinutes;
      const windowEnd = timeWindow.endHour * 60 + timeWindow.endMinutes;

      return plannedServices.filter((ps) => {
        // Check same day
        if (!dayjs(ps.slot.date).isSame(d, "day")) return false;
        
        // Check if service slot is within window time range
        const slotMinutes = ps.slot.hour * 60 + ps.slot.minutes;
        return slotMinutes >= windowStart && slotMinutes < windowEnd;
      }).length;
    },
    [plannedServices]
  );

  /**
   * Get remaining quota for a time window on a specific day
   */
  const getRemainingQuota = useCallback(
    (timeWindow: TimeWindow, date: Date): number => {
      const usedQuota = getServicesInTimeWindow(timeWindow, date);
      return Math.max(0, timeWindow.quota - usedQuota);
    },
    [getServicesInTimeWindow]
  );

  /**
   * Check if a slot falls within any time window
   */
  const getTimeWindowForSlot = useCallback(
    (date: Date, hour: number, minutes: number): TimeWindow | null => {
      const d = dayjs(date);
      // Convert JS day (0=Sunday) to format day (1=Monday, 7=Sunday)
      const jsDay = d.day();
      const formatDay = jsDay === 0 ? 7 : jsDay;
      const weekOfMonth = getWeekOfMonth(d);
      const slotMinutes = hour * 60 + minutes;

      for (const window of timeWindows) {
        // Check if day matches
        if (!window.days.includes(formatDay)) continue;

        // Check if week matches (empty = all weeks)
        if (window.weeks.length > 0 && !window.weeks.includes(weekOfMonth))
          continue;

        // Check if time is within range
        const windowStart = window.startHour * 60 + window.startMinutes;
        const windowEnd = window.endHour * 60 + window.endMinutes;

        if (slotMinutes >= windowStart && slotMinutes < windowEnd) {
          return window;
        }
      }

      return null;
    },
    [timeWindows]
  );

  const getServicesForSlot = useCallback(
    (slot: SelectedSlot) => {
      return plannedServices.filter(
        (ps) =>
          dayjs(ps.slot.date).isSame(slot.date, "day") &&
          ps.slot.hour === slot.hour &&
          ps.slot.minutes === slot.minutes
      );
    },
    [plannedServices]
  );

  const canAddToSlot = useCallback(
    (slot: SelectedSlot) => {
      const servicesInSlot = getServicesForSlot(slot);
      return servicesInSlot.length < MAX_SERVICES_PER_SLOT;
    },
    [getServicesForSlot]
  );

  const confirmService = useCallback(() => {
    if (selectedSlot && selectedService) {
      // Check if slot has room (unless re-planning same service)
      const existingInSlot = getServicesForSlot(selectedSlot);
      const isReplanning = existingInSlot.some(
        (ps) => ps.service.id === selectedService.id
      );

      if (!isReplanning && existingInSlot.length >= MAX_SERVICES_PER_SLOT) {
        // Slot is full, cannot add more
        return;
      }

      setPlannedServices((prev) => {
        // Remove if already planned (allow re-planning)
        const filtered = prev.filter(
          (p) => p.service.id !== selectedService.id
        );
        return [...filtered, { service: selectedService, slot: selectedSlot }];
      });
      // Clear selection after confirming
      setSelectedSlot(null);
      setSelectedService(null);
    }
  }, [selectedSlot, selectedService, getServicesForSlot]);

  const clearService = useCallback(() => {
    setSelectedService(null);
  }, []);

  const closeSidebar = useCallback(() => {
    setSelectedSlot(null);
    setSelectedService(null);
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedSlot(null);
    setSelectedService(null);
  }, []);

  // Sidebar is open when either a slot or service is selected
  const isSidebarOpen = selectedSlot !== null || selectedService !== null;

  const contextValue = useMemo(
    () => ({
      selectedSlot,
      selectedService,
      plannedServices,
      timeWindows,
      selectSlot,
      selectService,
      confirmService,
      clearService,
      closeSidebar,
      clearSelection,
      getServicesForSlot,
      canAddToSlot,
      setTimeWindows,
      getTimeWindowForSlot,
      getRemainingQuota,
      isSidebarOpen,
    }),
    [
      selectedSlot,
      selectedService,
      plannedServices,
      timeWindows,
      selectSlot,
      selectService,
      confirmService,
      clearService,
      closeSidebar,
      clearSelection,
      getServicesForSlot,
      canAddToSlot,
      setTimeWindows,
      getTimeWindowForSlot,
      getRemainingQuota,
      isSidebarOpen,
    ]
  );

  return (
    <PlanningSelectionContext.Provider value={contextValue}>
      {children}
    </PlanningSelectionContext.Provider>
  );
}

export function usePlanningSelection() {
  const context = useContext(PlanningSelectionContext);
  if (!context) {
    throw new Error(
      "usePlanningSelection must be used within a PlanningSelectionProvider"
    );
  }
  return context;
}
