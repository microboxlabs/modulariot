/**
 * Metadata seam — the relational half of persistence, paired with a
 * `DashboardDocumentStore` by `createCompositeStore`.
 *
 * All optimistic concurrency lives here: `commit` is a compare-and-swap and
 * the only arbiter of who wins a race, which is what lets the document side
 * stay a write-once key-value store.
 */

import type { PermissionAssignment, ServerDashboardRef } from "./store";

/** One dashboard's metadata. The config itself lives behind `documentKey`. */
export interface DashboardMetadataRow {
  slug: string;
  /** Display name, denormalized so `list` never has to read a document. */
  name: string;
  /** Monotonic, incremented by every successful `commit`. */
  revision: number;
  /** Address of the config in the document store. Never reused. */
  documentKey: string;
  /** ISO-8601. */
  updatedAt: string;
  updatedBy: string;
  /** Set once, on creation, and preserved by every later write. */
  createdBy?: string;
}

/** The mutable half of a row, as supplied by a caller that is about to write. */
export interface DashboardMetadataWrite {
  name: string;
  documentKey: string;
  updatedBy: string;
  /** ISO-8601. Supplied rather than read from a clock here, so tests can pin it. */
  updatedAt: string;
}

export interface DashboardMetadataStore {
  read(ref: ServerDashboardRef): Promise<DashboardMetadataRow | null>;

  list(tenantId: string, scopeId: string): Promise<DashboardMetadataRow[]>;

  /**
   * Compare-and-swap the row, incrementing `revision`. `expectedRevision` is
   * `0` for a create, positive for an update, `undefined` to write regardless.
   * A precondition failure returns `null`; the composite turns that into a 409.
   */
  commit(
    ref: ServerDashboardRef,
    write: DashboardMetadataWrite,
    expectedRevision?: number,
  ): Promise<DashboardMetadataRow | null>;

  /** Returns the row that was deleted, so its document can be collected. */
  remove(ref: ServerDashboardRef): Promise<DashboardMetadataRow | null>;

  getPermissions(ref: ServerDashboardRef): Promise<PermissionAssignment[]>;

  setPermissions(
    ref: ServerDashboardRef,
    assignments: PermissionAssignment[],
  ): Promise<void>;

  /** Release the connection. Absent on implementations that hold none. */
  close?(): Promise<void>;
}
