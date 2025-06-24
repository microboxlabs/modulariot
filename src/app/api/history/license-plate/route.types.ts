/**
 * Trip History API Types
 *
 * This file contains TypeScript interfaces for the trip history endpoint
 * that can be imported and used in frontend components.
 */

export interface TripHistoryItem {
  trip_id: string;
  asset_id: string;
  trip_type: string;
  origin_geofence_id: number;
  destination_geofence_id: number;
  stop_geofence_ids: number[];
  status: string;
  driver_id: string;
  start_time: string;
  end_time: string | null;
  current_geofence_id: number;
  created_by_client_id: string;
  created_timestamp: string;
  modified_by_client_id: string;
  modified_timestamp: string;
  carrier_id: string;
  carrier_name: string;
  type_load: string;
  driver_name: string;
  rampla_plate: string;
  origin_geofence_label: string;
  destination_geofence_label: string;
  closed_timestamp: string;
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
