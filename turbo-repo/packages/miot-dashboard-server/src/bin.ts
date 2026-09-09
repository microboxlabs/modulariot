#!/usr/bin/env node
/**
 * `npx @microboxlabs/miot-dashboard-server`
 *
 * Assembles the seams from environment variables and serves them. This is the
 * "no integration exists" path: a client with nothing to mount the library
 * into runs this, and so does anyone exercising the API locally.
 *
 * It refuses to start rather than starting insecurely: either it verifies
 * bearer tokens against a configured issuer, or the unverified header resolver
 * is explicitly opted into and then confined to a loopback address.
 *
 * Lives at the top of `src/` rather than under `src/server/` so the bundler
 * emits it as `dist/bin.js`, matching the path `package.json` publishes.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildIdentityResolver,
  buildScopeAuthority,
  buildTenantAuthority,
} from "./server/auth";
import {
  ConfigError,
  readServerConfig,
  type ServerConfig,
} from "./server/config";
import { createRefusalLog } from "./server/refusal-log";
import { startSweepSchedule } from "./server/sweep-schedule";
import { seedDashboards } from "./server/seed";
import { serve } from "./server/serve";
import type { ServerDashboardStore } from "./seams/store";
import { createFsDocumentStore } from "./store/fs-documents";
import { openPostgresStore } from "./store/postgres";
import { openSqliteStore } from "./store/sqlite";
import type { SweepResult } from "./store/sweep";
import {
  createMemoryStore,
  createRecordingAuditSink,
  type Memberships,
  type SeedDashboard,
} from "./testing";

interface SeedFile {
  memberships?: Memberships;
  dashboards?: SeedDashboard[];
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * The bundled example seed, for `MIOT_DASHBOARD_SEED=example`; any other value
 * is a path from the caller's working directory. Two candidates because the
 * module sits one or two levels below the package root depending on the build.
 */
function bundledSeedPath(): string | null {
  const here = dirname(fileURLToPath(import.meta.url));
  for (const candidate of [
    join(here, "..", "examples", "seed.json"),
    join(here, "..", "..", "examples", "seed.json"),
  ]) {
    try {
      readFileSync(candidate);
      return candidate;
    } catch {
      // Try the next layout.
    }
  }
  return null;
}

function resolveSeedPath(seed: string): string {
  if (seed !== "example") return seed;
  const bundled = bundledSeedPath();
  if (bundled === null) {
    throw new ConfigError(
      'MIOT_DASHBOARD_SEED="example" asks for the seed shipped with this ' +
        "package, but it was not found next to the installed files.",
    );
  }
  return bundled;
}

/** `JSON.parse` validates syntax, not shape; a bad seed must fail at startup. */
function readSeed(seed: string | undefined): SeedFile {
  if (seed === undefined) return {};
  const path = resolveSeedPath(seed);

  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    throw new ConfigError(
      `Could not read MIOT_DASHBOARD_SEED at "${path}": ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }

  if (!isRecord(parsed)) {
    throw new ConfigError(
      `MIOT_DASHBOARD_SEED at "${path}" must contain a JSON object`,
    );
  }
  const { memberships, dashboards } = parsed;
  if (memberships !== undefined && !isRecord(memberships)) {
    throw new ConfigError(
      `MIOT_DASHBOARD_SEED at "${path}": "memberships" must be an object keyed by tenant`,
    );
  }
  if (dashboards !== undefined && !Array.isArray(dashboards)) {
    throw new ConfigError(
      `MIOT_DASHBOARD_SEED at "${path}": "dashboards" must be an array`,
    );
  }
  for (const [index, entry] of (dashboards ?? []).entries()) {
    if (!isRecord(entry) || !isRecord(entry.ref)) {
      throw new ConfigError(
        `MIOT_DASHBOARD_SEED at "${path}": "dashboards[${index}]" must be an object with a "ref"`,
      );
    }
    const { tenantId, scopeId, slug } = entry.ref;
    if (
      typeof tenantId !== "string" ||
      typeof scopeId !== "string" ||
      typeof slug !== "string"
    ) {
      throw new ConfigError(
        `MIOT_DASHBOARD_SEED at "${path}": "dashboards[${index}].ref" needs string tenantId, scopeId and slug`,
      );
    }
  }

  return {
    ...(memberships === undefined
      ? {}
      : { memberships: memberships as Memberships }),
    ...(dashboards === undefined
      ? {}
      : { dashboards: dashboards as SeedDashboard[] }),
  };
}

interface AssembledStore {
  store: ServerDashboardStore;
  close(): Promise<void>;
  describe: string;
  /** Absent when the store has no documents to sweep. */
  sweep?: (olderThan: Date) => Promise<SweepResult>;
}

/** Build the store named by the configuration. */
async function openStore(
  config: ServerConfig,
  seed: SeedFile,
): Promise<AssembledStore> {
  const dashboards = seed.dashboards ?? [];

  if (config.store === "memory") {
    return {
      store: createMemoryStore({ seed: dashboards }),
      close: () => Promise.resolve(),
      describe: "memory (nothing survives a restart)",
    };
  }

  const shared = {
    documentBackend: config.documents,
    ...(config.documents === "fs"
      ? { documents: createFsDocumentStore({ root: config.documentsPath }) }
      : {}),
    onOrphan: (key: string, error: unknown) =>
      log({
        level: "warn",
        msg: "document left behind",
        key,
        error: String(error),
      }),
  };

  // `postgres` is set exactly when the store is postgres, which is also what
  // makes the connection string available without a non-null assertion.
  const { postgres } = config;
  const opened =
    postgres !== undefined
      ? await openPostgresStore({
          url: postgres.url,
          poolSize: postgres.poolSize,
          connectionTimeoutMs: postgres.connectionTimeoutMs,
          onPoolError: (error) =>
            log({
              level: "warn",
              msg: "postgres idle connection lost",
              error: error.message,
            }),
          ...shared,
        })
      : await openSqliteStore({ path: config.sqlitePath, ...shared });

  await seedDashboards(opened.store, dashboards);
  const documents =
    config.documents === "fs"
      ? `documents in ${config.documentsPath}`
      : "documents inline";
  // The connection string carries a password, so the log names the database
  // and the host it came from, never the string itself.
  const where =
    postgres !== undefined
      ? `postgres at ${describeDatabase(postgres.url)}`
      : `sqlite at ${config.sqlitePath}`;
  return {
    store: opened.store,
    close: opened.close,
    describe: `${where}, ${documents}`,
    sweep: opened.sweep,
  };
}

/** `host:port/database` from a connection string, with the credentials left out. */
function describeDatabase(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.host}${parsed.pathname}`;
  } catch {
    return "an unparseable connection string";
  }
}

