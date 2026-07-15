"use client";

import dayjs from "dayjs";
import { IoChevronBack, IoChevronForward, IoClose } from "react-icons/io5";
import { useCalendars } from "@/features/common/providers/client-api.provider";
import { usePlanningSelection } from "./planning-selection-context";
import { useCalendarSearchContext } from "./calendar-search-context";
import { tr } from "@/features/i18n/tr.service";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";

/**
 * "3 of 12 ‹ ›" for the active calendar search.
 *
 * The counter is the honest part of the feature: a match is often planned in a
 * week — or a calendar — you are not looking at, so the highlight alone would be
 * invisible. Stepping moves the calendar to the match. When the next match lives
 * in another calendar, that is named, because the step will navigate away.
 */
export function CalendarSearchNavigator({
  dict,
}: {
  readonly dict: I18nRecord;
}) {
  const {
    active,
    isLoading,
    error,
    matches,
    currentIndex,
    currentMatch,
    goNext,
    goPrevious,
    clearSearch,
  } = useCalendarSearchContext();
  const { calendarId } = usePlanningSelection();
  const { calendars } = useCalendars();

  if (!active) return null;

  const searchDict = dict as I18nRecord;

  if (isLoading) {
    return (
      <Shell>
        <span className="text-gray-500 dark:text-gray-400">
          {tr("pages.planning.search.searching", searchDict)}
        </span>
      </Shell>
    );
  }

  if (error || matches.length === 0) {
    return (
      <Shell>
        <span className="text-gray-500 dark:text-gray-400">
          {tr("pages.planning.search.noResults", searchDict)}
        </span>
        <ClearButton dict={searchDict} onClear={clearSearch} />
      </Shell>
    );
  }

  const elsewhere =
    currentMatch && currentMatch.calendarId !== calendarId
      ? (calendars.find((c) => c.id === currentMatch.calendarId)?.name ?? null)
      : null;

  return (
    <Shell>
      <span className="font-medium text-primary-700 dark:text-primary-300 tabular-nums">
        {tr("pages.planning.search.counter", searchDict, {
          // -1 (nothing focused yet) still reads as "1 of N" rather than "0 of N".
          current: String(currentIndex === -1 ? 1 : currentIndex + 1),
          total: String(matches.length),
        })}
      </span>

      {currentMatch && (
        <span className="text-gray-500 dark:text-gray-400 truncate max-w-56">
          {currentMatch.planned.service.id} ·{" "}
          {dayjs(currentMatch.planned.slot.date).format("DD MMM")}
          {elsewhere ? (
            <span className="ml-1 text-amber-600 dark:text-amber-400">
              ·{" "}
              {tr("pages.planning.search.otherCalendar", searchDict, {
                calendar: elsewhere,
              })}
            </span>
          ) : null}
        </span>
      )}

      <div className="flex items-center">
        <NavButton
          onClick={goPrevious}
          label={tr("pages.planning.search.previous", searchDict)}
        >
          <IoChevronBack className="w-4 h-4" />
        </NavButton>
        <NavButton
          onClick={goNext}
          label={tr("pages.planning.search.next", searchDict)}
        >
          <IoChevronForward className="w-4 h-4" />
        </NavButton>
      </div>

      <ClearButton dict={searchDict} onClear={clearSearch} />
    </Shell>
  );
}

function Shell({ children }: { readonly children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 rounded-md border border-primary-300 bg-primary-50 px-2 py-1 text-xs dark:border-primary-700 dark:bg-primary-900/30">
      {children}
    </div>
  );
}

function NavButton({
  onClick,
  label,
  children,
}: {
  readonly onClick: () => void;
  readonly label: string;
  readonly children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="cursor-pointer rounded p-1 text-primary-700 hover:bg-primary-100 dark:text-primary-300 dark:hover:bg-primary-900/50"
    >
      {children}
    </button>
  );
}

function ClearButton({
  dict,
  onClear,
}: {
  readonly dict: I18nRecord;
  readonly onClear: () => void;
}) {
  const label = tr("pages.planning.search.clear", dict);
  return (
    <button
      type="button"
      onClick={onClear}
      aria-label={label}
      title={label}
      className="cursor-pointer rounded p-1 text-gray-500 hover:bg-gray-200 dark:text-gray-400 dark:hover:bg-gray-700"
    >
      <IoClose className="w-4 h-4" />
    </button>
  );
}
