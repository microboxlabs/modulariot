/**
 * Parsers for the two bodies the datasource routes accept. Hand-written: a
 * schema library here would be a dependency of every consumer of the core.
 *
 * Both refuse unknown fields. A credential body that ignored a misspelled
 * `token` would store a credential with no secret in it and report success.
 */

import { DashboardServerError } from "../access/errors";
import { secureUrlProblem } from "../net/endpoint";
import type { CredentialInput } from "../seams/credentials";
import type { DataSourceInput, DataSourceKind } from "../seams/datasources";

const DATA_SOURCE_KINDS: readonly DataSourceKind[] = ["POSTGREST", "BIGQUERY"];

const DATA_SOURCE_FIELDS = new Set([
  "name",
  "type",
  "description",
  "isActive",
  "target",
  "credentialRef",
]);

function asObject(body: unknown): Record<string, unknown> {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    throw DashboardServerError.badRequest("Body must be a JSON object");
  }
  return body as Record<string, unknown>;
}

function rejectUnknown(
  raw: Record<string, unknown>,
  allowed: ReadonlySet<string>,
): void {
  for (const key of Object.keys(raw)) {
    if (!allowed.has(key)) {
      throw DashboardServerError.badRequest(`Unknown field "${key}"`);
    }
  }
}

function requireString(raw: Record<string, unknown>, field: string): string {
  const value = raw[field];
  if (typeof value !== "string" || value.trim().length === 0) {
    throw DashboardServerError.badRequest(
      `"${field}" must be a non-empty string`,
    );
  }
  return value;
}

function optionalString(
  raw: Record<string, unknown>,
  field: string,
): string | undefined {
  const value = raw[field];
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "string") {
    throw DashboardServerError.badRequest(`"${field}" must be a string`);
  }
  return value;
}

export function parseDataSourceInput(body: unknown): DataSourceInput {
  const raw = asObject(body);
  rejectUnknown(raw, DATA_SOURCE_FIELDS);

  const type = raw.type;
  if (
    typeof type !== "string" ||
    !(DATA_SOURCE_KINDS as readonly string[]).includes(type)
  ) {
    throw DashboardServerError.badRequest(
      `"type" must be one of ${DATA_SOURCE_KINDS.join(", ")}`,
    );
  }

  const isActive = raw.isActive;
  if (typeof isActive !== "boolean") {
    throw DashboardServerError.badRequest('"isActive" must be a boolean');
  }

  const target = requireString(raw, "target");
  if (type === "POSTGREST") {
    // Checked on write, not on first use: the server calls this target
    // with a credential attached. Loopback is exempt, as elsewhere here.
    const problem = secureUrlProblem(target, "A PostgREST datasource target");
    if (problem !== null) throw DashboardServerError.badRequest(problem);
  }

  const description = optionalString(raw, "description");
  const credentialRef = optionalString(raw, "credentialRef");

  return {
    name: requireString(raw, "name"),
    type: type as DataSourceKind,
    ...(description === undefined ? {} : { description }),
    isActive,
    target,
    ...(credentialRef === undefined ? {} : { credentialRef }),
  };
}

/** The fields each credential kind takes, beyond `kind` itself. */
const CREDENTIAL_FIELDS: Readonly<Record<string, readonly string[]>> = {
  NONE: [],
  BEARER: ["token"],
  API_KEY_HEADER: ["header", "value"],
  API_KEY_QUERY: ["param", "value"],
  BASIC: ["username", "password"],
  SERVICE_ACCOUNT: ["projectId", "clientEmail", "privateKey"],
};

export function parseCredentialInput(body: unknown): CredentialInput {
  const raw = asObject(body);

  const kind = raw.kind;
  if (typeof kind !== "string" || !(kind in CREDENTIAL_FIELDS)) {
    throw DashboardServerError.badRequest(
      `"kind" must be one of ${Object.keys(CREDENTIAL_FIELDS).join(", ")}`,
    );
  }

  const fields = CREDENTIAL_FIELDS[kind] as readonly string[];
  rejectUnknown(raw, new Set(["kind", ...fields]));

  const parsed: Record<string, string> = {};
  for (const field of fields) parsed[field] = requireString(raw, field);

  return { kind, ...parsed } as CredentialInput;
}
