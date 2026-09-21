/**
 * What the standalone server mounts the datasource and credential routes on.
 *
 * In its own module so it can be tested. `bin.ts` runs on import.
 */

import type { CredentialsVault } from "../seams/credentials";
import type { DataSourceStore } from "../seams/datasources";
import { createSqlDataSourceStore } from "../store/sql/datasources";
import type { SqlDriver } from "../store/sql/driver";
import { createSqlCredentialsVault } from "../vault/sql";
import type { ServerConfig } from "./config";

export interface OpenedDataSources {
  dataSources?: DataSourceStore;
  credentials?: CredentialsVault;
  describe: string;
}

/**
 * The datasource store and the vault, when the configuration supports them.
 *
 * Both need a database. On the memory store there is neither, and the
 * datasource routes answer 404 — which is honest: nothing written to them
 * would survive a restart.
 */
export async function openDataSources(
  config: ServerConfig,
  driver: SqlDriver | undefined,
): Promise<OpenedDataSources> {
  if (driver === undefined) {
    return { describe: "datasources off (needs a database)" };
  }

  const dataSources = createSqlDataSourceStore(driver);
  if (config.credentialsKey === undefined) {
    return {
      dataSources,
      describe: "datasources on; credentials are not kept here",
    };
  }

  const credentials = await createSqlCredentialsVault({
    driver,
    key: config.credentialsKey,
  });
  return {
    dataSources,
    credentials,
    describe: "datasources on; credentials in this database, encrypted",
  };
}
