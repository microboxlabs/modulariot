/**
 * The stores behind the datasource and credential routes.
 *
 * Kept out of `bin.ts`, which starts a server when imported.
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
 * Both need a database. With the memory store there is neither, and the
 * datasource routes answer 404.
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
      describe: "datasources on, credentials not stored here",
    };
  }

  const credentials = await createSqlCredentialsVault({
    driver,
    key: config.credentialsKey,
  });
  return {
    dataSources,
    credentials,
    describe: "datasources on, credentials stored here and encrypted",
  };
}
