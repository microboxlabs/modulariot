// --- Enums ---

export type ProviderType =
  | "POSTGREST"
  | "ALERCE_TMS"
  | "N8N"
  | "AUTH0"
  | "ECM"
  | "CUSTOM_HTTP"
  | "WHATSAPP"
  | "GPS_WEBHOOK";

export type AuthType =
  | "NONE"
  | "BEARER_TOKEN"
  | "API_KEY_HEADER"
  | "API_KEY_QUERY"
  | "BASIC"
  | "OAUTH2_CLIENT_CREDENTIALS"
  | "CUSTOM_HEADERS";

export type ConnectionStatus = "DRAFT" | "ACTIVE" | "INACTIVE" | "TEST_FAILED";

// --- Shared ---

export type JsonObject = Record<string, unknown>;

// --- Credential profiles ---

export interface CreateCredentialProfileRequest {
  displayName: string;
  authType: AuthType;
  publicConfig?: JsonObject;
  secretConfig?: JsonObject;
}

export interface CredentialProfileResponse {
  id: string;
  tenantCode: string;
  displayName: string;
  authType: AuthType;
  publicConfig: JsonObject;
  secretPreview: string;
  secretVersion: number;
  createdAt: string;
  updatedAt: string;
}

// --- Integration connections ---

export interface CreateIntegrationConnectionRequest {
  name: string;
  providerType: ProviderType;
  baseUrl: string;
  credentialProfileId: string;
  metadata?: JsonObject;
}

export interface IntegrationConnection {
  id: string;
  tenantCode: string;
  name: string;
  providerType: ProviderType;
  baseUrl: string;
  credentialProfileId: string;
  status: ConnectionStatus;
  lastTestedAt: string | null;
  lastTestResult: boolean | null;
  metadata: JsonObject;
}

export interface ConnectionTestRequest {
  method?: string;
  path?: string;
}

export interface ConnectionTestResponse {
  success: boolean;
  testedAt: string;
  message: string;
}

// --- Integration operations ---

export interface CreateIntegrationOperationRequest {
  name: string;
  method: string;
  path: string;
  requestSchema?: JsonObject;
  responseSchema?: JsonObject;
  testOperation?: boolean;
}

export interface IntegrationOperation {
  id: string;
  connectionId: string;
  name: string;
  method: string;
  path: string;
  requestSchema: JsonObject;
  responseSchema: JsonObject;
  testOperation: boolean;
}

// --- GPS webhook subscriptions ---

export type GpsWebhookFilterMode = "ALL_VISIBLE" | "RULES";

export interface GpsWebhookFilterScopes {
  allVisible?: boolean;
  assetIds?: string[];
  carrierIds?: string[];
  ingestClientIds?: string[];
  gpsProviders?: string[];
  owners?: string[];
}

export interface GpsWebhookFilter {
  scopes?: GpsWebhookFilterScopes;
  match?: "ALL" | string;
}

export interface CreateGpsWebhookRequest {
  name: string;
  url: string;
  credentialProfileId?: string | null;
  filterMode: GpsWebhookFilterMode;
  filter?: GpsWebhookFilter | JsonObject;
  enabled?: boolean;
}

export interface UpdateGpsWebhookRequest {
  name?: string;
  url?: string;
  filterMode?: GpsWebhookFilterMode;
  filter?: GpsWebhookFilter | JsonObject;
  enabled?: boolean;
}

export interface GpsWebhookResponse {
  id: string;
  tenantCode: string;
  connectionId: string;
  name: string;
  url: string;
  enabled: boolean;
  filterMode: GpsWebhookFilterMode;
  filter: GpsWebhookFilter | JsonObject;
  includeAllVisible: boolean;
  compiledAssetIds: string[];
  compiledAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface GpsWebhookTestResponse {
  success: boolean;
  statusCode: number | null;
  message: string;
  testedAt: string;
}

export type WebhookDeliveryState =
  | "PENDING"
  | "RUNNING"
  | "SUCCEEDED"
  | "FAILED"
  | "DEAD";

export interface WebhookDeliveryResponse {
  id: string;
  subscriptionId: string;
  tenantCode: string;
  dedupeKey: string | null;
  payload: JsonObject;
  state: WebhookDeliveryState;
  attempts: number;
  maxAttempts: number;
  nextRetryAt: string | null;
  lastStatusCode: number | null;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
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
