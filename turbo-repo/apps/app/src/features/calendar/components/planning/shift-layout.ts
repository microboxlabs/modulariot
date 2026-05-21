import dayjs from "dayjs";
import {
  TimeWindowUtils,
  getWeekOfMonth,
  isTimeWindow,
  type TimeSlot,
  type TimeWindowColor,
} from "./planning-selection-context";

/** Baseline pixel height of one 30-min row when no shift inside needs more. */
export const BASE_ROW_HEIGHT_PX = 48;

/**
 * Approximate rendered height of a single chip inside a shift overlay.
 * Matches the chip's `text-xs px-1.5 py-1` styling with two stacked text
 * lines (service ID + route).
 */
const CHIP_HEIGHT_PX = 40;
/** Vertical gap between stacked chips (Tailwind `gap-0.5`). */
const CHIP_GAP_PX = 2;
/** Total vertical padding inside the overlay (Tailwind `inset-1` × 2). */
const OVERLAY_PADDING_PX = 8;

/**
 * Pixel height a shift's chip stack needs. Returns 0 when the shift has no
 * services (the baseline rectangle suffices). Used by callers to decide
 * whether the row containing the shift must be stretched.
 */
export function shiftContentHeightPx(serviceCount: number): number {
  if (serviceCount <= 0) return 0;
  return (
    OVERLAY_PADDING_PX +
    serviceCount * CHIP_HEIGHT_PX +
    Math.max(0, serviceCount - 1) * CHIP_GAP_PX
  );
}

/**
 * Build cumulative pixel offsets from per-row heights. `offsets[i]` is the
 * top of row `i`; the last entry is the bottom of the grid.
 */
export function rowOffsetsFromHeights(heights: readonly number[]): number[] {
  let cumulative = 0;
  const offsets = [cumulative];
  for (const h of heights) {
    cumulative += h;
    offsets.push(cumulative);
  }
  return offsets;
}

/**
 * Walk every base-laid shift, derive its required px/min from the chip
 * stack height, propagate the maximum to each row the shift spans, and
 * return the resulting per-row heights + cumulative offsets. Shared by
 * day and week views — week-view callers pass shifts from all 7 day
 * columns so the row stretches as soon as any single column's shift
 * needs more height (rows are shared across columns in the grid).
 */
export function computeStretchedRowLayout(params: {
  baseShifts: readonly PositionedShift[];
  getServicesCount: (shift: PositionedShift) => number;
  rowCount: number;
  dayStartMin: number;
}): { rowHeights: number[]; rowOffsets: number[] } {
  const { baseShifts, getServicesCount, rowCount, dayStartMin } = params;
  const requiredPxPerMin = new Array<number>(rowCount).fill(
    BASE_ROW_HEIGHT_PX / 30
  );
  for (const shift of baseShifts) {
    const contentPx = shiftContentHeightPx(getServicesCount(shift));
    if (contentPx <= 0) continue;
    const required = contentPx / shift.durationMinutes;
    const startRow = Math.floor((shift.startsAtMin - dayStartMin) / 30);
    const endRow = Math.min(
      rowCount - 1,
      Math.floor((shift.endsAtMin - 1 - dayStartMin) / 30)
    );
    for (let r = Math.max(0, startRow); r <= endRow; r++) {
      if (required > requiredPxPerMin[r]) requiredPxPerMin[r] = required;
    }
  }
  const heights = requiredPxPerMin.map((p) =>
    Math.max(BASE_ROW_HEIGHT_PX, Math.ceil(p * 30))
  );
  return { rowHeights: heights, rowOffsets: rowOffsetsFromHeights(heights) };
}

export interface PositionedShift {
  id: string;
  twId: string;
  twName: string;
  twColor: TimeWindowColor;
  /** Slot capacity = parent TW's quota (max bookings the slot can hold). */
  capacity: number;
  /** The day this shift belongs to. */
  date: Date;
  /**
   * True when the shift's day is strictly before today. Used by the overlay
   * layer to skip the "add booking" affordance and render the rectangle in
   * a muted/read-only style — past days cannot be planned or assigned.
   */
  isPastDay: boolean;
  slotHour: number;
  slotMinutes: number;
  durationMinutes: number;
  /** Pixel offset from the top of the overlay container. */
  top: number;
  /** Pixel height of the rectangle. */
  height: number;
  /** Column geometry: which day-column (0-based) and how many in total. */
  columnIndex: number;
  columnCount: number;
  /** Minutes-of-day where the shift starts. */
  startsAtMin: number;
  /** Minutes-of-day where the shift ends (exclusive). */
  endsAtMin: number;
}

