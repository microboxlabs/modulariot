import type { Fetcher } from "../client.js";
import type {
  BookingListResponse,
  BookingRequest,
  BookingResponse,
  BookingUpdateRequest,
  MoveBookingRequest,
} from "../types.js";

const BASE = "/api/v1/miot-calendar/bookings";

export function createBookingsApi(fetcher: Fetcher) {
  return {
    list(params?: {
      calendarId?: string;
      startDate?: string;
      endDate?: string;
    }): Promise<BookingListResponse> {
      return fetcher("GET", BASE, { query: params });
    },

    get(id: string): Promise<BookingResponse> {
      return fetcher("GET", `${BASE}/${id}`);
    },

    create(
      body: BookingRequest,
      options?: { userId?: string },
    ): Promise<BookingResponse> {
      return fetcher("POST", BASE, {
        body,
        headers: options?.userId
          ? { "X-User-Id": options.userId }
          : undefined,
      });
    },

    /**
     * Update an existing booking's resource payload in place. The slot is not
     * changed; use {@link move} to move a booking (or update its payload as
     * part of a move).
     */
    update(
      id: string,
      body: BookingUpdateRequest,
    ): Promise<BookingResponse> {
      return fetcher("PUT", `${BASE}/${id}`, { body });
    },

    /**
     * Move a booking to a different slot in the same calendar (and optionally
     * refresh its resource payload) as a single transactional operation. The
     * booking id is preserved across the move; a same-slot call collapses to
     * a payload-only update.
     */
    move(
      id: string,
      body: MoveBookingRequest,
    ): Promise<BookingResponse> {
      return fetcher("POST", `${BASE}/${id}/move`, { body });
    },

    cancel(id: string): Promise<void> {
      return fetcher("DELETE", `${BASE}/${id}`);
    },

    listByResource(resourceId: string): Promise<BookingListResponse> {
      return fetcher("GET", `${BASE}/resource/${resourceId}`);
    },
  };
}