const log = (line: Record<string, unknown>) => {
  process.stdout.write(`${JSON.stringify(line)}\n`);
};

async function main(): Promise<void> {
  const config = readServerConfig(process.env);
  const seed = readSeed(config.seedPath);
  const memberships = seed.memberships ?? {};

  // The response is a 401 or 403 with no detail; the reason is logged here so
  // a misconfiguration can be diagnosed. Rate-limited, because otherwise an
  // anonymous caller controls how much this process logs.
  const onReject = createRefusalLog({ write: log });

  const auth = await buildIdentityResolver(config.auth, { onReject });
  const tenants = buildTenantAuthority(config.tenants, {
    memberships,
    onReject,
  });
  const scopes = buildScopeAuthority(config.scopes, { memberships, onReject });

  if (config.auth.kind === "insecure") {
    process.stderr.write(
      "WARNING: identity is read from request headers without verification " +
        "(MIOT_DASHBOARD_INSECURE_AUTH). Local use only.\n",
    );
  }
  if (
    (config.scopes.kind === "seed" || config.tenants.kind === "seed") &&
    Object.keys(memberships).length === 0
  ) {
    // Both authorities deny by default, so with no memberships every request
    // is a 403 and the server looks broken rather than misconfigured.
    process.stderr.write(
      "WARNING: no memberships are configured, so every request will be " +
        "refused with 403 TENANT_SCOPE. Read them from MIOT_DASHBOARD_SEED " +
        "for local use, or set MIOT_DASHBOARD_TENANTS_URL and " +
        "MIOT_DASHBOARD_SCOPES_URL to ask the host's own systems.\n",
    );
  }

  const assembled = await openStore(config, seed);
  log({ level: "info", msg: "store", store: assembled.describe });
  const stopSweep =
    assembled.sweep === undefined
      ? () => Promise.resolve()
      : startSweepSchedule({
          sweep: assembled.sweep,
          intervalSeconds: config.orphanSweepIntervalSeconds,
          minAgeSeconds: config.orphanMinAgeSeconds,
          log,
        });
  log({ level: "info", msg: "identity", auth: auth.describe });
  log({ level: "info", msg: "tenants", entitlement: tenants.describe });
  log({ level: "info", msg: "scopes", membership: scopes.describe });

  const running = await serve({
    identity: auth.identity,
    tenants: tenants.tenants,
    scopes: scopes.scopes,
    store: assembled.store,
    audit: createRecordingAuditSink(),
    port: config.port,
    host: config.host,
    docs: config.docs,
    ...(config.basePath ? { basePath: config.basePath } : {}),
  });

  const shutdown = (signal: string) => {
    log({ level: "info", msg: "shutting down", signal });
    // Close the listener first, so no request is in progress when the
    // database closes.
    running
      .close()
      // Then the sweep, before the store it reads from is closed.
      .then(() => stopSweep())
      .then(() => assembled.close())
      .then(() => process.exit(0))
      .catch(() => process.exit(1));
  };
  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

main().catch((error: unknown) => {
  if (error instanceof ConfigError) {
    process.stderr.write(`Configuration error: ${error.message}\n`);
    process.exit(2);
  }
  process.stderr.write(
    `Failed to start: ${error instanceof Error ? error.stack : String(error)}\n`,
  );
  process.exit(1);
});
