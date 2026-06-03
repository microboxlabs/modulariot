"use client";

import { useEffect, useRef } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import dayjs from "dayjs";
import {
  useCalendar,
  isValidViewMode,
  parseUrlDate,
  DATE_FORMAT,
  type ViewMode,
} from "@microboxlabs/miot-calendar-ui";

/**
 * App-side bridge keeping the package calendar state (`useCalendar()`) and the
 * URL (`?view=&date=`) in sync. The package never imports next/navigation; URL
 * ownership stays here.
 *
 * Two guarded effects mirror state ↔ URL:
 *  - URL → state: the header's nav writes the URL (and browser back/forward
 *    changes it); this pushes those into `setView`/`setCurrentDate`.
 *  - state → URL: in-grid navigation (e.g. month-view day click) updates state
 *    only; this writes it back to the URL via `router.replace`.
 *
 * Both compare before writing, so the two effects converge instead of looping.
 * Initial seeding is done by `CalendarProvider`'s `initialView`/`initialDate`
 * (read from the URL at mount), so state == URL on first render and neither
 * effect fires.
 */
export function useCalendarUrlSync(defaultView: ViewMode = "week"): void {
  const { view, currentDate, setView, setCurrentDate } = useCalendar();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const urlViewRaw = searchParams.get("view");
  const urlView: ViewMode = isValidViewMode(urlViewRaw)
    ? urlViewRaw
    : defaultView;
  const urlDateRaw = searchParams.get("date");

  // URL → state (header nav, browser back/forward).
  useEffect(() => {
    if (urlView !== view) setView(urlView);
    const urlDate = parseUrlDate(urlDateRaw);
    if (urlDate && !urlDate.isSame(currentDate, "day")) {
      setCurrentDate(urlDate.toDate());
    }
    // Intentionally keyed on the URL-derived values only; the state setters are
    // stable and re-running on every state change would fight the other effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlView, urlDateRaw]);

  // state → URL (in-grid navigation that bypasses the header). Skip the first
  // render: the provider was already seeded from the URL, so there's nothing to
  // write — writing here would only canonicalize params and churn history.
  const isFirstRun = useRef(true);
  useEffect(() => {
    if (isFirstRun.current) {
      isFirstRun.current = false;
      return;
    }
    const dateStr = dayjs(currentDate).format(DATE_FORMAT);
    const params = new URLSearchParams(searchParams.toString());
    if (params.get("view") !== view || params.get("date") !== dateStr) {
      params.set("view", view);
      params.set("date", dateStr);
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    }
    // Keyed on the calendar state only; reading searchParams/pathname fresh each
    // run is fine and keeping them out of deps avoids redundant writes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, currentDate]);
}

/**
 * Renderless bridge component — mount it inside `CalendarProvider` to wire the
 * URL ↔ calendar-state sync.
 */
export function CalendarUrlSync({
  defaultView = "week",
}: Readonly<{ defaultView?: ViewMode }>): null {
  useCalendarUrlSync(defaultView);
  return null;
}
