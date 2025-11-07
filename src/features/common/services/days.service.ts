import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import relativeTime from "dayjs/plugin/relativeTime";
import updateLocale from "dayjs/plugin/updateLocale";
import timezone from "dayjs/plugin/timezone";
import utc from "dayjs/plugin/utc";

import "dayjs/locale/es-mx";
import "dayjs/locale/en";
import { defaultLocale } from "@/features/i18n/tr.service";

dayjs.extend(duration);
dayjs.extend(relativeTime);
dayjs.extend(updateLocale);
dayjs.extend(timezone);
dayjs.extend(utc);

dayjs.updateLocale("es-mx", {
  relativeTime: {
    future: "%s restantes",
    past: "hace %s",
    s: "unos segundos",
    m: "un minuto",
    mm: "%d minutos",
    h: "una hora",
    hh: "%d horas",
    d: "un día",
    dd: "%d días",
    M: "un mes",
    MM: "%d meses",
    y: "un año",
    yy: "%d años",
  },
});

dayjs.updateLocale("en", {
  relativeTime: {
    future: "in %s",
    past: "%s ago",
    s: "a few seconds",
    m: "a minute",
    mm: "%d minutes",
    h: "an hour",
    hh: "%d hours",
    d: "a day",
    dd: "%d days",
    M: "a month",
    MM: "%d months",
    y: "a year",
    yy: "%d years",
  },
});

export function configureLocale(locale?: string) {
  locale = locale || defaultLocale;
  if (locale === "es") {
    locale = "es-mx";
  } else if (locale === "en") {
    locale = "en";
  }
  dayjs.locale(locale);
}

export function humanizeFrom(date: string): string {
  return dayjs(date).fromNow();
}

export function fromString(date: string): dayjs.Dayjs {
  // Handle format with bracket notation: "2025-10-23T02:48:52.551341763[America/Santiago]"
  if (date === null || date === undefined || date.trim() === "") {
    return dayjs("-");
  }
  const bracketTimezoneMatch = date.match(/^(.+)\[(.+)\]$/);
  if (bracketTimezoneMatch) {
    const [, dateTimePart, timezone] = bracketTimezoneMatch;
    if (!isValidDate(dateTimePart)) {
      return dayjs("-");
    }
    return dayjs.tz(dateTimePart, timezone);
  }

  // Handle space-separated format: "2025-10-19 21:00:00"
  // Replace space with 'T' to make it ISO-like for better parsing
  const normalizedDate =
    date.includes(" ") && !date.includes("T") ? date.replace(" ", "T") : date;

  if (!isValidDate(normalizedDate)) {
    return dayjs("-");
  }

  return dayjs.tz(normalizedDate, "America/Santiago");
}

export function isValidDate(date: string): boolean {
  return !Number.isNaN(new Date(date).getTime());
}
