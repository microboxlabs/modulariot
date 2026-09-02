#!/usr/bin/env node
/**
 * `npx @microboxlabs/miot-dashboard-server`
 *
 * Assembles the in-memory seams from environment variables and serves them.
 * This is the "no integration exists" path: a client with nothing to mount the
 * library into runs this, and so does anyone exercising the API locally.
 *
 * It refuses to start rather than starting insecurely. Today the only identity
 * resolver it can build is the unverified header one, so it demands an explicit
 * opt-in and rejects it outright under NODE_ENV=production.
 *
 * Lives at the top of `src/` rather than under `src/server/` so the bundler
 * emits it as `dist/bin.js`, matching the path `package.json` publishes.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  ConfigError,
  readServerConfig,
  type ServerConfig,
} from "./server/config";
import { serve } from "./server/serve";
import type { ServerDashboardStore } from "./seams/store";
import { openSqliteStore } from "./store/sqlite";
import {
  createInsecureHeaderIdentityResolver,
  createMemoryScopeAuthority,
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
}

/**
 * A persistent store cannot take a seed at construction the way the memory one
 * does — re-applying it every boot would overwrite whatever people had done
 * since — so a dashboard is written only where its slug is absent.
 */
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

  const opened = await openSqliteStore({ path: config.sqlitePath });
  for (const dashboard of dashboards) {
    if ((await opened.store.load(dashboard.ref)) !== null) continue;
    await opened.store.save(dashboard.ref, dashboard.record?.config ?? null, {
      updatedBy: dashboard.record?.updatedBy ?? "seed",
    });
    if (dashboard.assignments) {
      await opened.store.setPermissions(dashboard.ref, dashboard.assignments);
    }
  }
  return {
    store: opened.store,
    close: opened.close,
    describe: `sqlite at ${config.sqlitePath}`,
  };
}

async function main(): Promise<void> {
  const config = readServerConfig(process.env);
  const seed = readSeed(config.seedPath);

  process.stderr.write(
    "WARNING: identity is read from request headers without verification " +
      "(MIOT_DASHBOARD_INSECURE_AUTH). Local use only.\n",
  );

  const assembled = await openStore(config, seed);
  process.stdout.write(
    `${JSON.stringify({ level: "info", msg: "store", store: assembled.describe })}\n`,
  );

  const running = await serve({
    identity: createInsecureHeaderIdentityResolver(),
    scopes: createMemoryScopeAuthority(seed.memberships ?? {}),
    store: assembled.store,
    audit: createRecordingAuditSink(),
    port: config.port,
    host: config.host,
    docs: config.docs,
    ...(config.basePath ? { basePath: config.basePath } : {}),
  });

  const shutdown = (signal: string) => {
    process.stdout.write(
      `${JSON.stringify({ level: "info", msg: "shutting down", signal })}\n`,
    );
    // Listener first: closing the store under an in-flight request fails it.
    running
      .close()
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
