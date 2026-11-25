/**
 * When a dashboard was created, as the list shows it: a short date in the
 * page's language, and a "New" badge on the day it was created.
 */

function parsed(createdAt: string | undefined): number | null {
  if (!createdAt) return null;
  const time = Date.parse(createdAt);
  return Number.isNaN(time) ? null : time;
}

/**
 * Created today, in the viewer's own time zone; false when not known. The
 * badge goes away at the viewer's midnight, not 24 hours after creation.
 */
export function isNewDashboard(
  createdAt: string | undefined,
  now: number = Date.now()
): boolean {
  const time = parsed(createdAt);
  if (time === null) return false;
  return new Date(time).toDateString() === new Date(now).toDateString();
}

export interface CreatedFormat {
  /** "Nov 20, 2026". */
  short: string;
  /** The date and time, for the tooltip. */
  full: string;
}

/** The creation date in `lang`; null when it is missing or unreadable. */
export function formatCreated(
  createdAt: string | undefined,
  lang: string | undefined
): CreatedFormat | null {
  const time = parsed(createdAt);
  if (time === null) return null;
  const date = new Date(time);
  return {
    short: new Intl.DateTimeFormat(lang, { dateStyle: "medium" }).format(date),
    full: new Intl.DateTimeFormat(lang, {
      dateStyle: "long",
      timeStyle: "short",
    }).format(date),
  };
}

/** What last happened to a dashboard, as its card says it. */
export type ActivityKind = "created" | "opened" | "edited";

export interface Activity {
  kind: ActivityKind;
  /** ISO-8601. */
  at: string;
}

/** Every date a card knows about a dashboard; any of them may be missing. */
export interface ActivityDates {
  createdAt?: string;
  /** The viewer's own last open of it. */
  openedAt?: string;
  /** Its last save. */
  updatedAt?: string;
}

/**
 * The latest of its creation, the viewer's last open of it and its last
 * edit; null when none is known. The first save is the creation, not an
 * edit, so a dashboard saved once says "created". On a tie an edit wins over
 * an open: whoever opened it to edit it wants to see the edit.
 */
export function latestActivity(dates: ActivityDates): Activity | null {
  const created = parsed(dates.createdAt);
  const updated = parsed(dates.updatedAt);
  const candidates: [ActivityKind, string | undefined, number | null][] = [
    ["created", dates.createdAt, created],
    [
      "edited",
      dates.updatedAt,
      updated !== null && (created === null || updated > created)
        ? updated
        : null,
    ],
    ["opened", dates.openedAt, parsed(dates.openedAt)],
  ];
  let latest: (Activity & { time: number }) | null = null;
  for (const [kind, at, time] of candidates) {
    if (at === undefined || time === null) continue;
    if (latest === null || time > latest.time) latest = { kind, at, time };
  }
  return latest && { kind: latest.kind, at: latest.at };
}

/**
 * The creation date filter's range, as its capsule shows it: "Nov 1 – 20"
 * this year, with the year otherwise, one date when it is a single day.
 * Takes "YYYY-MM-DD HH:mm:ss" in the viewer's time zone, as the picker gives.
 */
export function formatCreatedRange(
  range: { from: string; to: string },
  lang: string | undefined,
  now: number = Date.now()
): string {
  const from = new Date(range.from.replace(" ", "T"));
  const to = new Date(range.to.replace(" ", "T"));
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return "";
  const year = new Date(now).getFullYear();
  const thisYear = from.getFullYear() === year && to.getFullYear() === year;
  const format = new Intl.DateTimeFormat(
    lang,
    thisYear ? { day: "numeric", month: "short" } : { dateStyle: "medium" }
  );
  if (from.toDateString() === to.toDateString()) return format.format(from);
  return format.formatRange(from, to);
}
