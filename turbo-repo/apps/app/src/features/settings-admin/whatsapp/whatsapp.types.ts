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

/**
 * Split a free-text recipient list (comma- or newline-separated) into trimmed,
 * non-empty entries. The phone format is left as typed — the backend normalizes to
 * digits when it enforces the allowlist.
 */
export function parseRecipientList(raw: string): string[] {
  return raw
    .split(/[\n,]+/)
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

/**
 * Render a stored recipient list (a JSON array or a comma/newline string) as
 * newline-separated text for the form textarea.
 */
export function formatRecipientList(value: unknown): string {
  if (Array.isArray(value)) {
    return value
      .map((entry) => String(entry).trim())
      .filter((entry) => entry.length > 0)
      .join("\n");
  }
  if (typeof value === "string") {
    return parseRecipientList(value).join("\n");
  }
  return "";
}

/** Loosely interpret a metadata flag (boolean or "true"/"false" string) as a boolean. */
export function isTruthyFlag(value: unknown): boolean {
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "string") {
    return value.trim().toLowerCase() === "true";
  }
  return false;
}

/** Shared form fields (everything except the access token, which differs by mode). */
const whatsAppBaseShape = {
  name: z.string().min(1, "validation.nameRequired"),
  phoneNumberId: z.string().min(1, "validation.phoneNumberIdRequired"),
  wabaId: z.string().min(1, "validation.wabaIdRequired"),
  graphVersion: z.string().min(1, "validation.graphVersionRequired"),
  baseUrl: z.string().url("validation.baseUrlInvalid"),
  testModeEnabled: z.boolean(),
  testRecipients: z.string(),
};

/**
 * When test mode is on the allowlist must hold at least one recipient — otherwise every
 * send would be blocked silently, which is a footgun rather than a safety net.
 */
function requireRecipientsWhenTestMode(
  data: { testModeEnabled: boolean; testRecipients: string },
  ctx: z.RefinementCtx,
): void {
  if (data.testModeEnabled && parseRecipientList(data.testRecipients).length === 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["testRecipients"],
      message: "validation.testRecipientsRequired",
    });
  }
}

/** Form for creating a WhatsApp connection. Messages are i18n keys (resolved via trDynamic). */
export const WhatsAppConnectionSchema = z
  .object({
    ...whatsAppBaseShape,
    token: z.string().min(1, "validation.tokenRequired"),
  })
  .superRefine(requireRecipientsWhenTestMode);

export type WhatsAppFormData = z.infer<typeof WhatsAppConnectionSchema>;

/**
 * Edit form: same fields as create, but the token is optional — leaving it blank keeps
 * the stored token. The form still uses {@link WhatsAppFormData} (token defaults to "").
 */
export const WhatsAppEditSchema = z
  .object({
    ...whatsAppBaseShape,
    token: z.string().optional(),
  })
  .superRefine(requireRecipientsWhenTestMode);
