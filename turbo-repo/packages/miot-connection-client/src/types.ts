// --- Enums ---

export type ProviderType =
  | "POSTGREST"
  | "ALERCE_TMS"
  | "N8N"
  | "AUTH0"
  | "ECM"
  | "CUSTOM_HTTP";

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
