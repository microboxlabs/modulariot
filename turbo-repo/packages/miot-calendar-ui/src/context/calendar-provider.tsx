"use client";

import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { ViewMode } from "../services/calendar.service.types";
import type { SelectedSlot } from "../types/calendar-slot";
import type { CalendarItem } from "../types/calendar-item";
import type { CalendarHost } from "../contract/calendar-host";

/**
 * Generic, domain-agnostic calendar UI state. Holds ONLY the view-model concerns
 * the package owns (current view/date, the selected slot/item, sidebar
 * visibility). Data fetching, booking persistence, and all domain logic are
 * layered on in later phases via the injected CalendarHost — not here. URL
 * sync (e.g. ?view=) stays host-side so the package never depends on Next's
 * router/navigation APIs and remains framework-agnostic.
 */
export interface CalendarState {
  view: ViewMode;
  setView: (v: ViewMode) => void;
  currentDate: Date;
  setCurrentDate: (d: Date) => void;
  selectedSlot: SelectedSlot | null;
  setSelectedSlot: (s: SelectedSlot | null) => void;
  selectedItem: CalendarItem | null;
  setSelectedItem: (i: CalendarItem | null) => void;
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
}

const CalendarStateContext = createContext<CalendarState | null>(null);
const CalendarHostContext = createContext<CalendarHost | null>(null);

export interface CalendarProviderProps<TRaw = unknown> {
  host: CalendarHost<TRaw>;
  initialView?: ViewMode;
  initialDate?: Date;
  children: ReactNode;
}

export function CalendarProvider<TRaw = unknown>({
  host,
  initialView = "week",
  initialDate,
  children,
}: CalendarProviderProps<TRaw>) {
  const [view, setView] = useState<ViewMode>(initialView);
  const [currentDate, setCurrentDate] = useState<Date>(
    () => initialDate ?? new Date()
  );
  const [selectedSlot, setSelectedSlot] = useState<SelectedSlot | null>(null);
  const [selectedItem, setSelectedItem] = useState<CalendarItem | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const state = useMemo<CalendarState>(
    () => ({
      view,
      setView,
      currentDate,
      setCurrentDate,
      selectedSlot,
      setSelectedSlot,
      selectedItem,
      setSelectedItem,
      sidebarOpen,
      setSidebarOpen,
    }),
    [view, currentDate, selectedSlot, selectedItem, sidebarOpen]
  );

  return (
    <CalendarHostContext.Provider value={host as CalendarHost}>
      <CalendarStateContext.Provider value={state}>
        {children}
      </CalendarStateContext.Provider>
    </CalendarHostContext.Provider>
  );
}

/** Read the generic calendar UI state. Throws outside a CalendarProvider. */
export function useCalendar(): CalendarState {
  const ctx = useContext(CalendarStateContext);
  if (!ctx) {
    throw new Error("useCalendar must be used within a CalendarProvider");
  }
  return ctx;
}

/** Read the injected host contract. Throws outside a CalendarProvider. */
export function useCalendarHost(): CalendarHost {
  const ctx = useContext(CalendarHostContext);
  if (!ctx) {
    throw new Error("useCalendarHost must be used within a CalendarProvider");
  }
  return ctx;
}

/**
 * Read the injected host contract if present, else null — never throws. For
 * generic, reusable pieces (e.g. the search box) that a host may mount OUTSIDE
 * a CalendarProvider while feeding what they need (i18n) directly via props.
 */
export function useCalendarHostOptional(): CalendarHost | null {
  return useContext(CalendarHostContext);
}
