/** Mirrors the Quarkus `IntegrationConnection` DTO (miot-integrations). */
export interface IntegrationConnection {
  id: string;
  tenantCode: string;
  name: string;
  providerType: string;
  baseUrl: string;
  credentialProfileId: string | null;
  status: "DRAFT" | "ACTIVE" | "INACTIVE" | "TEST_FAILED";
  lastTestedAt: string | null;
  lastTestResult: boolean | null;
  metadata: Record<string, unknown>;
}

/** Mirrors the Quarkus `CredentialProfileResponse` DTO. */
export interface CredentialProfileResponse {
  id: string;
  displayName: string;
  authType: string;
}

/** Mirrors the Quarkus `ConnectionTestResponse` DTO. */
export interface ConnectionTestResult {
  success: boolean;
  testedAt: string;
  message: string;
}

/**
 * A channel connection to create. With `credentialProfileId` it uses that stored
 * credential; otherwise `token` is stored as a new bearer credential.
 */
export interface ChannelCreate {
  name: string;
  baseUrl: string;
  token?: string;
  credentialName?: string;
  /** Non-secret config for the new credential, e.g. a provider tag. */
  credentialPublicConfig?: Record<string, unknown>;
  credentialProfileId?: string;
  metadata: Record<string, unknown>;
}

/** A channel connection update. A blank token keeps the stored one. */
export interface ChannelUpdate {
  name: string;
  baseUrl: string;
  /** Rotates the key of the credential linked now. */
  token?: string;
  /** Links another stored credential. */
  credentialProfileId?: string;
  metadata: Record<string, unknown>;
}
