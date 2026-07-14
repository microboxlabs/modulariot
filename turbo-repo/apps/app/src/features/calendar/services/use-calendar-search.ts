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

  // Anchored on the viewed date, mirroring the grid's own booking range.
  const range = useMemo(() => {
    const anchor = parseUrlDate(searchParams.get("date")) ?? dayjs();
    return {
      startDate: anchor
        .subtract(SEARCH_WINDOW_DAYS, "day")
        .format("YYYY-MM-DD"),
      endDate: anchor.add(SEARCH_WINDOW_DAYS, "day").format("YYYY-MM-DD"),
    };
  }, [searchParams]);

  const { data, error, isLoading } = useSWR(
    // Query terms are intentionally absent from the key — see above.
    active ? ["calendar-search", range.startDate, range.endDate] : null,
    ([, startDate, endDate]) => listBookings({ startDate, endDate }),
    { revalidateOnFocus: false, keepPreviousData: true }
  );

  const matches = useMemo(() => {
    if (!active || !data) return [];
    return data.data
      .map(mapBookingToPlannedService)
      .filter((m): m is MappedBooking => m !== null)
      .filter((m) => matchesCalendarSearch(m.planned.service, params))
      .sort(
        (a, b) => slotTime(a).valueOf() - slotTime(b).valueOf()
      );
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
