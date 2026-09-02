/**
 * Document seam — where the dashboard config bytes sit.
 *
 * Deliberately no conditional write and no atomicity requirement: the metadata
 * store decides who wins a race, so a filesystem, a bucket and a database
 * column are all equally valid here. Keys are opaque; `createCompositeStore`
 * builds them.
 */
export interface DashboardDocumentStore {
  /** Keys are never reused, so this always creates rather than replaces. */
  put(key: string, body: Uint8Array): Promise<void>;

  /** `null` when the key is absent. */
  get(key: string): Promise<Uint8Array | null>;

  /** Deleting an absent key succeeds: collection has to be idempotent. */
  delete(key: string): Promise<void>;

  /** Release any held resource. Absent on implementations that hold none. */
  close?(): Promise<void>;
}
