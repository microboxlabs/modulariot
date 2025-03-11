import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import relativeTime from "dayjs/plugin/relativeTime";
import updateLocale from "dayjs/plugin/updateLocale";

import "dayjs/locale/es-mx";
import "dayjs/locale/en";
import { defaultLocale } from "@/features/i18n/tr.service";

dayjs.extend(duration);
dayjs.extend(relativeTime);
dayjs.extend(updateLocale);

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
  console.log(locale);

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
  return dayjs(date);
}