interface BuildShiftLayoutParams {
  timeSlots: TimeSlot[];
  date: Date;
  startHour: number;
  /**
   * Cumulative pixel offsets per 30-min row. Index `i` is the top of row `i`,
   * length must be `(endHour - startHour) * 2 + 1` so the final entry is the
   * bottom of the last row. Variable per-row heights (chip stacking) are
   * preserved by interpolating within each row.
   */
  rowOffsets: number[];
  /**
   * 0-based index of the day column the overlays belong to. Defaults to 0
   * (single-day grids). Combined with `columnCount` to compute horizontal
   * placement in multi-day views.
   */
  columnIndex?: number;
  /** Total number of day columns in the parent grid. Defaults to 1. */
  columnCount?: number;
}

/**
 * Compute absolute-positioned shift rectangles from TW config for a given day.
 * Pure function — no DOM, no React. Synthesizes one rectangle at every
 * `slotDurationMinutes` step within each TW's active range on `date`; every
 * rectangle is bookable. Whether a window has reached its booking capacity for
 * the day is a runtime concern derived from the planned services, applied by
 * the overlay layer — not encoded here.
 *
 * BLOCK windows are ignored — those are rendered by the existing block
 * styling on the underlying cells.
 */
export function buildShiftLayout({
  timeSlots,
  date,
  startHour,
  rowOffsets,
  columnIndex = 0,
  columnCount = 1,
}: BuildShiftLayoutParams): PositionedShift[] {
  const day = dayjs(date);
  const isPastDay = day.isBefore(dayjs().startOf("day"), "day");
  const dayStartMin = startHour * 60;
  const out: PositionedShift[] = [];

  for (const tw of timeSlots) {
    if (!isTimeWindow(tw)) continue;
    const duration = tw.slotDurationMinutes ?? 30;
    if (duration <= 0) continue;

    const range = getTwRangeOnDate(tw, day);
    if (!range) continue;

    for (let m = range.startMin; m + duration <= range.endMin; m += duration) {
      const slotHour = Math.floor(m / 60);
      const slotMinutes = m % 60;

      const top = minutesToPx(m - dayStartMin, rowOffsets);
      const bottom = minutesToPx(m + duration - dayStartMin, rowOffsets);
      out.push({
        id: `${day.format("YYYY-MM-DD")}-${tw.id}-${m}`,
        twId: tw.id,
        twName: tw.name,
        twColor: tw.color ?? "emerald",
        capacity: tw.quota,
        date,
        isPastDay,
        slotHour,
        slotMinutes,
        durationMinutes: duration,
        top,
        height: Math.max(2, bottom - top),
        columnIndex,
        columnCount,
        startsAtMin: m,
        endsAtMin: m + duration,
      });
    }
  }

  return out;
}

function getTwRangeOnDate(
  tw: TimeSlot,
  date: dayjs.Dayjs
): { startMin: number; endMin: number } | null {
  if (tw.type === "daily-override") {
    if (!tw.startTimestamp || !tw.endTimestamp) return null;
    const start = dayjs(tw.startTimestamp);
    const end = dayjs(tw.endTimestamp);
    if (!start.isSame(date, "day")) return null;
    return {
      startMin: start.hour() * 60 + start.minute(),
      endMin: end.hour() * 60 + end.minute(),
    };
  }

  if (!tw.weeklyPattern) return null;
  const parsed = TimeWindowUtils.parseWeeklyPattern(tw.weeklyPattern);
  if (!parsed) return null;

  // JS day (0=Sun) → format day (1=Mon … 7=Sun); mirrors matchesWeeklyPattern.
  const jsDay = date.day();
  const formatDay = jsDay === 0 ? 7 : jsDay;
  if (!parsed.days.includes(formatDay)) return null;

  if (parsed.weeks.length > 0) {
    if (!parsed.weeks.includes(getWeekOfMonth(date))) return null;
  }

  return {
    startMin: parsed.startHour * 60 + parsed.startMinutes,
    endMin: parsed.endHour * 60 + parsed.endMinutes,
  };
}

/**
 * Map a minute offset (from grid top) to a pixel offset, interpolating inside
 * the 30-min row that contains it so variable-height rows stay aligned.
 */
function minutesToPx(minutesFromTop: number, rowOffsets: number[]): number {
  if (minutesFromTop <= 0) return rowOffsets[0] ?? 0;
  const lastIdx = rowOffsets.length - 1;
  const rowIdx = Math.min(Math.floor(minutesFromTop / 30), lastIdx - 1);
  const within = minutesFromTop - rowIdx * 30;
  const top = rowOffsets[rowIdx];
  const next = rowOffsets[rowIdx + 1];
  const rowH = next - top;
  return top + (within / 30) * rowH;
}
