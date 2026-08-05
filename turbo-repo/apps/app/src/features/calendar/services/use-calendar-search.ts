"use client";

import { useMemo } from "react";
import { useSearchParams } from "next/navigation";
import useSWR from "swr";
import dayjs from "dayjs";
import { listBookings } from "@/features/common/providers/client-api.provider";
import { mapBookingToPlannedService } from "@/features/calendar/services/booking-service-mapper";
import {
  SEARCH_WINDOW_DAYS,
  bookingQueriesForCalendarSearch,
  isCalendarSearchActive,
  matchesCalendarSearch,
  orderMatchesByCalendar,
  parseCalendarSearchParams,
  type CalendarBookingSearchQuery,
  type CalendarSearchParams,
} from "@/features/calendar/services/calendar-search";
import type { MappedBooking } from "@/features/calendar/services/booking-service-mapper";
import type {
  BookingListResponse,
  BookingResponse,
} from "@microboxlabs/miot-calendar-client";

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
 * Fetches with **no `calendarId`**, so matches span every calendar.
 *
 * Service terms are translated to miot-calendar's generic
 * `resourceIdContains` filter. Those requests intentionally omit dates, so an
 * old planned service remains findable without teaching the calendar backend
 * what a service code means.
 *
 * Other filters still narrow a ±30-day client-side set because they live in the
 * generic resource payload. The key is `null` while no search is active, so a
 * planner who never searches never pays for either request.
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
  const bookingQueries = useMemo(
    () => bookingQueriesForCalendarSearch(params, range),
    [params, range]
  );

  const { data, error, isLoading } = useSWR(
    active ? ["calendar-search", bookingQueries] : null,
    ([, queries]) => listSearchBookings(queries),
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

async function listSearchBookings(
  queries: readonly CalendarBookingSearchQuery[]
): Promise<BookingListResponse> {
  const responses = await Promise.all(
    queries.map((query) => listBookings({ ...query }))
  );

  const bookings = new Map<string, BookingResponse>();
  for (const response of responses) {
    for (const booking of response.data) bookings.set(booking.id, booking);
  }
  return { data: [...bookings.values()], total: bookings.size };
}

function slotTime(m: MappedBooking): dayjs.Dayjs {
  return dayjs(m.planned.slot.date)
    .hour(m.planned.slot.hour)
    .minute(m.planned.slot.minutes);
}
