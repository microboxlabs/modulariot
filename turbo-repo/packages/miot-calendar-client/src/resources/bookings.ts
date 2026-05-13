import type { Fetcher } from "../client.js";
import type {
  BookingListResponse,
  BookingRequest,
  BookingResponse,
  BookingUpdateRequest,
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
     * changed; move a booking by cancelling and recreating it.
     */
    update(
      id: string,
      body: BookingUpdateRequest,
    ): Promise<BookingResponse> {
      return fetcher("PUT", `${BASE}/${id}`, { body });
    },

    cancel(id: string): Promise<void> {
      return fetcher("DELETE", `${BASE}/${id}`);
    },

    listByResource(resourceId: string): Promise<BookingListResponse> {
      return fetcher("GET", `${BASE}/resource/${resourceId}`);
    },
  };
}
