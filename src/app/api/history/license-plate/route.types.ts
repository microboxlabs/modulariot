/**
 * Trip History API Types
 *
 * This file contains TypeScript interfaces for the trip history endpoint
 * that can be imported and used in frontend components.
 */

export interface TripHistoryItem {
  trip_id: string;
  asset_id: string;
  start_time: string;
  end_time: string;
  origin: string;
  destination: string;
  driver: string;
  driver2?: string;
  carrier: string;
  type_load: string;
  driver_contact: string;
  status: string;
  duration_sec: number;
  distance_km?: number;
  average_speed?: number;
  max_speed?: number;
  fuel_consumption?: number;
  symptoms_count?: number;
  treatments_count?: number;
  geographical_reference_point?: string;
  client?: string;
  created_at: string;
  updated_at: string;
}

export interface TripHistoryResponse {
  success: boolean;
  data: TripHistoryItem[];
  pagination?: {
    total: number;
    page: number;
    limit: number;
    total_pages: number;
  };
  filters?: {
    date_from?: string;
    date_to?: string;
    status?: string;
    origin?: string;
    destination?: string;
    driver?: string;
  };
  message?: string;
}

export interface TripHistoryFilters {
  date_from?: string;
  date_to?: string;
  status?: string;
  origin?: string;
  destination?: string;
  driver?: string;
  page?: string;
  limit?: string;
}

/**
 * Trip status constants for type safety
 */
export const TRIP_STATUS = {
  COMPLETED: "completed",
  IN_PROGRESS: "in_progress",
  CANCELLED: "cancelled",
  PENDING: "pending",
  ON_HOLD: "on_hold",
  DELAYED: "delayed",
} as const;

export type TripStatus = (typeof TRIP_STATUS)[keyof typeof TRIP_STATUS];

/**
 * Utility types for API responses
 */
export type TripHistorySuccessResponse = TripHistoryResponse & {
  success: true;
  data: TripHistoryItem[];
};

export type TripHistoryErrorResponse = TripHistoryResponse & {
  success: false;
  data: [];
  message: string;
};

/**
 * Hook return type for trip history
 */
export interface TripHistoryHookResult {
  data: TripHistoryResponse | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

/**
 * Filter change handler type
 */
export type FilterChangeHandler = (
  filters: Partial<TripHistoryFilters>,
) => void;

/**
 * Pagination handler type
 */
export type PaginationHandler = (page: number) => void;
