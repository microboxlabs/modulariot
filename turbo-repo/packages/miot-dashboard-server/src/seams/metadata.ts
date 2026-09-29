/**
 * Dashboard rows and permission assignments, stored in a database.
 * `createCompositeStore` combines this with a `DashboardDocumentStore` to make
 * a `ServerDashboardStore`.
 *
 * `commit` compares revisions on writes; optional `removeIfRevision` does the
 * same for rollback. Document blobs are immutable and need neither check.
 */

import type { PermissionAssignment, ServerDashboardRef } from "./store";

/** One dashboard's row. The config is stored separately, at `documentKey`. */
export interface DashboardMetadataRow {
  slug: string;
  /** Copied from the config so `list` does not read one document per row. */
  name: string;
  /** Monotonic, incremented by every successful `commit`. */
  revision: number;
  /** Key of the config in the document store. A new key on every write. */
  documentKey: string;
  /** ISO-8601. */
  updatedAt: string;
  updatedBy: string;
  /** Set once, on creation, and preserved by every later write. */
  createdBy?: string;
}

/** The fields a write supplies. */
export interface DashboardMetadataWrite {
  name: string;
  documentKey: string;
  updatedBy: string;
  /** ISO-8601. Passed in rather than read from a clock so tests can fix it. */
  updatedAt: string;
}

export interface DashboardMetadataStore {
  read(ref: ServerDashboardRef): Promise<DashboardMetadataRow | null>;

  list(tenantId: string, scopeId: string): Promise<DashboardMetadataRow[]>;

  /**
   * Update the row and increment `revision`, but only if `expectedRevision`
   * matches: `0` means the row must not exist yet, a positive number means it
   * must hold that revision, `undefined` writes without checking. Returns
   * `null` when the check fails, which `createCompositeStore` turns into a 409.
   */
  commit(
    ref: ServerDashboardRef,
    write: DashboardMetadataWrite,
    expectedRevision?: number,
  ): Promise<DashboardMetadataRow | null>;

  /** Returns the deleted row, so its document can be deleted too. */
  remove(ref: ServerDashboardRef): Promise<DashboardMetadataRow | null>;
  /** Atomic compare-and-delete, including permissions; null means no match. */
  removeIfRevision?(
    ref: ServerDashboardRef,
    revision: number,
  ): Promise<DashboardMetadataRow | null>;

  getPermissions(ref: ServerDashboardRef): Promise<PermissionAssignment[]>;

  setPermissions(
    ref: ServerDashboardRef,
    assignments: PermissionAssignment[],
  ): Promise<void>;

  /**
   * Every `documentKey` a row currently references, for
   * `sweepOrphanDocuments`. One key per dashboard, so the whole set fits in
   * memory.
   */
  documentKeys(): Promise<Set<string>>;

  /** Optional: implementations that hold a connection close it here. */
  close?(): Promise<void>;
}
