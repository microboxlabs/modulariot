"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  type ReactNode,
} from "react";
import { usePlanningSelection } from "./planning-selection-context";
import {
  useCalendarSearch,
  type CalendarSearchResult,
} from "@/features/calendar/services/use-calendar-search";

const CalendarSearchContext = createContext<CalendarSearchResult | null>(null);

/**
 * Runs the cross-calendar search once and shares it with everything below —
 * the grid (which highlights) and the header's match navigator (which steps
 * through hits). Mounted inside PlanningSelectionProvider because it pushes the
 * matches for *this* calendar into that context's highlight channel.
 */
export function CalendarSearchProvider({
  children,
}: {
  readonly children: ReactNode;
}) {
  const search = useCalendarSearch();
  const { calendarId, setSearchMatchIds } = usePlanningSelection();

  const matchIdsInThisCalendar = useMemo(() => {
    // null = "do not dim anything". We must return it until there is a real
    // answer, otherwise the in-flight fetch (matches still []) would read as
    // "a search that matched nothing" and flash every chip dimmed. Same for a
    // failed fetch: it is an error, not an empty result.
    if (!search.active || search.isLoading || search.error) return null;

    return new Set(
      search.matches
        .filter((m) => m.calendarId === calendarId)
        .map((m) => m.planned.service.id)
    );
  }, [search.active, search.isLoading, search.error, search.matches, calendarId]);

  useEffect(() => {
    setSearchMatchIds(matchIdsInThisCalendar);
  }, [matchIdsInThisCalendar, setSearchMatchIds]);

  useEffect(
    // Leaving the calendar must not strand a highlight behind.
    () => () => setSearchMatchIds(null),
    [setSearchMatchIds]
  );

  return (
    <CalendarSearchContext.Provider value={search}>
      {children}
    </CalendarSearchContext.Provider>
  );
}

export function useCalendarSearchContext(): CalendarSearchResult {
  const ctx = useContext(CalendarSearchContext);
  if (!ctx) {
    throw new Error(
      "useCalendarSearchContext must be used within a CalendarSearchProvider"
    );
  }
  return ctx;
}
