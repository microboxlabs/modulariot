import type {
  BookingListResponse,
  BookingRequest,
  BookingResponse,
  BookingUpdateRequest,
  MoveBookingRequest,
} from "@microboxlabs/miot-calendar-client";

/**
 * The booking CRUD surface the planning core calls. A host may override it
 * (e.g. with Next.js proxy routes that also drive workflow side-effects); when
 * omitted the package builds a default from `CalendarHost.client` via
 * `createMiotCalendarClient`.
 */
export interface BookingApi {
  createBooking(body: BookingRequest): Promise<BookingResponse>;
  moveBooking(id: string, body: MoveBookingRequest): Promise<BookingResponse>;
  updateBooking(
    id: string,
    body: BookingUpdateRequest
  ): Promise<BookingResponse>;
  cancelBooking(id: string): Promise<void>;
  listBookings(
    params?: { calendarId?: string; startDate?: string; endDate?: string },
    signal?: AbortSignal
  ): Promise<BookingListResponse>;
}

/**
 * Core-supplied context handed to the persist-decision and post-persist hooks
 * so the host can reproduce task-driven branching (skip-persist, transition
 * ordering) without owning the package's private selection state.
 */
export interface BookingPersistContext {
  /** Existing booking id for this item, when re-planning/assigning in place. */
  oldBookingId?: string;
  /** True when the confirm completes an in-progress reassignment. */
  isReassigning: boolean;
  /**
   * The booking the core just wrote (legacy persist path). Absent when the
   * host's `shouldPersistBooking` returned false, i.e. the row is owned by a
   * task-driven backend listener.
   */
  booking?: BookingResponse;
}
