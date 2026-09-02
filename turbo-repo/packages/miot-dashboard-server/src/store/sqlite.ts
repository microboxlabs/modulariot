/**
 * A persistent `ServerDashboardStore` in one call.
 *
 * Opens the database, brings the schema up to date, and assembles the metadata
 * and document halves into the composite. This is the seam a deployment
 * actually names; everything under `store/sql/` is the machinery it wires.
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
  /**
   * Where config bodies go. Defaults to the same database, which is what
   * makes a single file a complete deployment.
   */
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
    // A missing directory is the most common first-run failure, and the error
    // SQLite gives for it says only "unable to open database file".
    mkdirSync(dirname(path), { recursive: true });
  }

  const driver = createSqliteDriver({ path });
  try {
    const applied = await runMigrations(driver);
    // Built after the migrations, because the inline backend's table is one
    // of the things they create.
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
        // Only a caller-supplied document store gets closed here; the inline
        // one is the driver, and closing it twice is not the driver's problem
        // to guard against.
        if (options.documents?.close) await options.documents.close();
        await driver.close();
      },
    };
  } catch (error) {
    // Opening left a handle behind; a failed migration must not also leak it.
    await driver.close();
    throw error;
  }
}
