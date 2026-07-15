"use client";

import { useMemo } from "react";
import { useSearchParams } from "next/navigation";
import useSWR from "swr";
import dayjs from "dayjs";
import { listBookings } from "@/features/common/providers/client-api.provider";
import { parseUrlDate } from "@/features/calendar/services/calendar.service";
import { mapBookingToPlannedService } from "@/features/calendar/services/booking-service-mapper";
import {
  SEARCH_WINDOW_DAYS,
  isCalendarSearchActive,
  matchesCalendarSearch,
  orderMatchesByCalendar,
  parseCalendarSearchParams,
  type CalendarSearchParams,
} from "@/features/calendar/services/calendar-search";
import type { MappedBooking } from "@/features/calendar/services/booking-service-mapper";

export interface CalendarSearchResult {
  /** A search is running (at least one filter badge has a value). */
  active: boolean;
  params: CalendarSearchParams;
  /**
   * Every match, across every calendar, ordered by when it is planned. Ordering
   * is what makes "next match" mean something when matches span calendars.
   */
  matches: MappedBooking[];
  isLoading: boolean;
  error?: Error;
}

/**
 * Cross-calendar search over planned bookings.
 *
 * Fetches with **no `calendarId`**, which the bookings API already reads as
 * "every calendar" (BookingService.getBookings -> Booking.findByDateRange), so
 * a service planned in a calendar you are not looking at is still found. No
 * backend change was needed for this.
 *
 * Two deliberate cost choices:
 *
 * 1. The SWR key holds only the date window, *not* the query. So typing into a
 *    badge re-filters an already-fetched set instead of refetching — one fat
 *    request per window, then instant local narrowing.
 * 2. The key is `null` while no search is active, so a planner who never
 *    searches never pays for the fetch at all.
 *
 * The result set is unpaginated and each booking carries the whole service blob,
 * so this leans on the org having few calendars (it does — `parallelism` exists
 * precisely so that docks don't become calendars). If that stops holding, the
 * fix is a server-side query, and this hook is the seam to swap.
 */
export function useCalendarSearch(): CalendarSearchResult {
  const searchParams = useSearchParams();

  const params = useMemo(
    () => parseCalendarSearchParams(searchParams),
    [searchParams]
  );
  const active = isCalendarSearchActive(params);

  // Anchored on TODAY, not on the viewed date — deliberately, and load-bearing.
  //
  // The grid anchors its range on `?date=` because it must load what you are
  // looking at. If the search did the same, stepping to a match would rewrite
  // `?date=`, which would move the window, which would refetch a different set
  // of bookings, which could change the matches and bounce the navigator to a
  // different one — a feedback loop with itself. Anchoring on today makes the
  // window stand still while you travel through it: one fetch per search, and
  // stepping through matches never refetches.
  const range = useMemo(() => {
    const today = dayjs().startOf("day");
    return {
      startDate: today.subtract(SEARCH_WINDOW_DAYS, "day").format("YYYY-MM-DD"),
      endDate: today.add(SEARCH_WINDOW_DAYS, "day").format("YYYY-MM-DD"),
    };
  }, []);

  const { data, error, isLoading } = useSWR(
    // Query terms are intentionally absent from the key — see above.
    active ? ["calendar-search", range.startDate, range.endDate] : null,
    ([, startDate, endDate]) => listBookings({ startDate, endDate }),
    { revalidateOnFocus: false, keepPreviousData: true }
  );

  const matches = useMemo(() => {
    if (!active || !data) return [];
    const mapped = data.data
      .map(mapBookingToPlannedService)
      .filter((m): m is MappedBooking => m !== null)
      .filter((m) => matchesCalendarSearch(m.planned.service, params));
    // Grouped by calendar so stepping stays put instead of remounting the grid
    // on every hop — see orderMatchesByCalendar.
    return orderMatchesByCalendar(mapped, (m) => slotTime(m).valueOf());
  }, [active, data, params]);

  return {
    active,
    params,
    matches,
    isLoading: active && isLoading,
    error: error as Error | undefined,
  };
}

function slotTime(m: MappedBooking): dayjs.Dayjs {
  return dayjs(m.planned.slot.date)
    .hour(m.planned.slot.hour)
    .minute(m.planned.slot.minutes);
}
