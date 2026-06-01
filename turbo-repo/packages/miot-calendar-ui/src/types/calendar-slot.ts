/**
 * A selected time slot in the calendar grid. Domain-agnostic: the calendar
 * works purely in date + time-of-day + optional platform ("anden") terms.
 */
export interface SelectedSlot {
  date: Date;
  hour: number;
  minutes: number;
  /** Day-column index in week view (0-based). */
  dayIndex?: number;
  /** 1-based platform/bay number, when the calendar uses parallel slots. */
  anden?: number;
}
