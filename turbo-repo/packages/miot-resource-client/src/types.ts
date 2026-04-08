// --- Enums ---

export type EntityType = "DRIVER" | "TRUCK" | "TRAILER" | "CARRIER";

// --- Shared ---

export interface Tenant {
  id: number;
  code: string;
  name: string;
  active: boolean;
}

export interface EntityEvent {
  id: number;
  clientId: string;
  entityType: EntityType;
  entityId: string;
  eventType: string;
  eventSource: string;
  actor: string;
  payload: string;
  metadata: string;
  createdAt: string;
}

export interface StatusChangeRequest {
  status: string;
  reason?: string;
}

export interface PageParams {
  page?: number;
  size?: number;
  [key: string]: string | number | boolean | undefined;
}

export type TruckMetricView = "card" | "detail" | "diagnostics";

export interface TruckQueryParams extends PageParams {
  includeMetrics?: boolean;
  metricView?: TruckMetricView;
  metricFields?: string;
}

// --- Fleet: Trucks ---

export interface Truck {
  id: number;
  tenant: Tenant;
  clientId: string;
  entityId: string;
  externalId: string;
  status: string;
  alfrescoNodeId: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  licensePlate: string;
  vin: string;
  brand: string;
  model: string;
  year: number;
  maxWeight: number;
  volume: number;
  truckType: string;
  assetId?: string;
  latestMetrics?: Record<string, string | number | boolean | null>;
}

export interface CreateTruckRequest {
  externalId?: string;
  licensePlate?: string;
  vin?: string;
  brand?: string;
  model?: string;
  year?: number;
  maxWeight?: number;
  volume?: number;
  truckType?: string;
}

// --- Fleet: Trailers ---

export interface Trailer {
  id: number;
  tenant: Tenant;
  clientId: string;
  entityId: string;
  externalId: string;
  status: string;
  alfrescoNodeId: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  licensePlate: string;
  trailerType: string;
  maxWeight: number;
  axleCount: number;
}

export interface CreateTrailerRequest {
  externalId?: string;
  licensePlate?: string;
  trailerType?: string;
  maxWeight?: number;
  axleCount?: number;
}

// --- Fleet: Carriers ---

export interface Carrier {
  id: number;
  tenant: Tenant;
  clientId: string;
  entityId: string;
  externalId: string;
  status: string;
  alfrescoNodeId: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  name: string;
  rut: string;
  transportLicense: string;
  transportLicenseExpires: string;
}

export interface CreateCarrierRequest {
  externalId?: string;
  name?: string;
  rut?: string;
  transportLicense?: string;
  transportLicenseExpires?: string;
}

// --- Drivers ---

export interface Driver {
  id: number;
  tenant: Tenant;
  clientId: string;
  entityId: string;
  externalId: string;
  status: string;
  alfrescoNodeId: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  firstName: string;
  lastName: string;
  rut: string;
  phone?: string;
  mobilePhone?: string;
  email?: string;
  licenseNumber?: string;
  licenseCategory?: string;
  licenseExpires?: string;
  carrierId?: number;
  isOccasional?: boolean;
  operationBlocked?: boolean;
  addressStreet?: string;
  addressCity?: string;
  addressPostalCode?: string;
  addressCountry?: string;
  deactivatedAt?: string;
  sourceSystem?: string;
}

export interface CreateDriverRequest {
  externalId?: string;
  firstName?: string;
  lastName?: string;
  rut?: string;
  phone?: string;
  mobilePhone?: string;
  email?: string;
  licenseNumber?: string;
  licenseCategory?: string;
  licenseExpires?: string;
  carrierExternalId?: string;
  isOccasional?: boolean;
  operationBlocked?: boolean;
}

export interface UpdateDriverRequest {
  firstName?: string;
  lastName?: string;
  rut?: string;
  phone?: string;
  mobilePhone?: string;
  email?: string;
  licenseNumber?: string;
  licenseCategory?: string;
  licenseExpires?: string;
  carrierExternalId?: string;
  isOccasional?: boolean;
  operationBlocked?: boolean;
}

// --- Sync cursors ---

export interface SyncCursor {
  sourceSystem: string;
  entityType: string;
  cursorType: string;
  cursorValue: string;
  updatedAt: string;
}

export interface AdvanceCursorRequest {
  cursorType?: string;
  cursorValue?: string;
  entitiesSynced?: number;
  errors?: number;
}

// --- Error ---

export interface ErrorResponse {
  error: string;
  message: string;
  status: number;
  timestamp: string;
}

// --- Client config ---

export interface ClientConfig {
  baseUrl: string;
  organizationId: string;
  headers?: Record<string, string>;
  fetch?: typeof fetch;
}
