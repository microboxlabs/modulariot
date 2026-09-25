/**
 * The stores behind the datasource and credential routes.
 *
 * Kept out of `bin.ts`, which starts a server when imported.
 */

import { EndpointError } from "../net/endpoint";
import type { CredentialsVault } from "../seams/credentials";
import type { DataSourceStore } from "../seams/datasources";
import { createSqlDataSourceStore } from "../store/sql/datasources";
import type { SqlDriver } from "../store/sql/driver";
import { createHttpCredentialsVault } from "../vault/http";
import { createSqlCredentialsVault } from "../vault/sql";
import { ConfigError, type ServerConfig } from "./config";

export interface OpenedDataSources {
  dataSources?: DataSourceStore;
  credentials?: CredentialsVault;
  describe: string;
}

/**
 * Datasources need a database. With the memory store there is none, so the
 * datasource routes answer 404 and no vault is built either.
 */
export async function openDataSources(
  config: ServerConfig,
  driver: SqlDriver | undefined,
): Promise<OpenedDataSources> {
  if (driver === undefined) {
    return { describe: "datasources off (needs a database)" };
  }

  const dataSources = createSqlDataSourceStore(driver);
  const settings = config.credentials;

  if (settings.kind === "none") {
    return {
      dataSources,
      describe: "datasources on, no credentials",
    };
  }

  if (settings.kind === "sql") {
    return {
      dataSources,
      credentials: await createSqlCredentialsVault({
        driver,
        key: settings.key,
      }),
      describe: "datasources on, credentials stored here and encrypted",
    };
  }

  return {
    dataSources,
    credentials: asConfigError(() =>
      createHttpCredentialsVault({
        url: settings.url,
        proxyKey: settings.proxyKey,
        allowHttp: settings.allowHttp,
        requestTimeoutMs: settings.requestTimeoutMs,
        maxCacheSeconds: settings.maxCacheSeconds,
      }),
    ),
    describe: `datasources on, credentials from ${redactUrl(settings.url)}`,
  };
}

/** The vault checks its own URL and key. A bad one is a bad setting. */
function asConfigError<T>(build: () => T): T {
  try {
    return build();
  } catch (error) {
    if (error instanceof EndpointError) throw new ConfigError(error.message);
    throw error;
  }
}

/** Origin only. The path holds a tenant id, and this line is logged. */
function redactUrl(url: string): string {
  try {
    return new URL(url).origin;
  } catch {
    return "the configured endpoint";
  }
}
