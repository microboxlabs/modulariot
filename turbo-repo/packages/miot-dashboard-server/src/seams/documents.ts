/**
 * Where dashboard config bytes are stored.
 *
 * Implementations need no conditional write and no atomicity: the metadata
 * store decides which of two concurrent saves succeeds. A filesystem, a bucket
 * and a database column are all valid backends. `createCompositeStore` builds
 * the keys; implementations treat them as opaque strings.
 */
export interface DashboardDocumentStore {
  /** Keys are never reused, so this always inserts. */
  put(key: string, body: Uint8Array): Promise<void>;

  /** `null` when the key is absent. */
  get(key: string): Promise<Uint8Array | null>;

  /** Deleting a key that does not exist succeeds. */
  delete(key: string): Promise<void>;

  /** Optional: implementations that hold a connection close it here. */
  close?(): Promise<void>;
}
