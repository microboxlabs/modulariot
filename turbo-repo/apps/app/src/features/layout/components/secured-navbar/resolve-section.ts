/**
 * Maps a pathname's segments to the key under which its filter params are
 * registered in `getNavegationParams()`.
 *
 * Normally that is just the last segment (`/shipping` → `shipping`). Calendar
 * planning is the exception: it lives at `/calendar/<calendarId>/planning`, so
 * its last segment is `planning` — the very key the kanban planning board
 * registers. Left alone, the calendar renders the *kanban's* filter bar, whose
 * params nothing on the calendar reads.
 *
 * `calendar-planning` is synthetic on purpose: it matches no path segment, so
 * the bare `/calendar` landing page still resolves to an unregistered key and
 * stays bar-less.
 */
export function resolveSection(segments: string[]): string | undefined {
  const finalPath = segments.at(-1);

  if (segments.includes("calendar") && finalPath === "planning") {
    return "calendar-planning";
  }

  return finalPath;
}

export function segmentsOf(pathname: string): string[] {
  return pathname.split("/").filter(Boolean);
}
