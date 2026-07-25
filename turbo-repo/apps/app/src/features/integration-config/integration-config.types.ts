/**
 * Integration configuration — the operator-facing layer over miot-integrations.
 *
 * An **integration template** is a reusable *type* (like an n8n node type): it owns the
 * payload contract — method, path and the request schema the review process maps against.
 * A **connection** is an *instance* of a template: its own base URL and credential. Creating
 * a connection from a template copies the template's contract onto it, so several instances
 * of one template all speak the same payload with different endpoints and credentials.
 */

/** `IntegrationTemplate` as miot-integrations serializes it. */
export interface IntegrationTemplate {
  readonly id: string;
  readonly name: string;
  readonly providerType: string;
  readonly operationName: string;
  readonly method: string;
  readonly path: string;
  readonly requestSchema: Record<string, unknown>;
  readonly responseSchema: Record<string, unknown>;
}

/** `IntegrationConnection` as miot-integrations serializes it — an instance of a template. */
export interface IntegrationConnection {
  readonly id: string;
  readonly name: string;
  readonly providerType: string;
  readonly baseUrl: string;
  readonly credentialProfileId: string | null;
  readonly status: string;
  readonly lastTestedAt: string | null;
  readonly lastTestResult: boolean | null;
  readonly templateId: string | null;
  readonly metadata: Record<string, unknown>;
}

export interface CreateTemplateRequest {
  readonly name: string;
  readonly providerType: string;
  readonly operationName: string;
  readonly method: string;
  readonly path: string;
  readonly requestSchema: Record<string, unknown>;
  readonly responseSchema: Record<string, unknown>;
}

export type UpdateTemplateRequest = Partial<Omit<CreateTemplateRequest, "providerType">>;

export interface CreateConnectionRequest {
  readonly name: string;
  readonly baseUrl: string;
  readonly credentialProfileId: string | null;
  /** Set to create an instance of a template; the operation is provisioned from it. */
  readonly templateId: string;
}

export interface UpdateConnectionRequest {
  readonly name?: string;
  readonly baseUrl?: string;
}

export interface ConnectionTestResult {
  readonly success: boolean;
  readonly testedAt: string;
  readonly message: string | null;
}

/** Provider kinds a template can take, matching the backend enum. CUSTOM_HTTP leads. */
export const PROVIDER_TYPES: readonly string[] = [
  "CUSTOM_HTTP",
  "N8N",
  "POSTGREST",
  "ALERCE_TMS",
  "AUTH0",
  "ECM",
];

export const HTTP_METHODS: readonly string[] = ["POST", "PUT", "PATCH", "GET", "DELETE"];

/**
 * Parses a JSON string into an object, or returns an error message. Used by the schema
 * editors: the field holds text, the request wants an object.
 */
export function parseJsonObject(
  text: string
): { value: Record<string, unknown> } | { error: string } {
  const trimmed = text.trim();
  if (!trimmed) return { value: {} };
  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch (cause) {
    return { error: cause instanceof Error ? cause.message : "Invalid JSON" };
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return { error: "notObject" };
  }
  return { value: parsed as Record<string, unknown> };
}

/**
 * The dotted leaf paths a JSON-Schema subset declares, for the "fields this template maps"
 * preview. Mirrors the server's leaf flattening: an object recurses into `properties`, an
 * array recurses into `items`, and everything else is a leaf.
 */
export function schemaLeafPaths(schema: Record<string, unknown>): string[] {
  const out: string[] = [];
  walk(schema, "", out);
  return out;
}

function walk(node: unknown, prefix: string, out: string[]): void {
  if (typeof node !== "object" || node === null) return;
  const schema = node as Record<string, unknown>;
  const type = schema.type;
  if (type === "object" && isRecord(schema.properties)) {
    for (const [key, child] of Object.entries(schema.properties)) {
      walk(child, prefix ? `${prefix}.${key}` : key, out);
    }
    return;
  }
  if (type === "array" && isRecord(schema.items)) {
    walk(schema.items, prefix, out);
    return;
  }
  if (prefix) out.push(prefix);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
