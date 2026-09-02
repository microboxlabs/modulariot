/**
 * Metadata seam — the relational half of persistence.
 *
 * `ServerDashboardStore` is what a host implements and what the HTTP layer
 * calls. This seam sits *underneath* it: paired with a `DashboardDocumentStore`
 * by `createCompositeStore`, the two make one `ServerDashboardStore` out of a
 * database and a blob store.
 *
 * The split exists because the two halves want different things. Listing a
 * scope needs an indexed query over names and revisions; storing a config
 * needs a place to put a few kilobytes of opaque JSON. A database does the
 * first well, and object storage does the second cheaply.
 *
 * **All optimistic concurrency lives here.** `commit` is a compare-and-swap
 * and the only arbiter of who wins a race. That is what lets the document
 * side stay a write-once key-value store with no conditional writes, which in
 * turn is what makes a plain filesystem a safe backend rather than a footgun.
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
   * Compare-and-swap the row, incrementing `revision`.
   *
   * `expectedRevision` is the revision the caller believes it is replacing:
   * `0` for a create, a positive number for an update, `undefined` to write
   * whatever is there. A precondition failure returns **`null` rather than
   * throwing**, because at this layer it is an outcome, not an error — the
   * composite is what knows it becomes a 409.
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
