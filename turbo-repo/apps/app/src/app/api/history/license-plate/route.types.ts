/**
 * Trip History API Types
 *
 * This file contains TypeScript interfaces for the trip history endpoint
 * that can be imported and used in frontend components.
 */

export interface TripHistoryItem {
  mintral_key: string;
  bpm_assignee: string;
  initiator: string;
  mintral_registrationActive: boolean;
  bpm_sendEMailNotifications: boolean;
  mintral_serviceCode: number;
  bpm_hiddenTransitions: string;
  bpm_workflowPriority: number;
  workflowinstanceid: string;
  taskFormKey: string;
  transportValidation: string[];
  mintral_geofenceDestinationMetadata: string;
  mintral_destinationDelegateCode: string;
  overlordTripInit: string[];
  mintral_totalDestinations: number;
  mintral_approxMinTime: number;
  id: string;
  confirmTripDestinationArrival: string[];
  mintral_driver1Phone: string;
  bpm_outcome: string;
  mintral_expectedDepartureDate: string;
  bpm_package: string;
  pooledActorsHistory: string[];
  mintral_forwardId: string;
  mintral_distance: number;
  bpm_packageItemActionGroup: string;
  mintral_trailerLicensePlate: string;
  mintral_supplierId: string;
  confirmTripDestinationDeparture: string[];
  mintral_servicePrincipalStatus: string;
  mintral_geofenceStopsMetadata: string;
  initiatorhome: string;
  bpm_outcomePropertyName: Record<string, any>;
  mintral_serviceType: string;
  mintral_geofenceOriginMetadata: string;
  cm_name: string;
  mintral_hoReference: string;
  cancelled: boolean;
  mintral_directService: string;
  confirmMonitoringFinalization: string[];
  mintral_originDelegateCode: string;
  mintral_observations: string;
  bpm_packageActionGroup: string;
  bpm_reassignable: boolean;
  bpm_priority: number;
  mintral_speed: number;
  bpm_percentComplete: number;
  mintral_creationDate: string;
  mintral_departureDate: string;
  mintral_servicePrincipalNumber: string;
  wfship_missionControlValidationOutcome: string;
  missionControlTripInit: string[];
  wfship_startEventOutcome: string;
  mintral_estimatedArrivalDate?: string;
  mintral_serviceKind: string;
  instanceId: string;
  monitoringInCourseTrip: string[];
  mintral_servicePrincipalTimestamp: number;
  mintral_rutaHorasTransito: number;
  sovosDigitalSignature: string[];
  mintral_approxTime: number;
  mintral_driver2Name: string;
  bpm_workflowDescription: string;
  companyhome: string;
  _startTaskCompleted: string;
  mintral_supplierName: string;
  bpm_description: string;
  mintral_approxMaxTime: number;
  mintral_priorityCode: string;
  mintral_truckLicensePlate: string;
  wfship_monitoringInCourseTripOutcome: string;
  mintral_customerCode: string;
  mintral_driver1Name: string;
  wfship_transportValidationOutcome: string;
  bpm_status: string;
  confirmDelivery: string[];
  mintral_registrationCreatedAt: string;
  mintral_driver1Rut: string;
  wfship_sovosDigitalSignatureOutcome: string;
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
  type_load?: string;
  page?: string;
  limit?: string;
  trailer_license_plate?: string;
  carrier_id?: string;
  carrier_name?: string;
  customer_code?: string;
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
  filters: Partial<TripHistoryFilters>
) => void;

/**
 * Pagination handler type
 */
export type PaginationHandler = (page: number) => void;
