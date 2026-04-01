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

// --- Fleet: Vehicles (read-only legacy) ---

export interface Vehicle {
  id: number;
  tenant: Tenant;
  plate: string;
  vin: string;
  brand: string;
  model: string;
  year: number;
  active: boolean;
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

// --- Bulk sync ---

export interface BulkSyncEntity {
  externalId: string;
  fields?: Record<string, unknown>;
  sourceMetadata?: Record<string, unknown>;
  aspectProperties?: Record<string, unknown>;
}

export interface BulkSyncRequest {
  sourceSystem: string;
  entities: BulkSyncEntity[];
}

export interface BulkSyncResponse {
  created: number;
  updated: number;
  skipped: number;
  errors: Array<{ externalId: string; message: string }>;
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
  headers?: Record<string, string>;
  fetch?: typeof fetch;
}
