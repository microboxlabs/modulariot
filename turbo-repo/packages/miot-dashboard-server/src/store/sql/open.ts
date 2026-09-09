/**
 * Everything that turns an open `SqlDriver` into a `ServerDashboardStore`:
 * migrations, the document-backend pin, and the composite.
 *
 * Shared because it is the same for every engine. Only opening the connection
 * differs, which is what `openSqliteStore` and `openPostgresStore` each add.
 */

import type { DashboardDocumentStore } from "../../seams/documents";
import type {
  ServerDashboardRef,
  ServerDashboardStore,
} from "../../seams/store";
import { createCompositeStore } from "../composite";
import { sweepOrphanDocuments, type SweepResult } from "../sweep";
import { createSqlDocumentStore } from "./documents";
import type { SqlDriver } from "./driver";
import { createSqlMetadataStore } from "./metadata";
import { runMigrations } from "./migrations";

export interface SqlStoreOptions {
  /** Where config bodies go. Defaults to the same database. */
  documents?: DashboardDocumentStore;
  /**
   * Names the backend `documents` is, and is recorded in the database the
   * first time it is opened. Opening the same database with a different one
   * is refused: the bodies do not move, so every existing row would point at
   * a document the new backend has never heard of.
   *
   * Defaults to `inline` when `documents` is absent and `external` when it is
   * present, so a caller that does not care still cannot switch by accident.
   */
  documentBackend?: string;
  now?: () => Date;
  newDocumentKey?: (ref: ServerDashboardRef) => string;
  onOrphan?: (key: string, error: unknown) => void;
}

export interface OpenedStore {
  store: ServerDashboardStore;
  /** Migration versions this call applied. Empty when already up to date. */
  applied: readonly number[];
  /** Delete unreferenced documents written before `olderThan`. */
  sweep(olderThan: Date, dryRun?: boolean): Promise<SweepResult>;
  close(): Promise<void>;
}

const DOCUMENT_BACKEND_SETTING = "document_backend";

/**
 * Record the backend on first open, and refuse a different one afterwards.
 *
 * Without this the server starts, lists dashboards from metadata rows that
 * are all still there, and answers 500 the moment anyone opens one — the
 * bodies live in the backend that is no longer configured.
 */
async function pinDocumentBackend(
  driver: SqlDriver,
  backend: string,
): Promise<void> {
  const p = driver.dialect;
  const rows = await driver.all<{ value: string }>(
    `SELECT value FROM store_settings WHERE name = ${p.placeholder(1)}`,
    [DOCUMENT_BACKEND_SETTING],
  );
  const recorded = rows[0]?.value;

  if (recorded === undefined) {
    await driver.all(
      `INSERT INTO store_settings (name, value)
       VALUES (${p.placeholder(1)}, ${p.placeholder(2)})`,
      [DOCUMENT_BACKEND_SETTING, backend],
    );
    return;
  }
  if (recorded !== backend) {
    throw new Error(
      `This database was written with the "${recorded}" document backend and ` +
        `is now being opened with "${backend}". The bodies do not move on ` +
        `their own, so every dashboard in it would fail to load. Set the ` +
        `backend back to "${recorded}", or migrate the documents first.`,
    );
  }
}

/**
 * Migrates and assembles. Takes ownership of `driver`: it is closed both by
 * the returned `close` and on a failure here, so a caller never has to unwind
 * a half-open database.
 */
export async function openSqlStore(
  driver: SqlDriver,
  options: SqlStoreOptions,
): Promise<OpenedStore> {
  try {
    const applied = await runMigrations(driver);
    await pinDocumentBackend(
      driver,
      options.documentBackend ??
        (options.documents === undefined ? "inline" : "external"),
    );
    const documents = options.documents ?? createSqlDocumentStore(driver);
    const metadata = createSqlMetadataStore(driver);
    const store = createCompositeStore({
      metadata,
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
      sweep(olderThan, dryRun = false) {
        return sweepOrphanDocuments({ metadata, documents, olderThan, dryRun });
      },
      async close() {
        try {
          // The inline document store uses this driver, so only a supplied
          // document store is closed separately.
          if (options.documents?.close) await options.documents.close();
        } finally {
          await driver.close();
        }
      },
    };
  } catch (error) {
    await driver.close();
    throw error;
  }
}
