/**
 * A persistent `ServerDashboardStore` in one call: open, migrate, and assemble
 * the metadata and document halves. This is what a deployment names.
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

/** A database that dies with the process. Useful in tests and demos. */
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
        // The inline document store is the driver; only a supplied one needs this.
        if (options.documents?.close) await options.documents.close();
        await driver.close();
      },
    };
  } catch (error) {
    await driver.close();
    throw error;
  }
}
