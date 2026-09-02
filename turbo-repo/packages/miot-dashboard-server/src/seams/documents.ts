/**
 * Document seam — where the dashboard config bytes actually sit.
 *
 * Three methods, none of them hard. There is deliberately **no conditional
 * write, no compare-and-swap and no atomicity requirement**, because the
 * metadata store is the only arbiter of who wins a race: a save writes the
 * config at a brand-new key and only then swaps the pointer in the database,
 * so a reader can never reach a key the database has not committed.
 *
 * That is what puts a plain filesystem, a bucket and a database column on
 * equal footing here. It costs orphaned documents when a write crashes or
 * loses a race, which is a garbage-collection problem rather than a
 * correctness one.
 *
 * Keys are opaque to implementations — see `createCompositeStore` for how they
 * are built, and why they carry no caller-supplied path segment.
 */
export interface DashboardDocumentStore {
  /**
   * Write a document. Keys are never reused, so an implementation may assume
   * it is creating rather than replacing.
   */
  put(key: string, body: Uint8Array): Promise<void>;

  /** `null` when the key is absent. */
  get(key: string): Promise<Uint8Array | null>;

  /** Deleting an absent key succeeds: collection has to be idempotent. */
  delete(key: string): Promise<void>;

  /** Release any held resource. Absent on implementations that hold none. */
  close?(): Promise<void>;
}
