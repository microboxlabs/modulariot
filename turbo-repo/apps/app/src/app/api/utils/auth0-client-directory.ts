/**
 * Directory of Auth0 machine-to-machine clients, used to autocomplete the client
 * id on the Auth0 credential form.
 *
 * ## Why this is an adapter and not a fetch
 *
 * The catalog of M2M applications lives in `public.applications` on
 * `prod_iot_gps`, which is owned by the **quarkus-auth0 microservice** — not by
 * the modulith and not by this app. Reading that table directly from here would
 * put a second reader on another service's storage and freeze its schema in
 * place, so the real implementation talks to that service over HTTP and only
 * ever sees what it chooses to publish.
 *
 * That boundary is also the security story. Listing clients requires Auth0
 * Management scopes (`read:clients`), and a credential holding those can mint a
 * client grant for *any* audience — it is a platform credential, not a tenant
 * one. It therefore stays inside the auth0 service, and never becomes a row in
 * `credential_profiles` where the connections framework could point it at an
 * arbitrary base URL. Everything downstream of this module sees identifiers and
 * names, never a secret.
 *
 * ## Modes
 *
 * `MIOT_AUTH0_ADMIN_MODE` selects the implementation:
 *
 *   - `stub` (default) — fixtures, so the form is exercisable before the
 *     service exposes its endpoint. `quarkus-miot-auth0` has the catalog and the
 *     Management config today, but its REST layer (`ApiApplications.java`) is
 *     entirely commented out, so there is nothing to call yet.
 *   - `service` — real lookup against `MIOT_AUTH0_ADMIN_URL`.
 *
 * Flipping the mode is the whole migration; no caller changes.
 */

import "server-only";

/** One selectable M2M application. Never carries a secret. */
export interface M2MClientSummary {
  readonly clientId: string;
  readonly name: string;
  readonly description?: string;
  readonly active: boolean;
}

export interface M2MClientDirectoryResult {
  readonly data: readonly M2MClientSummary[];
  /** Which implementation answered — surfaced so the UI can say so. */
  readonly source: "stub" | "service";
}

export interface ListM2MClientsOptions {
  /** Org whose entitlement scopes the result. */
  readonly orgId: string;
  /** Case-insensitive filter over name and client id. */
  readonly query?: string;
  readonly limit?: number;
}

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;
const SERVICE_TIMEOUT_MS = 10_000;

/**
 * Fabricated stand-ins. Deliberately not the real prod client ids: this file is
 * versioned, and a client id names a live application even though it is not
 * itself a secret.
 */
const STUB_CLIENTS: readonly M2MClientSummary[] = [
  {
    clientId: "stubA1b2C3d4E5f6G7h8I9j0K1l2M3n4O5",
    name: "Coordinador · Operaciones",
    description: "Data plane access for the coordinator workspace",
    active: true,
  },
  {
    clientId: "stubB2c3D4e5F6g7H8i9J0k1L2m3N4o5P6",
    name: "Coordinador · QA",
    description: "Non-production twin of the operations client",
    active: true,
  },
  {
    clientId: "stubC3d4E5f6G7h8I9j0K1l2M3n4O5p6Q7",
    name: "Fleet telemetry ingest",
    description: "Asset tracking writer",
    active: true,
  },
  {
    clientId: "stubD4e5F6g7H8i9J0k1L2m3N4o5P6q7R8",
    name: "Accredited resources reader",
    description: "Read-only access to the ams resource catalog",
    active: true,
  },
  {
    clientId: "stubE5f6G7h8I9j0K1l2M3n4O5p6Q7r8S9",
    name: "Legacy reporting export",
    description: "Deactivated — retained for audit",
    active: false,
  },
];

function clampLimit(limit: number | undefined): number {
  if (!limit || !Number.isFinite(limit)) return DEFAULT_LIMIT;
  return Math.min(MAX_LIMIT, Math.max(1, Math.trunc(limit)));
}

/** Matches name or client id, case-insensitively. */
function matches(client: M2MClientSummary, needle: string): boolean {
  if (!needle) return true;
  const q = needle.toLowerCase();
  return (
    client.name.toLowerCase().includes(q) ||
    client.clientId.toLowerCase().includes(q)
  );
}

function directoryMode(): "stub" | "service" {
  return process.env.MIOT_AUTH0_ADMIN_MODE === "service" ? "service" : "stub";
}

function listStub(options: ListM2MClientsOptions): M2MClientDirectoryResult {
  const limit = clampLimit(options.limit);
  const data = STUB_CLIENTS.filter((client) =>
    matches(client, options.query?.trim() ?? "")
  ).slice(0, limit);
  return { data, source: "stub" };
}

/** Row shape published by the auth0 service's applications endpoint. */
interface ServiceApplicationRow {
  auth0ClientId?: string;
  clientId?: string;
  name?: string;
  description?: string | null;
  active?: boolean | null;
}

/**
 * Normalizes the service's row into our summary. Tolerates either spelling of
 * the id field so the shape the service settles on doesn't gate this prototype,
 * and drops rows with no id — an entry we cannot select is noise in a picker.
 */
function toSummary(row: ServiceApplicationRow): M2MClientSummary | null {
  const clientId = (row.auth0ClientId ?? row.clientId ?? "").trim();
  if (!clientId) return null;
  return {
    clientId,
    name: row.name?.trim() || clientId,
    ...(row.description ? { description: row.description } : {}),
    active: row.active !== false,
  };
}

async function listFromService(
  options: ListM2MClientsOptions
): Promise<M2MClientDirectoryResult> {
  const base = process.env.MIOT_AUTH0_ADMIN_URL?.replace(/\/+$/, "");
  if (!base) {
    throw new Error(
      "MIOT_AUTH0_ADMIN_URL is not set but MIOT_AUTH0_ADMIN_MODE=service"
    );
  }
  const limit = clampLimit(options.limit);
  const params = new URLSearchParams({
    orgId: options.orgId,
    limit: String(limit),
  });
  const query = options.query?.trim();
  if (query) params.set("q", query);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SERVICE_TIMEOUT_MS);
  try {
    const response = await fetch(`${base}/api/v1/applications?${params}`, {
      headers: { accept: "application/json" },
      cache: "no-store",
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(
        `auth0 admin service responded ${response.status} ${response.statusText}`
      );
    }
    const body = (await response.json()) as
      | ServiceApplicationRow[]
      | { data?: ServiceApplicationRow[] };
    const rows = Array.isArray(body) ? body : (body.data ?? []);
    const data = rows
      .map(toSummary)
      .filter((row): row is M2MClientSummary => row !== null)
      .slice(0, limit);
    return { data, source: "service" };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Lists the M2M clients the given org may select.
 *
 * Entitlement is the service's job, not this app's: an org owner should see
 * their own `tenant_client_id` and those of their child orgs, and that
 * parent→child walk lives where the org hierarchy does. The `orgId` is passed
 * through for exactly that reason — the stub ignores it.
 */
export async function listM2MClients(
  options: ListM2MClientsOptions
): Promise<M2MClientDirectoryResult> {
  if (directoryMode() === "service") {
    return listFromService(options);
  }
  return listStub(options);
}
