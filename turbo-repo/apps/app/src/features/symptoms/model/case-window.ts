/**
 * The map's ranges in the treatment header of an engine case: the positions
 * it draws (the case's trip when `on_trip`) and the case's own time.
 */
export type MapWindow = {
  track_from: string;
  track_to: string;
  on_trip: boolean;
  case_from: string;
  case_to: string;
};

export type CaseWindow = { from: string; to: string };

type CaseHeader = {
  map_window?: MapWindow | null;
  timeline?: { start?: string | null; end?: string | null }[] | null;
};

/**
 * The case's own time, whose pulses the map highlights: `map_window`, or the
 * header's single timeline entry from a server that does not send it.
 */
export function caseWindowOf(
  header: CaseHeader | null | undefined
): CaseWindow | null {
  const window = header?.map_window;
  if (window?.case_from && window.case_to) {
    return { from: window.case_from, to: window.case_to };
  }
  const entry = header?.timeline?.[0];
  return entry?.start && entry.end
    ? { from: entry.start, to: entry.end }
    : null;
}

/** The indices of the positions whose time is inside the window, oldest first. */
export function pulsesInWindow(
  positions: { timestamp?: string | null }[] | null | undefined,
  window: CaseWindow | null | undefined
): number[] {
  if (!positions?.length || !window) return [];
  const from = Date.parse(window.from);
  const to = Date.parse(window.to);
  if (Number.isNaN(from) || Number.isNaN(to)) return [];
  const out: number[] = [];
  positions.forEach((p, i) => {
    const t = p.timestamp ? Date.parse(p.timestamp) : Number.NaN;
    if (t >= from && t <= to) out.push(i);
  });
  return out;
}
