import { z } from "zod";

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

export const WHATSAPP_PROVIDER = "WHATSAPP";
export const DEFAULT_GRAPH_VERSION = "v25.0";
export const DEFAULT_BASE_URL = "https://graph.facebook.com/v25.0";

/** Form for creating a WhatsApp connection. Messages are i18n keys (resolved via trDynamic). */
export const WhatsAppConnectionSchema = z.object({
  name: z.string().min(1, "validation.nameRequired"),
  phoneNumberId: z.string().min(1, "validation.phoneNumberIdRequired"),
  wabaId: z.string().min(1, "validation.wabaIdRequired"),
  graphVersion: z.string().min(1, "validation.graphVersionRequired"),
  baseUrl: z.string().url("validation.baseUrlInvalid"),
  token: z.string().min(1, "validation.tokenRequired"),
});

export type WhatsAppFormData = z.infer<typeof WhatsAppConnectionSchema>;
