"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  type ReactNode,
} from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import dayjs from "dayjs";
import { usePlanningSelection } from "./planning-selection-context";
import { useCalendars } from "@/features/common/providers/client-api.provider";
import {
  useCalendarSearch,
  type CalendarSearchResult,
} from "@/features/calendar/services/use-calendar-search";
import type { MappedBooking } from "@/features/calendar/services/booking-service-mapper";

/** URL param carrying the match the navigator is parked on. */
export const FOCUS_PARAM = "focus";

export interface CalendarSearchContextValue extends CalendarSearchResult {
  /** Index of the focused match within `matches`, or -1 when none is. */
  currentIndex: number;
  /** The focused match — may live in a different calendar than the one on screen. */
  currentMatch: MappedBooking | null;
  goToMatch: (match: MappedBooking) => void;
  goNext: () => void;
  goPrevious: () => void;
  clearSearch: () => void;
}

const CalendarSearchContext = createContext<CalendarSearchContextValue | null>(
  null
);

/** Search params the calendar filter bar owns — cleared together. */
const SEARCH_PARAM_KEYS = [
  "service",
  "customer",
  "origin",
  "destination",
  "licensePlate",
  "tipoViaje",
  "assignment",
];

/**
 * Runs the cross-calendar search once and shares it with everything below — the
 * grid (which highlights) and the header's navigator (which steps through hits).
 *
 * Mounted inside PlanningSelectionProvider: it pushes the matches for *this*
 * calendar into that context's highlight channel, and the focused match into its
 * focus channel.
 *
 * Stepping to a match travels in the URL, never in memory. Crossing to another
 * calendar changes the `[calendarId]` route segment, which remounts both
 * providers and wipes their state — so `?focus=<bookingId>` is the only thing
 * that survives the trip, and the highlight is re-applied on the far side once
 * the new calendar's bookings load.
 */
export function CalendarSearchProvider({
  children,
}: {
  readonly children: ReactNode;
}) {
  const search = useCalendarSearch();
  const { calendarId, setSearchMatchIds, setFocusedItemId } =
    usePlanningSelection();
  const { calendars } = useCalendars();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const focusBookingId = searchParams.get(FOCUS_PARAM);

  // Results are ordered by planned time, so "next" is meaningful even when
  // consecutive matches sit in different calendars.
  const currentIndex = useMemo(() => {
    if (!focusBookingId) return -1;
    return search.matches.findIndex((m) => m.bookingId === focusBookingId);
  }, [focusBookingId, search.matches]);

  const currentMatch = search.matches[currentIndex] ?? null;

  // ── highlight: which chips on THIS calendar matched ──────────────────────
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
  }, [
    search.active,
    search.isLoading,
    search.error,
    search.matches,
    calendarId,
  ]);

  useEffect(() => {
    setSearchMatchIds(matchIdsInThisCalendar);
  }, [matchIdsInThisCalendar, setSearchMatchIds]);

  // ── focus: the one match the navigator is parked on ──────────────────────
  const focusedServiceId = useMemo(() => {
    if (!currentMatch || currentMatch.calendarId !== calendarId) return null;
    return currentMatch.planned.service.id;
  }, [currentMatch, calendarId]);

  useEffect(() => {
    setFocusedItemId(focusedServiceId);
  }, [focusedServiceId, setFocusedItemId]);

  useEffect(
    // Leaving the calendar must not strand a highlight behind.
    () => () => {
      setSearchMatchIds(null);
      setFocusedItemId(null);
    },
    [setSearchMatchIds, setFocusedItemId]
  );

  // ── navigation ───────────────────────────────────────────────────────────
  const goToMatch = useCallback(
    (match: MappedBooking) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("date", dayjs(match.planned.slot.date).format("YYYY-MM-DD"));
      params.set(FOCUS_PARAM, match.bookingId);

      // Month cells cap at 3 chips + "+N more", so a match can be highlighted
      // and still invisible. Drop to the day view, where it is always drawn.
      if (params.get("view") === "month") params.set("view", "day");

      let path = pathname;
      if (calendarId && match.calendarId !== calendarId) {
        path = pathname
          .split("/")
          .map((seg) => (seg === calendarId ? match.calendarId : seg))
          .join("/");

        // The title's picker lists the calendars of `?groupCode=`. Carry the
        // target's group across, or it would render a picker that does not
        // contain the calendar you just landed on.
        const targetGroup = calendars.find((c) => c.id === match.calendarId)
          ?.groups?.[0]?.code;
        if (targetGroup) params.set("groupCode", targetGroup);
        else params.delete("groupCode");
      }

      router.push(`${path}?${params.toString()}`);
    },
    [router, pathname, searchParams, calendarId, calendars]
  );

  const step = useCallback(
    (delta: number) => {
      const { matches } = search;
      if (matches.length === 0) return;
      // Wrap around: with a handful of hits, cycling beats dead-ending.
      const from = currentIndex === -1 ? -1 : currentIndex;
      const next = (from + delta + matches.length) % matches.length;
      const target = matches[next];
      if (target) goToMatch(target);
    },
    [search, currentIndex, goToMatch]
  );

  const goNext = useCallback(() => step(1), [step]);
  const goPrevious = useCallback(() => step(-1), [step]);

  const clearSearch = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString());
    for (const key of SEARCH_PARAM_KEYS) params.delete(key);
    params.delete(FOCUS_PARAM);
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }, [router, pathname, searchParams]);

  // ── auto-jump to the first match ─────────────────────────────────────────
  // Highlighting alone is not enough: the grid shows one day or week, but the
  // search spans a 60-day window across every calendar, so a match is usually
  // off-screen. Land on it.
  const autoJumpedTo = useRef<string | null>(null);
  useEffect(() => {
    if (!search.active || search.isLoading || search.error) return;
    const first = search.matches[0];
    if (!first) return;
    // Already parked on a real match — the user is steering, leave them alone.
    if (currentIndex !== -1) return;
    // Guard against re-pushing the same jump while the router settles.
    if (autoJumpedTo.current === first.bookingId) return;
    autoJumpedTo.current = first.bookingId;
    goToMatch(first);
  }, [
    search.active,
    search.isLoading,
    search.error,
    search.matches,
    currentIndex,
    goToMatch,
  ]);

  useEffect(() => {
    // A new search gets a fresh auto-jump.
    if (!search.active) autoJumpedTo.current = null;
  }, [search.active]);

  const value = useMemo<CalendarSearchContextValue>(
    () => ({
      ...search,
      currentIndex,
      currentMatch,
      goToMatch,
      goNext,
      goPrevious,
      clearSearch,
    }),
    [
      search,
      currentIndex,
      currentMatch,
      goToMatch,
      goNext,
      goPrevious,
      clearSearch,
    ]
  );

  return (
    <CalendarSearchContext.Provider value={value}>
      {children}
    </CalendarSearchContext.Provider>
  );
}

export function useCalendarSearchContext(): CalendarSearchContextValue {
  const ctx = useContext(CalendarSearchContext);
  if (!ctx) {
    throw new Error(
      "useCalendarSearchContext must be used within a CalendarSearchProvider"
    );
  }
  return ctx;
}
