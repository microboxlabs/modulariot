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
import { ConfigError, readServerConfig } from "./server/config";
import { serve } from "./server/serve";
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

function readSeed(path: string | undefined): SeedFile {
  if (path === undefined) return {};
  try {
    return JSON.parse(readFileSync(path, "utf8")) as SeedFile;
  } catch (error) {
    throw new ConfigError(
      `Could not read MIOT_DASHBOARD_SEED at "${path}": ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
}

async function main(): Promise<void> {
  const config = readServerConfig(process.env);
  const seed = readSeed(config.seedPath);

  process.stderr.write(
    "WARNING: identity is read from request headers without verification " +
      "(MIOT_DASHBOARD_INSECURE_AUTH). Local use only.\n",
  );

  const running = await serve({
    identity: createInsecureHeaderIdentityResolver(),
    scopes: createMemoryScopeAuthority(seed.memberships ?? {}),
    store: createMemoryStore({ seed: seed.dashboards ?? [] }),
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
    running
      .close()
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
