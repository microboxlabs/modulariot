/**
 * Opens the database, applies migrations, and returns a persistent
 * `ServerDashboardStore`.
 */

import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import type { DashboardDocumentStore } from "../seams/documents";
import type { ServerDashboardRef, ServerDashboardStore } from "../seams/store";
import { createCompositeStore } from "./composite";
import { createSqlDocumentStore } from "./sql/documents";
import { createSqlMetadataStore } from "./sql/metadata";
import { runMigrations } from "./sql/migrations";
import { createSqliteDriver } from "./sqlite-driver";

/** In-memory database, discarded when the process exits. */
export const SQLITE_MEMORY = ":memory:";

export interface SqliteStoreOptions {
  /** File path, or `SQLITE_MEMORY`. Parent directories are created. */
  path: string;
  /** Where config bodies go. Defaults to the same database. */
  documents?: DashboardDocumentStore;
  now?: () => Date;
  newDocumentKey?: (ref: ServerDashboardRef) => string;
  onOrphan?: (key: string, error: unknown) => void;
}

export interface OpenedStore {
  store: ServerDashboardStore;
  /** Migration versions this call applied. Empty when already up to date. */
  applied: readonly number[];
  close(): Promise<void>;
}

export async function openSqliteStore(
  options: SqliteStoreOptions,
): Promise<OpenedStore> {
  const { path } = options;
  if (path !== SQLITE_MEMORY) {
    // SQLite's error for a missing parent is only "unable to open database file".
    mkdirSync(dirname(path), { recursive: true });
  }

  const driver = createSqliteDriver({ path });
  try {
    const applied = await runMigrations(driver);
    const documents = options.documents ?? createSqlDocumentStore(driver);
    const store = createCompositeStore({
      metadata: createSqlMetadataStore(driver),
      documents,
      ...(options.now ? { now: options.now } : {}),
      ...(options.newDocumentKey
        ? { newDocumentKey: options.newDocumentKey }
        : {}),
      ...(options.onOrphan ? { onOrphan: options.onOrphan } : {}),
    });

    return {
      store,
      applied,
      async close() {
        // The inline document store uses this driver, so only a supplied
        // document store is closed separately.
        if (options.documents?.close) await options.documents.close();
        await driver.close();
      },
    };
  } catch (error) {
    await driver.close();
    throw error;
  }
}
